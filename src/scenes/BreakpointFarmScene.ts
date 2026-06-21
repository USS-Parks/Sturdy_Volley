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
import { BREAKPOINT_FARM_BLOCKOUT } from '../world/blockouts/breakpoint-farm';
import { familyOf } from '../engine/animal-families';
import { floraFamily, swayAngle, DEFAULT_WIND } from '../engine/flora-motion';
import {
  DEFAULT_CLOCK_MINUTES,
  NPC_STATE_TOKEN,
  type RegionTransitionData,
} from '../world/region-transition';

/**
 * Breakpoint Farm — production-foundation map I exterior (WEF-10a, master Prompt
 * 046). Graybox built from the dimensioned blockout
 * (`src/world/blockouts/breakpoint-farm.ts`, grounded in
 * `sv_map_012_breakpoint_farm_layout.png` + the morning mood of
 * `sv_env_041_breakpoint_morning.png`) over production collision, navigation,
 * anchor, camera-volume, and transition data — driven by the shared camera rig,
 * kinematic motor, and interaction stack.
 *
 * Demonstrates the farm's required cases: farming (irrigated crop quadrants with
 * flora motion), elevation + traversal (orchard bluff + stairs, creek footbridge,
 * pond wade), camera (the farmyard + orchard-bluff authored volumes), and
 * NPC/fauna (a pasture goat). Boundaries read as geography (redwood ring, ocean
 * cliff), not arbitrary walls. The farmhouse **door** transitions to the
 * Farmhouse interior preserving anchor / facing / camera / clock / NPC state. No
 * central court/net (§1.4 sports purge).
 *
 * Reachable via the Title "Dev · Breakpoint Farm" item or `?scene=BreakpointFarm`.
 */

const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.4;
const WALK_SPEED = 3.6;
const FIXED_DT = 1 / 30;

/** Debug layers each toggle independently in the debug view (acceptance §3). */
export type FarmLayer = 'render' | 'collision' | 'nav' | 'anchor' | 'volume';

/** Solid collision proxies (AABB, world m). Buildings, well, fences, ocean cliff. */
interface Box {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
const COLLISION: Box[] = [
  { id: 'farmhouse', minX: 50, maxX: 62, minZ: 48, maxZ: 60 },
  { id: 'shed', minX: 18, maxX: 30, minZ: 40, maxZ: 48 },
  { id: 'greenhouse', minX: 34, maxX: 46, minZ: 76, maxZ: 84 },
  { id: 'well', minX: 62.5, maxX: 65.5, minZ: 58.5, maxZ: 61.5 },
  // Pasture enclosure (gate gap on the west at z≈40).
  { id: 'pasture-n', minX: 74, maxX: 118, minZ: 53, maxZ: 54 },
  { id: 'pasture-s', minX: 74, maxX: 118, minZ: 26, maxZ: 27 },
  { id: 'pasture-e', minX: 117, maxX: 118, minZ: 26, maxZ: 54 },
  { id: 'pasture-w1', minX: 74, maxX: 75, minZ: 26, maxZ: 38 },
  { id: 'pasture-w2', minX: 74, maxX: 75, minZ: 42, maxZ: 54 },
  // Ocean cliff along the east edge — geography, not an arbitrary wall.
  { id: 'ocean-cliff', minX: 123, maxX: 128, minZ: 0, maxZ: 128 },
];

/** Orchard bluff: a raised plateau on the east, reached by a stair ramp. */
const BLUFF = { minX: 104, maxX: 122, minZ: 40, maxZ: 92, y: 2.0, rampMinX: 98 };
/** Pond (wade) + creek ford (wade) water columns. */
const POND = { minX: 16, maxX: 34, minZ: 88, maxZ: 104, surfaceY: 0.15, bedY: -0.4 };
const CREEK = { minX: 58, maxX: 70, minZ: 104, maxZ: 120, surfaceY: 0.1, bedY: -0.35 };
/** Pasture bounds the goat wanders within. */
const PASTURE = { minX: 76, maxX: 116, minZ: 28, maxZ: 52 };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
function inBox(b: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number): boolean {
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}

/** Ground height: flat farmyard, rising to the orchard bluff via a stair ramp. */
function farmGroundY(x: number, z: number): number {
  if (z >= BLUFF.minZ && z <= BLUFF.maxZ) {
    if (x >= BLUFF.minX) return BLUFF.y;
    if (x >= BLUFF.rampMinX) return lerp(0, BLUFF.y, (x - BLUFF.rampMinX) / (BLUFF.minX - BLUFF.rampMinX));
  }
  return 0;
}
function farmWater(x: number, z: number): WaterColumn | undefined {
  if (inBox(POND, x, z)) return { surfaceY: POND.surfaceY, bedY: POND.bedY };
  if (inBox(CREEK, x, z)) return { surfaceY: CREEK.surfaceY, bedY: CREEK.bedY };
  return undefined;
}

/** Nearest collide-and-slide wall among the AABB collision proxies. */
function aabbWall(pos: { x: number; z: number }, radius: number, moveDir: { x: number; z: number }, mag: number): WallHit {
  let best: WallHit = { hit: false, distance: Number.POSITIVE_INFINITY, normal: { x: 0, y: 0, z: 0 } };
  for (const b of COLLISION) {
    const minX = b.minX - radius;
    const maxX = b.maxX + radius;
    const minZ = b.minZ - radius;
    const maxZ = b.maxZ + radius;
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

interface FloraInst {
  mesh: Mesh;
  phase: number;
  familyId: 'crop' | 'grass';
}

export class BreakpointFarmScene extends GameScene {
  private rig!: CameraRig;
  private input: CameraInputController | null = null;
  private playerMesh!: Mesh;
  private motor!: MotorState;
  private velocity: Planar = { x: 0, z: 0 };
  private moveX = 0;
  private moveZ = 0;

  private readonly layers = new Map<FarmLayer, Mesh[]>([
    ['render', []], ['collision', []], ['nav', []], ['anchor', []], ['volume', []],
  ]);
  private readonly flora: FloraInst[] = [];
  private goatMesh!: Mesh;
  private goatMotor!: MotorState;
  private goatSeed = 5;
  private time = 0;

  // Preserved-across-transition state.
  private clockMinutes = DEFAULT_CLOCK_MINUTES;
  private npcToken = NPC_STATE_TOKEN;
  private returnAnchor: { x: number; z: number; facing: number } | null = null;
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
    this.buildPastureAndFauna(scene);
    this.buildCrops(scene);
    this.buildDebugLayers(scene);

    const player = MeshBuilder.CreateCapsule('farm-player', { height: PLAYER_HEIGHT, radius: PLAYER_RADIUS }, scene);
    player.material = flatMaterial(scene, 'farm-player', PALETTE.player, 0.35);
    player.isPickable = false;
    this.playerMesh = player;
    this.motor = groundedPoseAt(56, 44, farmGroundY(56, 44), Math.PI);
    this.syncPlayer();

    // Shared camera rig + the blockout's authored volumes.
    this.rig = new CameraRig(scene, baselineProfile('farm'), -Math.PI / 2);
    const follow: FollowTarget = {
      position: () => new Vector3(this.motor.position.x, this.motor.position.y + 0.6, this.motor.position.z),
      velocity: () => this.velocity,
      ignore: (): readonly AbstractMesh[] => [this.playerMesh, this.goatMesh],
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
      this.motor = groundedPoseAt(t.toAnchor.x, t.toAnchor.z, farmGroundY(t.toAnchor.x, t.toAnchor.z), t.facing);
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
    delete (window as unknown as { sturdyVolleyFarm?: unknown }).sturdyVolleyFarm;
    super.dispose();
  }

  // --- Simulation -----------------------------------------------------------

  private readKeys(): void {
    const fwd = (this.held.has('w') || this.held.has('arrowup') ? 1 : 0) - (this.held.has('s') || this.held.has('arrowdown') ? 1 : 0);
    const str = (this.held.has('d') || this.held.has('arrowright') ? 1 : 0) - (this.held.has('a') || this.held.has('arrowleft') ? 1 : 0);
    if (fwd === 0 && str === 0) {
      this.moveX = 0;
      this.moveZ = 0;
      return;
    }
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
    this.stepGoat(dt);
    this.animateFlora();
  }

  private envAt(motor: MotorState, moveDir: { x: number; z: number }, mag: number, radius: number): MotorEnvironment {
    const x = motor.position.x;
    const z = motor.position.z;
    return {
      ground: { hit: true, groundY: farmGroundY(x, z), normal: { x: 0, y: 1, z: 0 } },
      wall: aabbWall({ x, z }, radius, moveDir, mag),
      stepGround: NO_GROUND,
      ceiling: NO_CEILING,
      water: farmWater(x, z),
    };
  }

  private stepGoat(dt: number): void {
    this.goatSeed += 1;
    const tx = pseudo(this.goatSeed) * (PASTURE.maxX - PASTURE.minX) + PASTURE.minX;
    const tz = pseudo(this.goatSeed + 13) * (PASTURE.maxZ - PASTURE.minZ) + PASTURE.minZ;
    const pos = { x: this.goatMotor.position.x, z: this.goatMotor.position.z };
    const dir = { x: tx - pos.x, z: tz - pos.z };
    const d = Math.hypot(dir.x, dir.z);
    const moveDir = d > 0.5 ? { x: dir.x / d, z: dir.z / d } : { x: 0, z: 0 };
    const env: MotorEnvironment = { ground: { hit: true, groundY: 0, normal: { x: 0, y: 1, z: 0 } }, wall: { hit: false, distance: Infinity, normal: { x: 0, y: 0, z: 0 } }, stepGround: NO_GROUND, ceiling: NO_CEILING };
    this.goatMotor = stepMotor(this.goatMotor, { moveDir, speed: d > 0.5 ? 1.2 : 0 }, env, dt);
    // Pasture recovery: the goat never leaves its fence.
    this.goatMotor.position.x = Math.max(PASTURE.minX, Math.min(PASTURE.maxX, this.goatMotor.position.x));
    this.goatMotor.position.z = Math.max(PASTURE.minZ, Math.min(PASTURE.maxZ, this.goatMotor.position.z));
    this.goatMesh.position.set(this.goatMotor.position.x, 0.45, this.goatMotor.position.z);
    this.goatMesh.rotation.y = this.goatMotor.facing;
  }

  private animateFlora(): void {
    for (const f of this.flora) {
      f.mesh.rotation.z = swayAngle(floraFamily(f.familyId), f.phase, this.time, DEFAULT_WIND);
    }
  }

  private syncPlayer(): void {
    this.playerMesh.position.set(this.motor.position.x, this.motor.position.y, this.motor.position.z);
    this.playerMesh.rotation.y = this.motor.facing;
  }

  // --- Interaction + transition ---------------------------------------------

  private anchorAt(id: string): { x: number; z: number } | null {
    const a = BREAKPOINT_FARM_BLOCKOUT.anchors.find((n) => n.id === id);
    return a ? { x: a.at.x, z: a.at.z } : null;
  }

  private nearFarmhouseDoor(): boolean {
    const d = this.anchorAt('farmhouse-door');
    if (!d) return false;
    return Math.hypot(this.motor.position.x - d.x, this.motor.position.z - d.z) <= 2.2;
  }

  private pressAction(): boolean {
    if (this.transitioning) return false;
    if (this.nearFarmhouseDoor()) {
      this.transitioning = true;
      // Return to the yard side of the door, facing into the yard (−Z).
      this.returnAnchor = { x: 56, z: 45, facing: Math.PI };
      const data: RegionTransitionData = {
        toAnchor: { x: 0, z: 1.5 }, // farmhouse interior maps this to its door
        facing: 0,
        cameraContext: 'smallInterior',
        clockMinutes: this.clockMinutes,
        npcToken: this.npcToken,
        returnRegion: 'BreakpointFarm',
        returnAnchor: this.returnAnchor,
      };
      void this.ctx.manager.goTo('FarmhouseInterior', data);
      return true;
    }
    return false;
  }

  // --- Geometry -------------------------------------------------------------

  private register(mesh: Mesh, layer: FarmLayer): Mesh {
    mesh.metadata = { layer };
    this.layers.get(layer)!.push(mesh);
    return mesh;
  }

  private buildTerrain(scene: Scene): void {
    const ground = MeshBuilder.CreateGround('farm-ground', { width: 140, height: 140 }, scene);
    ground.position.set(64, 0, 64);
    ground.material = flatMaterial(scene, 'farm-ground', PALETTE.grass, 0.2);
    ground.isPickable = false;
    this.register(ground, 'render');

    // Orchard bluff plateau + stair ramp (elevation + traversal).
    const bluff = MeshBuilder.CreateBox('farm-bluff', { width: BLUFF.maxX - BLUFF.minX, height: BLUFF.y, depth: BLUFF.maxZ - BLUFF.minZ }, scene);
    bluff.position.set((BLUFF.minX + BLUFF.maxX) / 2, BLUFF.y / 2, (BLUFF.minZ + BLUFF.maxZ) / 2);
    bluff.material = flatMaterial(scene, 'farm-bluff', PALETTE.grassAlt, 0.2);
    bluff.isPickable = false;
    this.register(bluff, 'render');

    // Pond + creek water planes (wade).
    for (const [name, w] of [['farm-pond', POND], ['farm-creek', CREEK]] as const) {
      const water = MeshBuilder.CreateGround(name, { width: w.maxX - w.minX, height: w.maxZ - w.minZ }, scene);
      water.position.set((w.minX + w.maxX) / 2, w.surfaceY, (w.minZ + w.maxZ) / 2);
      const mat = flatMaterial(scene, name, PALETTE.sea, 0.4);
      mat.alpha = 0.7;
      water.material = mat;
      water.isPickable = false;
      this.register(water, 'render');
    }

    // Creek footbridge (traversal vocabulary).
    const bridge = MeshBuilder.CreateBox('farm-bridge', { width: 2.4, height: 0.2, depth: CREEK.maxZ - CREEK.minZ + 2 }, scene);
    bridge.position.set(64, 0.3, (CREEK.minZ + CREEK.maxZ) / 2);
    bridge.material = flatMaterial(scene, 'farm-bridge', PALETTE.wood, 0.22);
    bridge.isPickable = false;
    this.register(bridge, 'render');

    // Redwood ring — reads as the forest boundary (not an arbitrary wall).
    for (let i = 0; i < 16; i++) {
      const edge = i / 16;
      const onX = i % 2 === 0;
      const x = onX ? edge * 128 : pseudo(i) < 0.5 ? 4 : 124;
      const z = onX ? (pseudo(i + 7) < 0.5 ? 4 : 124) : edge * 128;
      const tree = MeshBuilder.CreateCylinder(`farm-redwood-${i}`, { height: 12, diameterTop: 1.4, diameterBottom: 2.2 }, scene);
      tree.position.set(x, 6, z);
      tree.material = flatMaterial(scene, `farm-redwood-${i}`, PALETTE.roof, 0.16);
      tree.isPickable = false;
      this.register(tree, 'render');
    }
  }

  private buildStructures(scene: Scene): void {
    const building = (id: string, b: Box, color: Color3, height: number): void => {
      const m = MeshBuilder.CreateBox(`farm-${id}`, { width: b.maxX - b.minX, height, depth: b.maxZ - b.minZ }, scene);
      m.position.set((b.minX + b.maxX) / 2, height / 2, (b.minZ + b.maxZ) / 2);
      m.material = flatMaterial(scene, `farm-${id}`, color, 0.2);
      this.register(m, 'render');
    };
    building('farmhouse', COLLISION[0], PALETTE.wood, 4.5);
    building('shed', COLLISION[1], PALETTE.roof, 3.0);
    building('greenhouse', COLLISION[2], PALETTE.stone, 2.8);
    // Roof caps for silhouette (rounded timber reading).
    const roof = MeshBuilder.CreateBox('farm-farmhouse-roof', { width: 13, height: 1.2, depth: 13 }, scene);
    roof.position.set(56, 5.0, 54);
    roof.material = flatMaterial(scene, 'farm-farmhouse-roof', PALETTE.roof, 0.18);
    roof.isPickable = false;
    this.register(roof, 'render');
    // Farmhouse door marker on the south face.
    const door = MeshBuilder.CreateBox('farm-farmhouse-door', { width: 1.4, height: 2.2, depth: 0.2 }, scene);
    door.position.set(56, 1.1, 48);
    door.material = flatMaterial(scene, 'farm-farmhouse-door', PALETTE.interior, 0.3);
    door.isPickable = false;
    this.register(door, 'render');
    // Well (interaction landmark).
    const well = MeshBuilder.CreateCylinder('farm-well', { height: 1.0, diameter: 2.4 }, scene);
    well.position.set(64, 0.5, 60);
    well.material = flatMaterial(scene, 'farm-well', PALETTE.stone, 0.2);
    this.register(well, 'render');
  }

  private buildPastureAndFauna(scene: Scene): void {
    // Fence posts (visual; COLLISION proxies are the logical fence).
    for (let i = 0; i <= 10; i++) {
      const post = MeshBuilder.CreateBox(`farm-fence-${i}`, { width: 0.2, height: 1.1, depth: 0.2 }, scene);
      post.position.set(74 + (i / 10) * 44, 0.55, 28);
      post.material = flatMaterial(scene, `farm-fence-${i}`, PALETTE.wood, 0.2);
      post.isPickable = false;
      this.register(post, 'render');
    }
    // Pasture goat (NPC / fauna case) — grazing-livestock family proxy.
    const goatFam = familyOf('grazing-livestock');
    const goat = MeshBuilder.CreateCapsule('farm-goat', { height: goatFam.bodyProxyHeight, radius: goatFam.bodyProxyRadius }, scene);
    goat.material = flatMaterial(scene, 'farm-goat', PALETTE.stone, 0.3);
    goat.position.set(96, 0.45, 40);
    this.goatMesh = goat;
    this.goatMotor = createMotorState({ x: 96, y: goatFam.bodyProxyHeight / 2, z: 40 });
    this.register(goat, 'render');
  }

  private buildCrops(scene: Scene): void {
    // Quadrant crop field with irrigation channels (farming + flora-motion).
    for (let qx = 0; qx < 2; qx++) {
      for (let qz = 0; qz < 2; qz++) {
        const cx = 52 + qx * 16;
        const cz = 52 + qz * 16;
        for (let i = 0; i < 9; i++) {
          const x = cx + (i % 3) * 3 - 3;
          const z = cz + Math.floor(i / 3) * 3 - 3;
          const m = MeshBuilder.CreateBox(`farm-crop-${qx}-${qz}-${i}`, { width: 0.3, height: 1.0, depth: 0.3 }, scene);
          m.setPivotPoint(new Vector3(0, -0.5, 0));
          m.position.set(x, 0.5, z);
          m.material = flatMaterial(scene, `farm-crop-${qx}-${qz}-${i}`, PALETTE.warmLight, 0.35);
          m.isPickable = false;
          this.register(m, 'render');
          this.flora.push({ mesh: m, phase: pseudo(this.flora.length + 1) * Math.PI * 2, familyId: 'crop' });
        }
      }
    }
    // Grass tufts along the desire lines (environmental motion).
    for (let i = 0; i < 24; i++) {
      const x = 40 + pseudo(i + 100) * 48;
      const z = 30 + pseudo(i + 200) * 60;
      const m = MeshBuilder.CreateBox(`farm-grass-${i}`, { width: 0.12, height: 0.8, depth: 0.12 }, scene);
      m.setPivotPoint(new Vector3(0, -0.4, 0));
      m.position.set(x, 0.4, z);
      m.material = flatMaterial(scene, `farm-grass-${i}`, PALETTE.grassAlt, 0.4);
      m.isPickable = false;
      this.register(m, 'render');
      this.flora.push({ mesh: m, phase: pseudo(i + 300) * Math.PI * 2, familyId: 'grass' });
    }
  }

  private cameraVolumes(): CameraVolume[] {
    return BREAKPOINT_FARM_BLOCKOUT.cameraVolumes.map((v) => ({
      id: v.id,
      min: v.min,
      max: v.max,
      profileId: v.profileId,
      priority: v.priority,
      ...(v.fallbackProfileId ? { fallbackProfileId: v.fallbackProfileId } : {}),
      ...(v.blendBoundary !== undefined ? { blendBoundary: v.blendBoundary } : {}),
    }));
  }

  /** Debug-only visualisation meshes for the non-render layers (hidden by default). */
  private buildDebugLayers(scene: Scene): void {
    // Collision proxies (translucent red boxes).
    for (const b of COLLISION) {
      const m = MeshBuilder.CreateBox(`dbg-col-${b.id}`, { width: b.maxX - b.minX, height: 3, depth: b.maxZ - b.minZ }, scene);
      m.position.set((b.minX + b.maxX) / 2, 1.5, (b.minZ + b.maxZ) / 2);
      const mat = flatMaterial(scene, `dbg-col-${b.id}`, new Color3(0.9, 0.2, 0.2), 0.5);
      mat.alpha = 0.25;
      m.material = mat;
      m.isPickable = false;
      m.setEnabled(false);
      this.register(m, 'collision');
    }
    // Navigation patches (flat green planes from the blockout nav refs).
    for (const n of BREAKPOINT_FARM_BLOCKOUT.navigation) {
      const m = MeshBuilder.CreateGround(`dbg-nav-${n.id}`, { width: Math.max(2, n.width), height: 60 }, scene);
      m.position.set(56, 0.05, 64);
      const mat = flatMaterial(scene, `dbg-nav-${n.id}`, new Color3(0.2, 0.8, 0.3), 0.5);
      mat.alpha = 0.2;
      m.material = mat;
      m.isPickable = false;
      m.setEnabled(false);
      this.register(m, 'nav');
    }
    // Anchor markers (yellow posts).
    for (const a of BREAKPOINT_FARM_BLOCKOUT.anchors) {
      const m = MeshBuilder.CreateCylinder(`dbg-anchor-${a.id}`, { height: 2, diameter: 0.4 }, scene);
      m.position.set(a.at.x, 1, a.at.z);
      m.material = flatMaterial(scene, `dbg-anchor-${a.id}`, new Color3(0.95, 0.85, 0.2), 0.6);
      m.isPickable = false;
      m.setEnabled(false);
      this.register(m, 'anchor');
    }
    // Camera-volume bounds (blue wire-ish boxes).
    for (const v of BREAKPOINT_FARM_BLOCKOUT.cameraVolumes) {
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

  private setLayer(layer: FarmLayer, on: boolean): void {
    for (const m of this.layers.get(layer) ?? []) m.setEnabled(on);
  }

  // --- Debug API ------------------------------------------------------------

  private installDebugApi(): void {
    const api = {
      region: (): string => BREAKPOINT_FARM_BLOCKOUT.coordinateFrame.regionId,
      meshCount: (): number => this.scene.meshes.length,
      anchors: (): string[] => BREAKPOINT_FARM_BLOCKOUT.anchors.map((a) => a.id),
      chunkCount: (): number => BREAKPOINT_FARM_BLOCKOUT.chunks.length,
      layerCount: (layer: FarmLayer): number => this.layers.get(layer)?.length ?? 0,
      enabledCount: (layer: FarmLayer): number => (this.layers.get(layer) ?? []).filter((m) => m.isEnabled()).length,
      setLayer: (layer: FarmLayer, on: boolean): void => this.setLayer(layer, on),
      player: (): { x: number; z: number; y: number; facing: number; medium: string; grounded: boolean } => ({
        x: this.motor.position.x, z: this.motor.position.z, y: this.motor.position.y,
        facing: this.motor.facing, medium: this.motor.medium, grounded: this.motor.grounded,
      }),
      setPlayer: (x: number, z: number, facing?: number): void => {
        this.motor = groundedPoseAt(x, z, farmGroundY(x, z), facing ?? this.motor.facing);
        this.syncPlayer();
      },
      setMove: (x: number, z: number): void => { this.moveX = x; this.moveZ = z; },
      cameraState: (): CameraRigState => this.rig.getState(),
      goat: (): { x: number; z: number; inPasture: boolean } => ({
        x: this.goatMotor.position.x, z: this.goatMotor.position.z,
        inPasture: inBox(PASTURE, this.goatMotor.position.x, this.goatMotor.position.z),
      }),
      cropAngles: (): number[] => this.flora.filter((f) => f.familyId === 'crop').map((f) => f.mesh.rotation.z),
      clockMinutes: (): number => this.clockMinutes,
      npcToken: (): string => this.npcToken,
      atFarmhouseDoor: (): boolean => this.nearFarmhouseDoor(),
      pressAction: (): boolean => this.pressAction(),
      tick: (n = 1): void => {
        for (let i = 0; i < n; i++) {
          this.step(FIXED_DT);
          this.rig.update(FIXED_DT, ZERO_INPUT);
        }
      },
    };
    (window as unknown as { sturdyVolleyFarm?: typeof api }).sturdyVolleyFarm = api;
  }
}
