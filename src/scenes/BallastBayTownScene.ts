import {
  Scene,
  MeshBuilder,
  Vector3,
  Color3,
  type AbstractMesh,
  type Mesh,
} from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, PALETTE } from '../render/scene-helpers';
import { CameraRig, type FollowTarget, type CameraRigState } from '../camera/rig';
import { baselineProfile } from '../camera/profiles';
import { CameraInputController, ZERO_INPUT, type CameraInput } from '../camera/input';
import type { CameraVolume } from '../camera/volumes';
import type { Planar } from '../camera/orbit';
import {
  createMotorState,
  stepMotor,
  groundedPoseAt,
  NO_CEILING,
  NO_GROUND,
  type MotorState,
  type MotorEnvironment,
  type WallHit,
  type WaterColumn,
} from '../engine/motor';
import { BALLAST_BAY_DISTRICT_BLOCKOUT } from '../world/blockouts/ballast-bay-district';
import { floraFamily, swayAngle, DEFAULT_WIND } from '../engine/flora-motion';
import {
  DEFAULT_CLOCK_MINUTES,
  NPC_STATE_TOKEN,
  type RegionTransitionData,
} from '../world/region-transition';

/**
 * Ballast Bay town district — production-foundation map II (WEF-10b, master Prompt
 * 047). Graybox built from the dimensioned blockout
 * (`src/world/blockouts/ballast-bay-district.ts`, grounded in
 * `sv_map_013_ballast_bay_town_layout.png` + `sv_map_022` + the mood of
 * `sv_map_026_market_lane_rainy.png` / `sv_map_027_harbor_evening.png`) over
 * production collision, navigation, anchor, camera-volume, and transition data,
 * driven by the shared camera rig + kinematic motor + interaction stack.
 *
 * Demonstrates the district's required cases: **market** (canvas-canopy stalls +
 * the four shop fronts + well + townsfolk), **harbor** (docks over the bay water),
 * **elevation + traversal** (upper terrace + stairs, river footbridge, beach
 * wade), **camera** (market-lane + harborfront authored volumes), and **NPC**
 * (townsfolk walking the lane). Boundaries read as architecture/geography
 * (terrace retaining wall, ocean cliff, redwood ring). Critical routes + the
 * lighthouse landmark stay legible at phone scale. The west gate transitions to
 * Breakpoint Farm (and accepts arrival from it), preserving clock + NPC state.
 *
 * Reachable via the Title "Dev · Ballast Bay Town" item or `?scene=BallastBayTown`.
 */

const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.4;
const WALK_SPEED = 3.6;
const FIXED_DT = 1 / 30;

export type TownLayer = 'render' | 'collision' | 'nav' | 'anchor' | 'volume';

interface Box {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
const COLLISION: Box[] = [
  { id: 'community-hall', minX: 74, maxX: 86, minZ: 60, maxZ: 72 },
  { id: 'bakery', minX: 54, maxX: 66, minZ: 48, maxZ: 58 },
  { id: 'fishmonger', minX: 94, maxX: 106, minZ: 40, maxZ: 50 },
  { id: 'general-store', minX: 66, maxX: 78, minZ: 62, maxZ: 72 },
  { id: 'lighthouse', minX: 136, maxX: 144, minZ: 12, maxZ: 20 },
  // Terrace retaining wall (gap at x[104,116] = the stairs).
  { id: 'terrace-wall-w', minX: 88, maxX: 104, minZ: 81, maxZ: 82 },
  { id: 'terrace-wall-e', minX: 116, maxX: 132, minZ: 81, maxZ: 82 },
  // Map-edge boundaries (forest ring + far cliff).
  { id: 'edge-w', minX: -1, maxX: 1, minZ: 0, maxZ: 128 },
  { id: 'edge-e', minX: 159, maxX: 161, minZ: 0, maxZ: 128 },
  { id: 'edge-n', minX: 0, maxX: 160, minZ: 126, maxZ: 128 },
];

/** Upper terrace plateau (NE), reached by a stair ramp climbing in +Z. */
const TERRACE = { minX: 88, maxX: 132, plateauMinZ: 82, rampMinZ: 72, y: 3.0 };
/** Harbor bay water (south) + a walkable dock deck over it. */
const HARBOR = { minX: 42, maxX: 132, maxZ: 22, surfaceY: 0.1, bedY: -0.5 };
const DOCK = { minX: 72, maxX: 88, minZ: 8, maxZ: 22, deckY: 0.3 };
/** River-through-town (N–S) + a footbridge gap. */
const RIVER = { minX: 28, maxX: 38, minZ: 24, maxZ: 124, surfaceY: 0.1, bedY: -0.4 };
const BRIDGE = { minZ: 54, maxZ: 62, deckY: 0.4 };
/** Beach access water (west). */
const BEACH = { maxX: 9, surfaceY: 0.1, bedY: -0.45 };
/** Market lane the townsfolk wander. */
const LANE = { minX: 44, maxX: 120, minZ: 30, maxZ: 56 };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
function inBox(b: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number): boolean {
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}

function townGroundY(x: number, z: number): number {
  // Dock deck over the harbor.
  if (x >= DOCK.minX && x <= DOCK.maxX && z >= DOCK.minZ && z <= DOCK.maxZ) return DOCK.deckY;
  // Footbridge over the river.
  if (x >= RIVER.minX && x <= RIVER.maxX && z >= BRIDGE.minZ && z <= BRIDGE.maxZ) return BRIDGE.deckY;
  // Terrace plateau + stair ramp (elevation change).
  if (x >= TERRACE.minX && x <= TERRACE.maxX) {
    if (z >= TERRACE.plateauMinZ) return TERRACE.y;
    if (z >= TERRACE.rampMinZ) return lerp(0, TERRACE.y, (z - TERRACE.rampMinZ) / (TERRACE.plateauMinZ - TERRACE.rampMinZ));
  }
  return 0;
}

function townWater(x: number, z: number): WaterColumn | undefined {
  // The dock deck + footbridge sit above the water (no wade on them).
  if (x >= DOCK.minX && x <= DOCK.maxX && z >= DOCK.minZ && z <= DOCK.maxZ) return undefined;
  if (x >= RIVER.minX && x <= RIVER.maxX && z >= BRIDGE.minZ && z <= BRIDGE.maxZ) return undefined;
  if (z <= HARBOR.maxZ && x >= HARBOR.minX && x <= HARBOR.maxX) return { surfaceY: HARBOR.surfaceY, bedY: HARBOR.bedY };
  if (x >= RIVER.minX && x <= RIVER.maxX && z >= RIVER.minZ && z <= RIVER.maxZ) return { surfaceY: RIVER.surfaceY, bedY: RIVER.bedY };
  if (x <= BEACH.maxX) return { surfaceY: BEACH.surfaceY, bedY: BEACH.bedY };
  return undefined;
}

function aabbWall(pos: { x: number; z: number }, radius: number, moveDir: { x: number; z: number }, mag: number): WallHit {
  let best: WallHit = { hit: false, distance: Number.POSITIVE_INFINITY, normal: { x: 0, y: 0, z: 0 } };
  for (const b of COLLISION) {
    const minX = b.minX - radius, maxX = b.maxX + radius, minZ = b.minZ - radius, maxZ = b.maxZ + radius;
    if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
      const dxL = pos.x - minX, dxR = maxX - pos.x, dzL = pos.z - minZ, dzR = maxZ - pos.z;
      const m = Math.min(dxL, dxR, dzL, dzR);
      const normal = m === dxL ? { x: -1, y: 0, z: 0 } : m === dxR ? { x: 1, y: 0, z: 0 } : m === dzL ? { x: 0, y: 0, z: -1 } : { x: 0, y: 0, z: 1 };
      return { hit: true, distance: -m, normal };
    }
    if (mag <= 0) continue;
    let tEnter = -Infinity;
    let axis: 'x' | 'z' = 'x';
    let miss = false;
    for (const ax of ['x', 'z'] as const) {
      const o = pos[ax];
      const d = moveDir[ax];
      const lo = ax === 'x' ? minX : minZ;
      const hi = ax === 'x' ? maxX : maxZ;
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) { miss = true; break; }
        continue;
      }
      let t1 = (lo - o) / d, t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tEnter) { tEnter = t1; axis = ax; }
      if (t2 < 0) { miss = true; break; }
    }
    if (miss) continue;
    if (tEnter >= 0 && tEnter <= mag && tEnter < best.distance) {
      const sign = -Math.sign(moveDir[axis]);
      best = { hit: true, distance: tEnter, normal: axis === 'x' ? { x: sign, y: 0, z: 0 } : { x: 0, y: 0, z: sign } };
    }
  }
  return best;
}

function pseudo(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

interface Townsfolk {
  mesh: Mesh;
  motor: MotorState;
  seed: number;
}
interface FloraInst {
  mesh: Mesh;
  phase: number;
}

export class BallastBayTownScene extends GameScene {
  private rig!: CameraRig;
  private input: CameraInputController | null = null;
  private playerMesh!: Mesh;
  private motor!: MotorState;
  private velocity: Planar = { x: 0, z: 0 };
  private moveX = 0;
  private moveZ = 0;

  private readonly layers = new Map<TownLayer, Mesh[]>([
    ['render', []], ['collision', []], ['nav', []], ['anchor', []], ['volume', []],
  ]);
  private readonly townsfolk: Townsfolk[] = [];
  private readonly flora: FloraInst[] = [];
  private time = 0;

  private clockMinutes = DEFAULT_CLOCK_MINUTES;
  private npcToken = NPC_STATE_TOKEN;
  private transitioning = false;

  private readonly held = new Set<string>();
  private onKeyDown?: (e: KeyboardEvent) => void;
  private onKeyUp?: (e: KeyboardEvent) => void;

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    this.scene = scene;
    addFog(scene, PALETTE.fog, 0.006);
    addLights(scene);

    this.buildTerrain(scene);
    this.buildStructures(scene);
    this.buildMarket(scene);
    this.buildTownsfolk(scene);
    this.buildDebugLayers(scene);

    const player = MeshBuilder.CreateCapsule('town-player', { height: PLAYER_HEIGHT, radius: PLAYER_RADIUS }, scene);
    player.material = flatMaterial(scene, 'town-player', PALETTE.player, 0.35);
    player.isPickable = false;
    this.playerMesh = player;
    this.motor = groundedPoseAt(80, 50, townGroundY(80, 50), 0);
    this.syncPlayer();

    this.rig = new CameraRig(scene, baselineProfile('exterior'), -Math.PI / 2);
    const follow: FollowTarget = {
      position: () => new Vector3(this.motor.position.x, this.motor.position.y + 0.6, this.motor.position.z),
      velocity: () => this.velocity,
      ignore: (): readonly AbstractMesh[] => [this.playerMesh, ...this.townsfolk.map((t) => t.mesh)],
    };
    this.rig.setTarget(follow);
    this.rig.setVolumes(this.cameraVolumes());

    return scene;
  }

  override enter(data?: unknown): void {
    const t = data as RegionTransitionData | undefined;
    if (t && typeof t.clockMinutes === 'number') {
      this.clockMinutes = t.clockMinutes;
      this.npcToken = t.npcToken;
      this.motor = groundedPoseAt(t.toAnchor.x, t.toAnchor.z, townGroundY(t.toAnchor.x, t.toAnchor.z), t.facing);
      this.syncPlayer();
    }
    const canvas = this.ctx.engine.getRenderingCanvas();
    if (canvas) this.input = new CameraInputController(canvas);
    this.onKeyDown = (e) => {
      this.held.add(e.key.toLowerCase());
      if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') this.pressAction();
    };
    this.onKeyUp = (e) => this.held.delete(e.key.toLowerCase());
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.installDebugApi();
  }

  override update(dt: number): void {
    if (dt <= 0) return;
    this.readKeys();
    this.step(dt);
    const camInput: CameraInput = this.input ? this.input.consume(dt) : ZERO_INPUT;
    this.rig.update(dt, camInput);
  }

  override dispose(): void {
    if (this.onKeyDown) window.removeEventListener('keydown', this.onKeyDown);
    if (this.onKeyUp) window.removeEventListener('keyup', this.onKeyUp);
    this.input?.dispose();
    this.rig?.dispose();
    delete (window as unknown as { sturdyVolleyTown?: unknown }).sturdyVolleyTown;
    super.dispose();
  }

  private readKeys(): void {
    const fwd = (this.held.has('w') || this.held.has('arrowup') ? 1 : 0) - (this.held.has('s') || this.held.has('arrowdown') ? 1 : 0);
    const str = (this.held.has('d') || this.held.has('arrowright') ? 1 : 0) - (this.held.has('a') || this.held.has('arrowleft') ? 1 : 0);
    if (fwd === 0 && str === 0) { this.moveX = 0; this.moveZ = 0; return; }
    const alpha = this.rig.camera.alpha;
    const forward: Planar = { x: -Math.cos(alpha), z: -Math.sin(alpha) };
    const right: Planar = { x: -Math.sin(alpha), z: Math.cos(alpha) };
    this.moveX = right.x * str + forward.x * fwd;
    this.moveZ = right.z * str + forward.z * fwd;
  }

  private step(dt: number): void {
    this.time += dt;
    const mag = Math.hypot(this.moveX, this.moveZ);
    const moveDir = mag > 1e-4 ? { x: this.moveX / mag, z: this.moveZ / mag } : { x: 0, z: 0 };
    const env = this.envAt(this.motor, moveDir, WALK_SPEED * dt, PLAYER_RADIUS);
    this.motor = stepMotor(this.motor, { moveDir, speed: mag > 1e-4 ? WALK_SPEED : 0 }, env, dt);
    this.velocity = { x: moveDir.x * WALK_SPEED * (mag > 1e-4 ? 1 : 0), z: moveDir.z * WALK_SPEED * (mag > 1e-4 ? 1 : 0) };
    this.syncPlayer();
    this.stepTownsfolk(dt);
    for (const f of this.flora) f.mesh.rotation.z = swayAngle(floraFamily('hanging'), f.phase, this.time, DEFAULT_WIND);
  }

  private envAt(motor: MotorState, moveDir: { x: number; z: number }, mag: number, radius: number): MotorEnvironment {
    const x = motor.position.x, z = motor.position.z;
    return {
      ground: { hit: true, groundY: townGroundY(x, z), normal: { x: 0, y: 1, z: 0 } },
      wall: aabbWall({ x, z }, radius, moveDir, mag),
      stepGround: NO_GROUND,
      ceiling: NO_CEILING,
      water: townWater(x, z),
    };
  }

  private stepTownsfolk(dt: number): void {
    for (const t of this.townsfolk) {
      t.seed += 1;
      const tx = pseudo(t.seed) * (LANE.maxX - LANE.minX) + LANE.minX;
      const tz = pseudo(t.seed + 11) * (LANE.maxZ - LANE.minZ) + LANE.minZ;
      const pos = { x: t.motor.position.x, z: t.motor.position.z };
      const dir = { x: tx - pos.x, z: tz - pos.z };
      const d = Math.hypot(dir.x, dir.z);
      const moveDir = d > 0.5 ? { x: dir.x / d, z: dir.z / d } : { x: 0, z: 0 };
      const env: MotorEnvironment = {
        ground: { hit: true, groundY: 0, normal: { x: 0, y: 1, z: 0 } },
        wall: aabbWall(pos, PLAYER_RADIUS, moveDir, 1.6 * dt),
        stepGround: NO_GROUND,
        ceiling: NO_CEILING,
      };
      t.motor = stepMotor(t.motor, { moveDir, speed: d > 0.5 ? 1.6 : 0 }, env, dt);
      t.motor.position.x = Math.max(LANE.minX, Math.min(LANE.maxX, t.motor.position.x));
      t.motor.position.z = Math.max(LANE.minZ, Math.min(LANE.maxZ, t.motor.position.z));
      t.mesh.position.set(t.motor.position.x, PLAYER_HEIGHT / 2, t.motor.position.z);
      t.mesh.rotation.y = t.motor.facing;
    }
  }

  private syncPlayer(): void {
    this.playerMesh.position.set(this.motor.position.x, this.motor.position.y, this.motor.position.z);
    this.playerMesh.rotation.y = this.motor.facing;
  }

  private anchorAt(id: string): { x: number; z: number } | null {
    const a = BALLAST_BAY_DISTRICT_BLOCKOUT.anchors.find((n) => n.id === id);
    return a ? { x: a.at.x, z: a.at.z } : null;
  }

  private nearGate(): boolean {
    const g = this.anchorAt('town-gate-farm');
    if (!g) return false;
    return Math.hypot(this.motor.position.x - g.x, this.motor.position.z - g.z) <= 3;
  }

  private pressAction(): boolean {
    if (this.transitioning || !this.nearGate()) return false;
    this.transitioning = true;
    const data: RegionTransitionData = {
      toAnchor: { x: 120, z: 64 },
      facing: Math.PI / 2,
      cameraContext: 'farm',
      clockMinutes: this.clockMinutes,
      npcToken: this.npcToken,
    };
    void this.ctx.manager.goTo('BreakpointFarm', data);
    return true;
  }

  // --- Geometry -------------------------------------------------------------

  private register(mesh: Mesh, layer: TownLayer): Mesh {
    mesh.metadata = { layer };
    this.layers.get(layer)!.push(mesh);
    return mesh;
  }

  private buildTerrain(scene: Scene): void {
    const ground = MeshBuilder.CreateGround('town-ground', { width: 172, height: 140 }, scene);
    ground.position.set(80, 0, 64);
    ground.material = flatMaterial(scene, 'town-ground', PALETTE.grass, 0.2);
    ground.isPickable = false;
    this.register(ground, 'render');

    // Harbor bay + river + beach water planes.
    const water = (name: string, w: number, d: number, x: number, z: number): void => {
      const m = MeshBuilder.CreateGround(name, { width: w, height: d }, scene);
      m.position.set(x, 0.1, z);
      const mat = flatMaterial(scene, name, PALETTE.sea, 0.4);
      mat.alpha = 0.7;
      m.material = mat;
      m.isPickable = false;
      this.register(m, 'render');
    };
    water('town-harbor', HARBOR.maxX - HARBOR.minX, HARBOR.maxZ + 8, (HARBOR.minX + HARBOR.maxX) / 2, (HARBOR.maxZ - 8) / 2);
    water('town-river', RIVER.maxX - RIVER.minX, RIVER.maxZ - RIVER.minZ, (RIVER.minX + RIVER.maxX) / 2, (RIVER.minZ + RIVER.maxZ) / 2);
    water('town-beach', BEACH.maxX + 6, 60, 4, 80);

    // Upper terrace plateau + a stair flight.
    const terr = MeshBuilder.CreateBox('town-terrace', { width: TERRACE.maxX - TERRACE.minX, height: TERRACE.y, depth: 128 - TERRACE.plateauMinZ }, scene);
    terr.position.set((TERRACE.minX + TERRACE.maxX) / 2, TERRACE.y / 2, (TERRACE.plateauMinZ + 128) / 2);
    terr.material = flatMaterial(scene, 'town-terrace', PALETTE.cliff, 0.18);
    terr.isPickable = false;
    this.register(terr, 'render');
    for (let i = 0; i < 8; i++) {
      const step = MeshBuilder.CreateBox(`town-stair-${i}`, { width: 10, height: 0.4 * (i + 1), depth: 1.25 }, scene);
      step.position.set(110, 0.2 * (i + 1), TERRACE.rampMinZ + i * 1.25);
      step.material = flatMaterial(scene, `town-stair-${i}`, PALETTE.stone, 0.18);
      step.isPickable = false;
      this.register(step, 'render');
    }

    // Harbor dock deck + a moored boat.
    const dock = MeshBuilder.CreateBox('town-dock', { width: DOCK.maxX - DOCK.minX, height: 0.2, depth: DOCK.maxZ - DOCK.minZ }, scene);
    dock.position.set((DOCK.minX + DOCK.maxX) / 2, DOCK.deckY, (DOCK.minZ + DOCK.maxZ) / 2);
    dock.material = flatMaterial(scene, 'town-dock', PALETTE.wood, 0.22);
    dock.isPickable = false;
    this.register(dock, 'render');
    const boat = MeshBuilder.CreateBox('town-boat', { width: 2.4, height: 0.8, depth: 5 }, scene);
    boat.position.set(70, 0.2, 14);
    boat.material = flatMaterial(scene, 'town-boat', PALETTE.roof, 0.2);
    boat.isPickable = false;
    this.register(boat, 'render');

    // River footbridge.
    const bridge = MeshBuilder.CreateBox('town-bridge', { width: RIVER.maxX - RIVER.minX + 2, height: 0.2, depth: BRIDGE.maxZ - BRIDGE.minZ }, scene);
    bridge.position.set((RIVER.minX + RIVER.maxX) / 2, BRIDGE.deckY, (BRIDGE.minZ + BRIDGE.maxZ) / 2);
    bridge.material = flatMaterial(scene, 'town-bridge', PALETTE.wood, 0.22);
    bridge.isPickable = false;
    this.register(bridge, 'render');

    // Redwood ring (boundary as geography).
    for (let i = 0; i < 14; i++) {
      const onX = i % 2 === 0;
      const x = onX ? (i / 14) * 160 : pseudo(i) < 0.5 ? 4 : 156;
      const z = onX ? 122 : (i / 14) * 120 + 4;
      const tree = MeshBuilder.CreateCylinder(`town-redwood-${i}`, { height: 12, diameterTop: 1.4, diameterBottom: 2.2 }, scene);
      tree.position.set(x, 6, z);
      tree.material = flatMaterial(scene, `town-redwood-${i}`, PALETTE.roof, 0.16);
      tree.isPickable = false;
      this.register(tree, 'render');
    }
  }

  private buildStructures(scene: Scene): void {
    const building = (id: string, b: Box, color: Color3, height: number): void => {
      const m = MeshBuilder.CreateBox(`town-${id}`, { width: b.maxX - b.minX, height, depth: b.maxZ - b.minZ }, scene);
      m.position.set((b.minX + b.maxX) / 2, height / 2, (b.minZ + b.maxZ) / 2);
      m.material = flatMaterial(scene, `town-${id}`, color, 0.2);
      this.register(m, 'render');
      const roof = MeshBuilder.CreateBox(`town-${id}-roof`, { width: b.maxX - b.minX + 1, height: 1.0, depth: b.maxZ - b.minZ + 1 }, scene);
      roof.position.set((b.minX + b.maxX) / 2, height + 0.5, (b.minZ + b.maxZ) / 2);
      roof.material = flatMaterial(scene, `town-${id}-roof`, PALETTE.roof, 0.18);
      roof.isPickable = false;
      this.register(roof, 'render');
    };
    building('community-hall', COLLISION[0], PALETTE.stone, 6.0);
    building('bakery', COLLISION[1], PALETTE.wood, 3.6);
    building('fishmonger', COLLISION[2], PALETTE.wood, 3.6);
    building('general-store', COLLISION[3], PALETTE.wood, 4.0);

    // Lighthouse on the point (the legible landmark).
    const tower = MeshBuilder.CreateCylinder('town-lighthouse', { height: 12, diameterTop: 2.4, diameterBottom: 3.6 }, scene);
    tower.position.set(140, 6, 16);
    tower.material = flatMaterial(scene, 'town-lighthouse', PALETTE.stone, 0.2);
    this.register(tower, 'render');
    const lamp = MeshBuilder.CreateBox('town-lighthouse-lamp', { width: 2.6, height: 2, depth: 2.6 }, scene);
    lamp.position.set(140, 13, 16);
    lamp.material = flatMaterial(scene, 'town-lighthouse-lamp', PALETTE.warmLight, 0.6);
    lamp.isPickable = false;
    this.register(lamp, 'render');

    // Market well.
    const well = MeshBuilder.CreateCylinder('town-well', { height: 1.0, diameter: 2.4 }, scene);
    well.position.set(80, 0.5, 52);
    well.material = flatMaterial(scene, 'town-well', PALETTE.stone, 0.2);
    this.register(well, 'render');
  }

  private buildMarket(scene: Scene): void {
    // Canvas-canopy produce stalls along the lane (market vocabulary, §1.4 — no
    // sport gear). Canopies use the `hanging` flora family so they luff in wind.
    const stallXs = [50, 64, 88, 102, 116];
    for (const [i, sx] of stallXs.entries()) {
      const sz = 44 + (i % 2) * 6;
      const table = MeshBuilder.CreateBox(`town-stall-${i}`, { width: 2.4, height: 1.0, depth: 1.4 }, scene);
      table.position.set(sx, 0.5, sz);
      table.material = flatMaterial(scene, `town-stall-${i}`, PALETTE.wood, 0.22);
      table.isPickable = false;
      this.register(table, 'render');
      const canopy = MeshBuilder.CreateBox(`town-canopy-${i}`, { width: 3.0, height: 0.15, depth: 2.0 }, scene);
      canopy.setPivotPoint(new Vector3(0, 0, -1.0));
      canopy.position.set(sx, 2.2, sz - 0.4);
      canopy.material = flatMaterial(scene, `town-canopy-${i}`, i % 2 ? PALETTE.accent : PALETTE.warmLight, 0.3);
      canopy.isPickable = false;
      this.register(canopy, 'render');
      this.flora.push({ mesh: canopy, phase: pseudo(i + 1) * Math.PI * 2 });
    }
  }

  private buildTownsfolk(scene: Scene): void {
    for (const [i, start] of [{ x: 64, z: 44 }, { x: 96, z: 50 }].entries()) {
      const npc = MeshBuilder.CreateCapsule(`town-folk-${i}`, { height: PLAYER_HEIGHT, radius: PLAYER_RADIUS }, scene);
      npc.position.set(start.x, PLAYER_HEIGHT / 2, start.z);
      npc.material = flatMaterial(scene, `town-folk-${i}`, i ? PALETTE.accent : PALETTE.warmLight, 0.3);
      this.register(npc, 'render');
      this.townsfolk.push({ mesh: npc, motor: createMotorState({ x: start.x, y: PLAYER_HEIGHT / 2, z: start.z }), seed: 20 + i * 7 });
    }
  }

  private cameraVolumes(): CameraVolume[] {
    return BALLAST_BAY_DISTRICT_BLOCKOUT.cameraVolumes.map((v) => ({
      id: v.id, min: v.min, max: v.max, profileId: v.profileId, priority: v.priority,
      ...(v.fallbackProfileId ? { fallbackProfileId: v.fallbackProfileId } : {}),
      ...(v.blendBoundary !== undefined ? { blendBoundary: v.blendBoundary } : {}),
    }));
  }

  private buildDebugLayers(scene: Scene): void {
    for (const b of COLLISION) {
      const m = MeshBuilder.CreateBox(`dbg-col-${b.id}`, { width: Math.max(0.5, b.maxX - b.minX), height: 3, depth: Math.max(0.5, b.maxZ - b.minZ) }, scene);
      m.position.set((b.minX + b.maxX) / 2, 1.5, (b.minZ + b.maxZ) / 2);
      const mat = flatMaterial(scene, `dbg-col-${b.id}`, new Color3(0.9, 0.2, 0.2), 0.5);
      mat.alpha = 0.25;
      m.material = mat;
      m.isPickable = false;
      m.setEnabled(false);
      this.register(m, 'collision');
    }
    for (const n of BALLAST_BAY_DISTRICT_BLOCKOUT.navigation) {
      const m = MeshBuilder.CreateGround(`dbg-nav-${n.id}`, { width: Math.max(2, n.width), height: 60 }, scene);
      m.position.set(80, 0.05, 50);
      const mat = flatMaterial(scene, `dbg-nav-${n.id}`, new Color3(0.2, 0.8, 0.3), 0.5);
      mat.alpha = 0.2;
      m.material = mat;
      m.isPickable = false;
      m.setEnabled(false);
      this.register(m, 'nav');
    }
    for (const a of BALLAST_BAY_DISTRICT_BLOCKOUT.anchors) {
      const m = MeshBuilder.CreateCylinder(`dbg-anchor-${a.id}`, { height: 2, diameter: 0.4 }, scene);
      m.position.set(a.at.x, 1, a.at.z);
      m.material = flatMaterial(scene, `dbg-anchor-${a.id}`, new Color3(0.95, 0.85, 0.2), 0.6);
      m.isPickable = false;
      m.setEnabled(false);
      this.register(m, 'anchor');
    }
    for (const v of BALLAST_BAY_DISTRICT_BLOCKOUT.cameraVolumes) {
      const m = MeshBuilder.CreateBox(`dbg-vol-${v.id}`, { width: v.max.x - v.min.x, height: Math.max(1, v.max.y - v.min.y), depth: v.max.z - v.min.z }, scene);
      m.position.set((v.min.x + v.max.x) / 2, (v.min.y + v.max.y) / 2, (v.min.z + v.max.z) / 2);
      const mat = flatMaterial(scene, `dbg-vol-${v.id}`, new Color3(0.3, 0.5, 0.95), 0.5);
      mat.alpha = 0.15;
      m.material = mat;
      m.isPickable = false;
      m.setEnabled(false);
      this.register(m, 'volume');
    }
  }

  private setLayer(layer: TownLayer, on: boolean): void {
    for (const m of this.layers.get(layer) ?? []) m.setEnabled(on);
  }

  private installDebugApi(): void {
    const api = {
      region: (): string => BALLAST_BAY_DISTRICT_BLOCKOUT.coordinateFrame.regionId,
      meshCount: (): number => this.scene.meshes.length,
      anchors: (): string[] => BALLAST_BAY_DISTRICT_BLOCKOUT.anchors.map((a) => a.id),
      chunkCount: (): number => BALLAST_BAY_DISTRICT_BLOCKOUT.chunks.length,
      layerCount: (l: TownLayer): number => this.layers.get(l)?.length ?? 0,
      enabledCount: (l: TownLayer): number => (this.layers.get(l) ?? []).filter((m) => m.isEnabled()).length,
      setLayer: (l: TownLayer, on: boolean): void => this.setLayer(l, on),
      player: (): { x: number; z: number; y: number; facing: number; medium: string } => ({
        x: this.motor.position.x, z: this.motor.position.z, y: this.motor.position.y, facing: this.motor.facing, medium: this.motor.medium,
      }),
      setPlayer: (x: number, z: number, facing?: number): void => {
        this.motor = groundedPoseAt(x, z, townGroundY(x, z), facing ?? this.motor.facing);
        this.syncPlayer();
      },
      setMove: (x: number, z: number): void => { this.moveX = x; this.moveZ = z; },
      cameraState: (): CameraRigState => this.rig.getState(),
      townsfolk: (): Array<{ x: number; z: number; inLane: boolean }> => this.townsfolk.map((t) => ({
        x: t.motor.position.x, z: t.motor.position.z, inLane: inBox(LANE, t.motor.position.x, t.motor.position.z),
      })),
      canopyAngles: (): number[] => this.flora.map((f) => f.mesh.rotation.z),
      clockMinutes: (): number => this.clockMinutes,
      npcToken: (): string => this.npcToken,
      atGate: (): boolean => this.nearGate(),
      pressAction: (): boolean => this.pressAction(),
      tick: (n = 1): void => {
        for (let i = 0; i < n; i++) { this.step(FIXED_DT); this.rig.update(FIXED_DT, ZERO_INPUT); }
      },
    };
    (window as unknown as { sturdyVolleyTown?: typeof api }).sturdyVolleyTown = api;
  }
}
