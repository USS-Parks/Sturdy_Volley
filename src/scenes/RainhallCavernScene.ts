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
  beginTraversal,
  NO_CEILING,
  NO_GROUND,
  type MotorState,
  type MotorEnvironment,
  type WallHit,
  type WaterColumn,
} from '../engine/motor';
import { familyOf } from '../engine/animal-families';
import {
  DEFAULT_CLOCK_MINUTES,
  NPC_STATE_TOKEN,
  type RegionTransitionData,
} from '../world/region-transition';

/**
 * Rainhall Caverns — production-foundation map IV, the cave slice (WEF-10c-ii,
 * master Prompt 049). Graybox from `sv_map_019_rainhall_caverns_layout.png` +
 * `sv_env_055_cavern_lantern_pool.png`: a **tight entrance passage**, an **open
 * lantern-lit chamber** around the luminous **mineral-spring pool** (the landmark)
 * with stepping stones, a **slope/stair** up to an upper ledge, an authored
 * **ledge-link** climb (the motor's scripted traversal — no free jump), echo
 * **cave creatures** in the combat/navigation space, and a **sea-cave mouth** that
 * transitions to Ballast Bay Town.
 *
 * Camera uses the **cave** context with a tight→open framing swing (a `cave:near`
 * volume in the entrance passage over the `cave:standard` base). Boundaries read as
 * geography (rock walls, crystal seams). Built on the shared camera-rig +
 * kinematic-motor + interaction stack; five debug layers toggle independently.
 *
 * Reachable via the Title "Dev · Rainhall Caverns" item or `?scene=RainhallCavern`.
 */

const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.4;
const WALK_SPEED = 3.2;
const FIXED_DT = 1 / 30;

export type CaveLayer = 'render' | 'collision' | 'nav' | 'anchor' | 'volume';

interface Anchor { id: string; kind: string; x: number; z: number; facing?: number }
const ANCHORS: Anchor[] = [
  { id: 'cave-entrance', kind: 'region-edge', x: 32, z: 4, facing: 0 },
  { id: 'mineral-pool', kind: 'landmark', x: 30, z: 27 },
  { id: 'stair-base', kind: 'elevation-link', x: 50, z: 35 },
  { id: 'ledge-link-base', kind: 'traversal', x: 44, z: 38 },
  { id: 'ledge-link-top', kind: 'traversal', x: 44, z: 44 },
  { id: 'cave-mouth', kind: 'region-edge', x: 60, z: 25, facing: Math.PI },
];

interface Box { id: string; minX: number; maxX: number; minZ: number; maxZ: number }
const COLLISION: Box[] = [
  // Outer rock walls (entrance gap x[30,34], cave-mouth gap z[20,30] on the east).
  { id: 'wall-s-w', minX: 0, maxX: 30, minZ: 0, maxZ: 2 },
  { id: 'wall-s-e', minX: 34, maxX: 64, minZ: 0, maxZ: 2 },
  { id: 'wall-n', minX: 0, maxX: 64, minZ: 62, maxZ: 64 },
  { id: 'wall-w', minX: 0, maxX: 2, minZ: 0, maxZ: 64 },
  { id: 'wall-e-s', minX: 62, maxX: 64, minZ: 0, maxZ: 20 },
  { id: 'wall-e-n', minX: 62, maxX: 64, minZ: 30, maxZ: 64 },
  // Tight entrance passage.
  { id: 'tight-w', minX: 28, maxX: 30, minZ: 2, maxZ: 14 },
  { id: 'tight-e', minX: 34, maxX: 36, minZ: 2, maxZ: 14 },
];

/** Upper ledge plateau (NE) + a stair ramp. */
const LEDGE = { minX: 42, maxX: 58, plateauMinZ: 40, rampMinZ: 34, y: 2.5 };
/** Mineral-spring pool (wade) with dry stepping stones. */
const POOL = { minX: 20, maxX: 40, minZ: 20, maxZ: 34, surfaceY: 0.2, bedY: -0.3 };
const STONES: Array<{ x: number; z: number }> = [{ x: 24, z: 27 }, { x: 30, z: 27 }, { x: 36, z: 27 }];
const STONE_R = 1.4;
/** Tight passage camera volume (the tight→open swing). */
const TIGHT_VOL: CameraVolume = {
  id: 'vol-tight-passage', min: { x: 28, y: -1, z: 0 }, max: { x: 36, y: 6, z: 16 },
  profileId: 'cave:near', priority: 14, blendBoundary: 0.6,
};

function lerp(a: number, b: number, t: number): number { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function inBox(b: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number): boolean {
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}
function onStone(x: number, z: number): boolean {
  return STONES.some((s) => Math.hypot(x - s.x, z - s.z) <= STONE_R);
}

function cavernGroundY(x: number, z: number): number {
  if (onStone(x, z)) return 0.25;
  if (x >= LEDGE.minX && x <= LEDGE.maxX) {
    if (z >= LEDGE.plateauMinZ) return LEDGE.y;
    if (z >= LEDGE.rampMinZ) return lerp(0, LEDGE.y, (z - LEDGE.rampMinZ) / (LEDGE.plateauMinZ - LEDGE.rampMinZ));
  }
  return 0;
}
function cavernWater(x: number, z: number): WaterColumn | undefined {
  if (onStone(x, z)) return undefined;
  if (inBox(POOL, x, z)) return { surfaceY: POOL.surfaceY, bedY: POOL.bedY };
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
      const o = pos[ax]; const d = moveDir[ax];
      const lo = ax === 'x' ? minX : minZ; const hi = ax === 'x' ? maxX : maxZ;
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { miss = true; break; } continue; }
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

interface Creature { mesh: Mesh; motor: MotorState; seed: number }

export class RainhallCavernScene extends GameScene {
  private rig!: CameraRig;
  private input: CameraInputController | null = null;
  private playerMesh!: Mesh;
  private motor!: MotorState;
  private velocity: Planar = { x: 0, z: 0 };
  private moveX = 0;
  private moveZ = 0;

  private readonly layers = new Map<CaveLayer, Mesh[]>([
    ['render', []], ['collision', []], ['nav', []], ['anchor', []], ['volume', []],
  ]);
  private readonly creatures: Creature[] = [];

  private clockMinutes = DEFAULT_CLOCK_MINUTES;
  private npcToken = NPC_STATE_TOKEN;
  private transitioning = false;

  private readonly held = new Set<string>();
  private onKeyDown?: (e: KeyboardEvent) => void;
  private onKeyUp?: (e: KeyboardEvent) => void;

  build(): Scene {
    const scene = makeScene(this.ctx.engine);
    this.scene = scene;
    addFog(scene, new Color3(0.05, 0.06, 0.09), 0.02); // dark cave fog
    addLights(scene);

    this.buildCavern(scene);
    this.buildCreatures(scene);
    this.buildDebugLayers(scene);

    const player = MeshBuilder.CreateCapsule('cave-player', { height: PLAYER_HEIGHT, radius: PLAYER_RADIUS }, scene);
    player.material = flatMaterial(scene, 'cave-player', PALETTE.player, 0.4);
    player.isPickable = false;
    this.playerMesh = player;
    this.motor = groundedPoseAt(32, 6, cavernGroundY(32, 6), 0);
    this.syncPlayer();

    this.rig = new CameraRig(scene, baselineProfile('cave'), -Math.PI / 2);
    const follow: FollowTarget = {
      position: () => new Vector3(this.motor.position.x, this.motor.position.y + 0.6, this.motor.position.z),
      velocity: () => this.velocity,
      ignore: (): readonly AbstractMesh[] => [this.playerMesh, ...this.creatures.map((c) => c.mesh)],
    };
    this.rig.setTarget(follow);
    this.rig.setVolumes([TIGHT_VOL]);

    return scene;
  }

  override enter(data?: unknown): void {
    const t = data as RegionTransitionData | undefined;
    if (t && typeof t.clockMinutes === 'number') {
      this.clockMinutes = t.clockMinutes;
      this.npcToken = t.npcToken;
      this.motor = groundedPoseAt(t.toAnchor.x, t.toAnchor.z, cavernGroundY(t.toAnchor.x, t.toAnchor.z), t.facing);
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
    delete (window as unknown as { sturdyVolleyCave?: unknown }).sturdyVolleyCave;
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
    const mag = Math.hypot(this.moveX, this.moveZ);
    const moveDir = mag > 1e-4 ? { x: this.moveX / mag, z: this.moveZ / mag } : { x: 0, z: 0 };
    const env = this.envAt(this.motor, moveDir, WALK_SPEED * dt, PLAYER_RADIUS);
    this.motor = stepMotor(this.motor, { moveDir, speed: mag > 1e-4 ? WALK_SPEED : 0 }, env, dt);
    this.clampBounds(this.motor);
    this.velocity = this.motor.traversal ? { x: 0, z: 0 } : { x: moveDir.x * WALK_SPEED * (mag > 1e-4 ? 1 : 0), z: moveDir.z * WALK_SPEED * (mag > 1e-4 ? 1 : 0) };
    this.syncPlayer();
    this.stepCreatures(dt);
  }

  private envAt(motor: MotorState, moveDir: { x: number; z: number }, mag: number, radius: number): MotorEnvironment {
    const x = motor.position.x, z = motor.position.z;
    return {
      ground: { hit: true, groundY: cavernGroundY(x, z), normal: { x: 0, y: 1, z: 0 } },
      wall: aabbWall({ x, z }, radius, moveDir, mag),
      stepGround: NO_GROUND,
      ceiling: NO_CEILING,
      water: cavernWater(x, z),
    };
  }

  private clampBounds(motor: MotorState): void {
    motor.position.x = Math.max(2.5, Math.min(61.5, motor.position.x));
    motor.position.z = Math.max(2.5, Math.min(61.5, motor.position.z));
  }

  private stepCreatures(dt: number): void {
    for (const c of this.creatures) {
      c.seed += 1;
      const tx = 12 + pseudo(c.seed) * 32;
      const tz = 40 + pseudo(c.seed + 9) * 18;
      const pos = { x: c.motor.position.x, z: c.motor.position.z };
      const dir = { x: tx - pos.x, z: tz - pos.z };
      const d = Math.hypot(dir.x, dir.z);
      const moveDir = d > 0.5 ? { x: dir.x / d, z: dir.z / d } : { x: 0, z: 0 };
      const env: MotorEnvironment = { ground: { hit: true, groundY: 0, normal: { x: 0, y: 1, z: 0 } }, wall: aabbWall(pos, 0.35, moveDir, 1.0 * dt), stepGround: NO_GROUND, ceiling: NO_CEILING };
      c.motor = stepMotor(c.motor, { moveDir, speed: d > 0.5 ? 1.0 : 0 }, env, dt);
      c.motor.position.x = Math.max(8, Math.min(40, c.motor.position.x));
      c.motor.position.z = Math.max(38, Math.min(58, c.motor.position.z));
      c.mesh.position.set(c.motor.position.x, 0.3, c.motor.position.z);
      c.mesh.rotation.y = c.motor.facing;
    }
  }

  private syncPlayer(): void {
    this.playerMesh.position.set(this.motor.position.x, this.motor.position.y, this.motor.position.z);
    this.playerMesh.rotation.y = this.motor.facing;
  }

  // --- Interaction: ledge-link traversal + cave-mouth transition ------------

  private anchorAt(id: string): Anchor | undefined { return ANCHORS.find((a) => a.id === id); }
  private nearAnchor(id: string, reach: number): boolean {
    const a = this.anchorAt(id);
    return a ? Math.hypot(this.motor.position.x - a.x, this.motor.position.z - a.z) <= reach : false;
  }

  /** Authored ledge-link climb/drop (no free jump): scripted motor traversal. */
  private climbLedge(): boolean {
    if (this.motor.traversal) return false;
    if (this.nearAnchor('ledge-link-base', 2)) {
      const top = this.anchorAt('ledge-link-top')!;
      this.motor = beginTraversal(this.motor, { x: top.x, y: cavernGroundY(top.x, top.z) + PLAYER_HEIGHT / 2, z: top.z }, 'climb', 0.7);
      return true;
    }
    if (this.nearAnchor('ledge-link-top', 2)) {
      const base = this.anchorAt('ledge-link-base')!;
      this.motor = beginTraversal(this.motor, { x: base.x, y: cavernGroundY(base.x, base.z) + PLAYER_HEIGHT / 2, z: base.z }, 'drop', 0.6);
      return true;
    }
    return false;
  }

  private pressAction(): boolean {
    if (this.transitioning) return false;
    if (this.climbLedge()) return true;
    if (this.nearAnchor('cave-mouth', 3)) {
      this.transitioning = true;
      const data: RegionTransitionData = { toAnchor: { x: 80, z: 16 }, facing: 0, cameraContext: 'exterior', clockMinutes: this.clockMinutes, npcToken: this.npcToken };
      void this.ctx.manager.goTo('BallastBayTown', data);
      return true;
    }
    return false;
  }

  // --- Geometry -------------------------------------------------------------

  private register(mesh: Mesh, layer: CaveLayer): Mesh {
    mesh.metadata = { layer };
    this.layers.get(layer)!.push(mesh);
    return mesh;
  }

  private buildCavern(scene: Scene): void {
    const floor = MeshBuilder.CreateGround('cave-floor', { width: 64, height: 64 }, scene);
    floor.position.set(32, 0, 32);
    floor.material = flatMaterial(scene, 'cave-floor', PALETTE.quarry, 0.14);
    floor.isPickable = false;
    this.register(floor, 'render');

    // Rock walls (the cavern shell — visible + collision via COLLISION).
    for (const b of COLLISION) {
      const m = MeshBuilder.CreateBox(`cave-rock-${b.id}`, { width: Math.max(0.5, b.maxX - b.minX), height: 4, depth: Math.max(0.5, b.maxZ - b.minZ) }, scene);
      m.position.set((b.minX + b.maxX) / 2, 2, (b.minZ + b.maxZ) / 2);
      m.material = flatMaterial(scene, `cave-rock-${b.id}`, PALETTE.cliff, 0.12);
      this.register(m, 'render');
    }

    // Mineral-spring pool (the landmark) + stepping stones.
    const pool = MeshBuilder.CreateGround('cave-pool', { width: POOL.maxX - POOL.minX, height: POOL.maxZ - POOL.minZ }, scene);
    pool.position.set((POOL.minX + POOL.maxX) / 2, POOL.surfaceY, (POOL.minZ + POOL.maxZ) / 2);
    const pmat = flatMaterial(scene, 'cave-pool', new Color3(0.2, 0.5, 0.55), 0.5); pmat.alpha = 0.75;
    pool.material = pmat; pool.isPickable = false; this.register(pool, 'render');
    for (const [i, s] of STONES.entries()) {
      const stone = MeshBuilder.CreateCylinder(`cave-stone-${i}`, { height: 0.5, diameter: STONE_R * 1.6 }, scene);
      stone.position.set(s.x, 0.25, s.z); stone.material = flatMaterial(scene, `cave-stone-${i}`, PALETTE.stone, 0.16);
      stone.isPickable = false; this.register(stone, 'render');
    }

    // Upper ledge + stair flight (slope/stair).
    const ledge = MeshBuilder.CreateBox('cave-ledge', { width: LEDGE.maxX - LEDGE.minX, height: LEDGE.y, depth: 64 - LEDGE.plateauMinZ }, scene);
    ledge.position.set((LEDGE.minX + LEDGE.maxX) / 2, LEDGE.y / 2, (LEDGE.plateauMinZ + 64) / 2);
    ledge.material = flatMaterial(scene, 'cave-ledge', PALETTE.quarry, 0.14); ledge.isPickable = false; this.register(ledge, 'render');
    for (let i = 0; i < 5; i++) {
      const step = MeshBuilder.CreateBox(`cave-stair-${i}`, { width: 12, height: 0.5 * (i + 1), depth: 1.2 }, scene);
      step.position.set(50, 0.25 * (i + 1), LEDGE.rampMinZ + i * 1.2);
      step.material = flatMaterial(scene, `cave-stair-${i}`, PALETTE.stone, 0.16); step.isPickable = false; this.register(step, 'render');
    }
    // Ledge-link ladder (the authored climb shortcut).
    const ladder = MeshBuilder.CreateBox('cave-ladder', { width: 1.2, height: LEDGE.y, depth: 0.2 }, scene);
    ladder.position.set(44, LEDGE.y / 2, 40); ladder.material = flatMaterial(scene, 'cave-ladder', PALETTE.wood, 0.2);
    ladder.isPickable = false; this.register(ladder, 'render');

    // Crystals (glowing seams) + lanterns (warm pools of light).
    for (let i = 0; i < 8; i++) {
      const cx = 8 + pseudo(i) * 48, cz = 8 + pseudo(i + 5) * 48;
      const crystal = MeshBuilder.CreateCylinder(`cave-crystal-${i}`, { height: 1.2, diameterTop: 0, diameterBottom: 0.6, tessellation: 5 }, scene);
      crystal.position.set(cx, 0.6, cz); crystal.material = flatMaterial(scene, `cave-crystal-${i}`, new Color3(0.3, 0.7, 0.85), 0.7);
      crystal.isPickable = false; this.register(crystal, 'render');
    }
    for (const [i, p] of [{ x: 12, z: 20 }, { x: 30, z: 44 }, { x: 52, z: 46 }, { x: 38, z: 10 }].entries()) {
      const lantern = MeshBuilder.CreateBox(`cave-lantern-${i}`, { width: 0.5, height: 0.7, depth: 0.5 }, scene);
      lantern.position.set(p.x, 1.4, p.z); lantern.material = flatMaterial(scene, `cave-lantern-${i}`, PALETTE.warmLight, 0.8);
      lantern.isPickable = false; this.register(lantern, 'render');
    }
  }

  private buildCreatures(scene: Scene): void {
    const fam = familyOf('cave-creature');
    for (const [i, start] of [{ x: 18, z: 46 }, { x: 32, z: 50 }].entries()) {
      const c = MeshBuilder.CreateCapsule(`cave-creature-${i}`, { height: fam.bodyProxyHeight, radius: fam.bodyProxyRadius }, scene);
      c.position.set(start.x, 0.3, start.z); c.material = flatMaterial(scene, `cave-creature-${i}`, new Color3(0.4, 0.35, 0.3), 0.4);
      this.register(c, 'render');
      this.creatures.push({ mesh: c, motor: createMotorState({ x: start.x, y: fam.bodyProxyHeight / 2, z: start.z }), seed: 30 + i * 5 });
    }
  }

  private buildDebugLayers(scene: Scene): void {
    for (const b of COLLISION) {
      const m = MeshBuilder.CreateBox(`dbg-col-${b.id}`, { width: Math.max(0.5, b.maxX - b.minX), height: 4, depth: Math.max(0.5, b.maxZ - b.minZ) }, scene);
      m.position.set((b.minX + b.maxX) / 2, 2, (b.minZ + b.maxZ) / 2);
      const mat = flatMaterial(scene, `dbg-col-${b.id}`, new Color3(0.9, 0.2, 0.2), 0.5); mat.alpha = 0.25; m.material = mat;
      m.isPickable = false; m.setEnabled(false); this.register(m, 'collision');
    }
    const nav = MeshBuilder.CreateGround('dbg-nav-floor', { width: 50, height: 50 }, scene);
    nav.position.set(30, 0.05, 32); const nmat = flatMaterial(scene, 'dbg-nav-floor', new Color3(0.2, 0.8, 0.3), 0.5); nmat.alpha = 0.15; nav.material = nmat;
    nav.isPickable = false; nav.setEnabled(false); this.register(nav, 'nav');
    for (const a of ANCHORS) {
      const m = MeshBuilder.CreateCylinder(`dbg-anchor-${a.id}`, { height: 2, diameter: 0.4 }, scene);
      m.position.set(a.x, 1, a.z); m.material = flatMaterial(scene, `dbg-anchor-${a.id}`, new Color3(0.95, 0.85, 0.2), 0.6);
      m.isPickable = false; m.setEnabled(false); this.register(m, 'anchor');
    }
    for (const v of [TIGHT_VOL]) {
      const m = MeshBuilder.CreateBox(`dbg-vol-${v.id}`, { width: v.max.x - v.min.x, height: Math.max(1, v.max.y - v.min.y), depth: v.max.z - v.min.z }, scene);
      m.position.set((v.min.x + v.max.x) / 2, (v.min.y + v.max.y) / 2, (v.min.z + v.max.z) / 2);
      const mat = flatMaterial(scene, `dbg-vol-${v.id}`, new Color3(0.3, 0.5, 0.95), 0.5); mat.alpha = 0.15; m.material = mat;
      m.isPickable = false; m.setEnabled(false); this.register(m, 'volume');
    }
  }

  private setLayer(layer: CaveLayer, on: boolean): void {
    for (const m of this.layers.get(layer) ?? []) m.setEnabled(on);
  }

  private installDebugApi(): void {
    const api = {
      region: (): string => 'rainhall-caverns',
      meshCount: (): number => this.scene.meshes.length,
      anchors: (): string[] => ANCHORS.map((a) => a.id),
      layerCount: (l: CaveLayer): number => this.layers.get(l)?.length ?? 0,
      enabledCount: (l: CaveLayer): number => (this.layers.get(l) ?? []).filter((m) => m.isEnabled()).length,
      setLayer: (l: CaveLayer, on: boolean): void => this.setLayer(l, on),
      player: (): { x: number; z: number; y: number; facing: number; medium: string; traversing: boolean } => ({
        x: this.motor.position.x, z: this.motor.position.z, y: this.motor.position.y, facing: this.motor.facing,
        medium: this.motor.medium, traversing: this.motor.traversal !== null,
      }),
      setPlayer: (x: number, z: number, facing?: number): void => { this.motor = groundedPoseAt(x, z, cavernGroundY(x, z), facing ?? this.motor.facing); this.syncPlayer(); },
      setMove: (x: number, z: number): void => { this.moveX = x; this.moveZ = z; },
      cameraState: (): CameraRigState => this.rig.getState(),
      creatureCount: (): number => this.creatures.length,
      climbLedge: (): boolean => this.climbLedge(),
      atAnchor: (id: string): boolean => this.nearAnchor(id, 3),
      pressAction: (): boolean => this.pressAction(),
      clockMinutes: (): number => this.clockMinutes,
      npcToken: (): string => this.npcToken,
      tick: (n = 1): void => { for (let i = 0; i < n; i++) { this.step(FIXED_DT); this.rig.update(FIXED_DT, ZERO_INPUT); } },
    };
    (window as unknown as { sturdyVolleyCave?: typeof api }).sturdyVolleyCave = api;
  }
}
