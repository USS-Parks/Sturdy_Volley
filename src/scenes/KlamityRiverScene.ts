import {
  Scene,
  MeshBuilder,
  TransformNode,
  Vector3,
  Color3,
  type AbstractMesh,
  type Mesh,
} from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, PALETTE } from '../render/scene-helpers';
import { buildHorseGraybox } from '../render/horse-graybox';
import { CameraRig, type FollowTarget, type CameraRigState } from '../camera/rig';
import { baselineProfile, type CameraContextId } from '../camera/profiles';
import { CameraInputController, ZERO_INPUT, type CameraInput } from '../camera/input';
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
import { familyOf, type AnimalFamily } from '../engine/animal-families';
import {
  RIDDEN_MOTOR_CONFIG,
  riddenGaitSpeed,
  gaitIndexFromThrottle,
  rampSpeed,
  createMountState,
  toggleMount,
  stepMountTransition,
  isRidden,
  shouldUseMountedCamera,
  dismountPose,
  type MountState,
} from '../engine/mount';
import {
  DEFAULT_CLOCK_MINUTES,
  NPC_STATE_TOKEN,
  type RegionTransitionData,
} from '../world/region-transition';

/**
 * Klam-ity River corridor — production-foundation map III (WEF-10c-i, master
 * Prompt 048). The showcase that exercises the Prompt 044 **mount system** on a
 * real map: a riverbank corridor linking the inland (Willa Crick / farm) community
 * to the coastal (Ballast Bay) community, with a shallow-water **ford**, a
 * **bridge**, a **cliff** overlook, and the wet-sand shoreline of
 * `sv_map_014_driftwood_beach_layout.png` / `sv_map_016_kelpglass_reef_layout.png`
 * + the creek/footbridge + cliff-to-water vocabulary of `sv_map_012` / `sv_env_041`.
 *
 * Mount the horse at the inland end, ride the corridor south, **ford or bridge the
 * river**, and dismount at the coast — the camera hands to the Prompt 030 mounted
 * baseline while ridden and blends back on dismount, and the inland→coastal ground
 * seam is crossed continuously (no pop). Real `SceneManager` transitions connect
 * the corridor to Breakpoint Farm (inland gate) and Ballast Bay Town (coastal
 * gate), preserving clock + NPC state.
 *
 * Reachable via the Title "Dev · Klam-ity River" item or `?scene=KlamityRiver`.
 */

const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.4;
const WALK_SPEED = 3.6;
const FIXED_DT = 1 / 30;

export type RiverLayer = 'render' | 'collision' | 'nav' | 'anchor' | 'volume';

interface Anchor {
  id: string;
  kind: string;
  x: number;
  z: number;
  facing?: number;
}
/** Corridor anchors (no external blockout — authored here, Willa Crick provisional). */
const ANCHORS: Anchor[] = [
  { id: 'farm-arrival', kind: 'region-edge', x: 64, z: 90, facing: 0 },
  { id: 'willa-crick-gate', kind: 'region-edge', x: 64, z: 130, facing: 0 },
  { id: 'ballast-bay-gate', kind: 'region-edge', x: 64, z: 12, facing: Math.PI },
  { id: 'horse-hitch', kind: 'mount', x: 64, z: 104 },
  { id: 'river-ford', kind: 'water-entry', x: 64, z: 61 },
  { id: 'river-bridge', kind: 'bridge', x: 43, z: 61 },
  { id: 'cliff-overlook', kind: 'landmark', x: 8, z: 80 },
];

interface Box { id: string; minX: number; maxX: number; minZ: number; maxZ: number }
const COLLISION: Box[] = [
  { id: 'edge-w', minX: -1, maxX: 1, minZ: 0, maxZ: 140 },
  { id: 'edge-e', minX: 79, maxX: 81, minZ: 0, maxZ: 140 },
  { id: 'edge-n', minX: 0, maxX: 80, minZ: 139, maxZ: 141 },
  { id: 'hitching-post', minX: 67, maxX: 68, minZ: 103, maxZ: 105 },
  { id: 'sea-stack', minX: 20, maxX: 26, minZ: 2, maxZ: 8 },
];

/** River (E–W band the rider fords) + a bridge deck (dry crossing). */
const RIVER = { minZ: 56, maxZ: 66, minX: 6, maxX: 74, surfaceY: 0.15, bedY: -0.4 };
const BRIDGE = { minX: 38, maxX: 48, deckY: 0.5 };
/** West cliff plateau + ramp (the overlook). */
const CLIFF = { maxX: 14, rampMaxX: 20, y: 3.0 };
/** Coastal sea (south). */
const SEA = { maxZ: 4, surfaceY: 0.15, bedY: -0.6 };
/** The inland→coastal ground seam (mid-river). North of it = inland green. */
const SEAM_Z = 61;

function lerp(a: number, b: number, t: number): number { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function inBox(b: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number): boolean {
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}

function riverGroundY(x: number, z: number): number {
  if (x >= BRIDGE.minX && x <= BRIDGE.maxX && z >= RIVER.minZ && z <= RIVER.maxZ) return BRIDGE.deckY;
  if (x <= CLIFF.maxX) return CLIFF.y;
  if (x <= CLIFF.rampMaxX) return lerp(CLIFF.y, 0, (x - CLIFF.maxX) / (CLIFF.rampMaxX - CLIFF.maxX));
  return 0;
}
function riverWater(x: number, z: number): WaterColumn | undefined {
  if (x >= BRIDGE.minX && x <= BRIDGE.maxX && z >= RIVER.minZ && z <= RIVER.maxZ) return undefined;
  if (z >= RIVER.minZ && z <= RIVER.maxZ && x >= RIVER.minX && x <= RIVER.maxX) return { surfaceY: RIVER.surfaceY, bedY: RIVER.bedY };
  if (z <= SEA.maxZ) return { surfaceY: SEA.surfaceY, bedY: SEA.bedY };
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

export class KlamityRiverScene extends GameScene {
  private readonly family: AnimalFamily = familyOf('rideable-mount');
  private mount: MountState = createMountState(true);

  private rig!: CameraRig;
  private input: CameraInputController | null = null;
  private cameraCtx: CameraContextId = 'exterior';

  private playerMesh!: Mesh;
  private playerMotor!: MotorState;
  private horseMotor!: MotorState;
  private horseRoot!: TransformNode;
  private readonly horseMeshes: Mesh[] = [];

  private readonly layers = new Map<RiverLayer, Mesh[]>([
    ['render', []], ['collision', []], ['nav', []], ['anchor', []], ['volume', []],
  ]);

  private moveX = 0;
  private moveZ = 0;
  private throttle = 0;
  private clockMinutes = DEFAULT_CLOCK_MINUTES;
  private npcToken = NPC_STATE_TOKEN;
  private transitioning = false;

  // Ride proofs.
  private forded = false;
  private crossedSeam = false;
  private minRiderY = Infinity;
  private tunneled = false;

  private readonly held = new Set<string>();
  private onKeyDown?: (e: KeyboardEvent) => void;
  private onKeyUp?: (e: KeyboardEvent) => void;

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    this.scene = scene;
    addFog(scene, PALETTE.fog, 0.008);
    addLights(scene);

    this.buildCorridor(scene);
    this.buildDebugLayers(scene);

    const player = MeshBuilder.CreateCapsule('river-player', { height: PLAYER_HEIGHT, radius: PLAYER_RADIUS }, scene);
    player.material = flatMaterial(scene, 'river-player', PALETTE.player, 0.35);
    player.isPickable = false;
    this.playerMesh = player;
    this.playerMotor = groundedPoseAt(64, 90, riverGroundY(64, 90), Math.PI); // facing the horse/inland
    this.syncPlayer();

    // Horse at the hitching post.
    this.horseRoot = new TransformNode('river-horse-root', scene);
    this.horseMeshes.push(...buildHorseGraybox(scene, this.horseRoot, this.family, 'river-horse'));
    for (const m of this.horseMeshes) this.layers.get('render')!.push(m);
    this.horseMotor = createMotorState({ x: 64, y: riverGroundY(64, 104) + RIDDEN_MOTOR_CONFIG.capsuleHeight / 2, z: 104 }, Math.PI);
    this.syncHorse();

    this.rig = new CameraRig(scene, baselineProfile('exterior'), -Math.PI / 2);
    const follow: FollowTarget = {
      position: () => this.followPoint(),
      velocity: () => this.followVelocity(),
      ignore: (): readonly AbstractMesh[] => [this.playerMesh, ...this.horseMeshes],
    };
    this.rig.setTarget(follow);

    return scene;
  }

  override enter(data?: unknown): void {
    const t = data as RegionTransitionData | undefined;
    if (t && typeof t.clockMinutes === 'number') {
      this.clockMinutes = t.clockMinutes;
      this.npcToken = t.npcToken;
      this.playerMotor = groundedPoseAt(t.toAnchor.x, t.toAnchor.z, riverGroundY(t.toAnchor.x, t.toAnchor.z), t.facing);
      this.syncPlayer();
    }
    const canvas = this.ctx.engine.getRenderingCanvas();
    if (canvas) this.input = new CameraInputController(canvas);
    this.onKeyDown = (e) => {
      this.held.add(e.key.toLowerCase());
      if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') this.pressAction();
      if (e.key === 'w') this.throttle = 1;
      if (e.key === 's') this.throttle = 0;
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
    this.updateCamera(dt, camInput);
  }

  override dispose(): void {
    if (this.onKeyDown) window.removeEventListener('keydown', this.onKeyDown);
    if (this.onKeyUp) window.removeEventListener('keyup', this.onKeyUp);
    this.input?.dispose();
    this.rig?.dispose();
    delete (window as unknown as { sturdyVolleyRiver?: unknown }).sturdyVolleyRiver;
    super.dispose();
  }

  // --- Simulation -----------------------------------------------------------

  private readKeys(): void {
    const fwd = (this.held.has('arrowup') ? 1 : 0) - (this.held.has('arrowdown') ? 1 : 0);
    const str = (this.held.has('arrowright') ? 1 : 0) - (this.held.has('arrowleft') ? 1 : 0);
    if (fwd === 0 && str === 0) { this.moveX = 0; this.moveZ = 0; return; }
    const alpha = this.rig.camera.alpha;
    this.moveX = (-Math.sin(alpha)) * str + (-Math.cos(alpha)) * fwd;
    this.moveZ = (Math.cos(alpha)) * str + (-Math.sin(alpha)) * fwd;
  }

  private step(dt: number): void {
    if (this.mount.phase === 'mounting' || this.mount.phase === 'dismounting') this.mount = stepMountTransition(this.mount, dt);
    if (isRidden(this.mount)) this.stepRidden(dt);
    else this.stepOnFoot(dt);
    this.syncHorse();
    this.syncPlayer();
  }

  private stepRidden(dt: number): void {
    const target = riddenGaitSpeed(gaitIndexFromThrottle(this.throttle));
    this.mount = { ...this.mount, speed: rampSpeed(this.mount.speed, target, dt) };
    const mag = Math.hypot(this.moveX, this.moveZ);
    const moveDir = mag > 1e-4 ? { x: this.moveX / mag, z: this.moveZ / mag } : { x: 0, z: 0 };
    const env = this.envFor(this.horseMotor, moveDir, this.mount.speed * dt, RIDDEN_MOTOR_CONFIG.capsuleRadius);
    this.horseMotor = stepMotor(this.horseMotor, { moveDir, speed: this.mount.speed }, env, dt, RIDDEN_MOTOR_CONFIG);
    this.clampCorridor(this.horseMotor);
    this.trackRide();
  }

  private stepOnFoot(dt: number): void {
    const mag = Math.hypot(this.moveX, this.moveZ);
    const moveDir = mag > 1e-4 ? { x: this.moveX / mag, z: this.moveZ / mag } : { x: 0, z: 0 };
    const env = this.envFor(this.playerMotor, moveDir, WALK_SPEED * dt, PLAYER_RADIUS);
    this.playerMotor = stepMotor(this.playerMotor, { moveDir, speed: mag > 1e-4 ? WALK_SPEED : 0 }, env, dt);
    this.clampCorridor(this.playerMotor);
  }

  private envFor(motor: MotorState, moveDir: { x: number; z: number }, mag: number, radius: number): MotorEnvironment {
    const x = motor.position.x, z = motor.position.z;
    return {
      ground: { hit: true, groundY: riverGroundY(x, z), normal: { x: 0, y: 1, z: 0 } },
      wall: aabbWall({ x, z }, radius, moveDir, mag),
      stepGround: NO_GROUND,
      ceiling: NO_CEILING,
      water: riverWater(x, z),
    };
  }

  private clampCorridor(motor: MotorState): void {
    motor.position.x = Math.max(1.5, Math.min(78.5, motor.position.x));
    motor.position.z = Math.max(1.5, Math.min(138.5, motor.position.z));
  }

  private trackRide(): void {
    const z = this.horseMotor.position.z;
    if (this.horseMotor.medium === 'wade' && z >= RIVER.minZ && z <= RIVER.maxZ) this.forded = true;
    if (z < SEAM_Z) this.crossedSeam = true; // rode from inland (north) to coastal (south)
    this.minRiderY = Math.min(this.minRiderY, this.riderWorldY());
    for (const b of COLLISION) {
      if (inBox(b, this.horseMotor.position.x, this.horseMotor.position.z)) this.tunneled = true;
    }
  }

  // --- Mount / dismount / transitions ---------------------------------------

  private anchorAt(id: string): Anchor | undefined { return ANCHORS.find((a) => a.id === id); }
  private nearAnchor(id: string, reach: number): boolean {
    const a = this.anchorAt(id);
    if (!a) return false;
    return Math.hypot(this.playerMotor.position.x - a.x, this.playerMotor.position.z - a.z) <= reach;
  }

  private pressAction(): boolean {
    if (this.transitioning) return false;
    // Ridden → dismount.
    if (isRidden(this.mount)) {
      this.mount = toggleMount(this.mount, { x: 0, z: 0 }, { x: 0, z: 0 }, 0); // ridden branch ignores positions
      const horseXZ = { x: this.horseMotor.position.x, z: this.horseMotor.position.z };
      const pose = dismountPose(horseXZ, this.horseMotor.facing, 1.4);
      this.playerMotor = groundedPoseAt(Math.max(1.5, Math.min(78.5, pose.x)), Math.max(1.5, Math.min(138.5, pose.z)), riverGroundY(pose.x, pose.z), this.horseMotor.facing);
      this.syncPlayer();
      return true;
    }
    // On foot near the horse → mount.
    const horseXZ = { x: this.horseMotor.position.x, z: this.horseMotor.position.z };
    const playerXZ = { x: this.playerMotor.position.x, z: this.playerMotor.position.z };
    const next = toggleMount(this.mount, playerXZ, horseXZ, this.family.interactionDistance);
    if (next !== this.mount) { this.mount = next; return true; }
    // On foot near a community gate → region transition.
    if (this.nearAnchor('ballast-bay-gate', 3)) return this.transitionTo('BallastBayTown', { x: 6, z: 64 }, -Math.PI / 2, 'exterior');
    if (this.nearAnchor('willa-crick-gate', 3) || this.nearAnchor('farm-arrival', 3)) return this.transitionTo('BreakpointFarm', { x: 64, z: 8 }, 0, 'farm');
    return false;
  }

  private transitionTo(scene: string, toAnchor: { x: number; z: number }, facing: number, cameraContext: CameraContextId): boolean {
    this.transitioning = true;
    const data: RegionTransitionData = { toAnchor, facing, cameraContext, clockMinutes: this.clockMinutes, npcToken: this.npcToken };
    void this.ctx.manager.goTo(scene, data);
    return true;
  }

  // --- Camera ---------------------------------------------------------------

  private updateCamera(dt: number, input: CameraInput): void {
    const ctx: CameraContextId = shouldUseMountedCamera(this.mount) ? 'mounted' : 'exterior';
    if (ctx !== this.cameraCtx) { this.cameraCtx = ctx; this.rig.setProfile(baselineProfile(ctx)); }
    this.rig.update(dt, input);
  }

  private followPoint(): Vector3 {
    if (isRidden(this.mount) || this.mount.phase === 'mounting') {
      return new Vector3(this.horseMotor.position.x, this.riderWorldY(), this.horseMotor.position.z);
    }
    return new Vector3(this.playerMotor.position.x, this.playerMotor.position.y + 0.6, this.playerMotor.position.z);
  }
  private followVelocity(): { x: number; z: number } {
    if (isRidden(this.mount)) {
      const mag = Math.hypot(this.moveX, this.moveZ);
      if (mag < 1e-4) return { x: 0, z: 0 };
      return { x: (this.moveX / mag) * this.mount.speed, z: (this.moveZ / mag) * this.mount.speed };
    }
    return { x: 0, z: 0 };
  }
  private riderWorldY(): number {
    return (this.horseMotor.position.y - RIDDEN_MOTOR_CONFIG.capsuleHeight / 2) + (this.family.mountAnchor?.y ?? 1.5);
  }

  // --- Meshes ---------------------------------------------------------------

  private syncHorse(): void {
    const feetY = this.horseMotor.position.y - RIDDEN_MOTOR_CONFIG.capsuleHeight / 2;
    this.horseRoot.position.set(this.horseMotor.position.x, feetY, this.horseMotor.position.z);
    this.horseRoot.rotation.y = this.horseMotor.facing;
  }
  private syncPlayer(): void {
    if (isRidden(this.mount) || this.mount.phase === 'mounting') {
      this.playerMesh.position.set(this.horseMotor.position.x, this.riderWorldY() + PLAYER_HEIGHT / 2 - 0.4, this.horseMotor.position.z);
      this.playerMesh.rotation.y = this.horseMotor.facing;
    } else {
      this.playerMesh.position.set(this.playerMotor.position.x, this.playerMotor.position.y, this.playerMotor.position.z);
      this.playerMesh.rotation.y = this.playerMotor.facing;
    }
  }

  // --- Geometry -------------------------------------------------------------

  private register(mesh: Mesh, layer: RiverLayer): Mesh {
    mesh.metadata = { layer };
    this.layers.get(layer)!.push(mesh);
    return mesh;
  }

  private buildCorridor(scene: Scene): void {
    // Inland (Willa Crick / farm) ground green; coastal (Ballast Bay) wet sand.
    const inland = MeshBuilder.CreateGround('river-inland', { width: 80, height: 140 - SEAM_Z + 8 }, scene);
    inland.position.set(40, 0, (SEAM_Z + 140) / 2);
    inland.material = flatMaterial(scene, 'river-inland', PALETTE.grass, 0.2);
    inland.isPickable = false;
    this.register(inland, 'render');
    const coast = MeshBuilder.CreateGround('river-coast', { width: 80, height: SEAM_Z + 8 }, scene);
    coast.position.set(40, -0.01, (SEAM_Z - 8) / 2);
    coast.material = flatMaterial(scene, 'river-coast', PALETTE.sand, 0.2);
    coast.isPickable = false;
    this.register(coast, 'render');

    // River + sea water planes.
    const river = MeshBuilder.CreateGround('river-water', { width: RIVER.maxX - RIVER.minX, height: RIVER.maxZ - RIVER.minZ }, scene);
    river.position.set((RIVER.minX + RIVER.maxX) / 2, RIVER.surfaceY, (RIVER.minZ + RIVER.maxZ) / 2);
    const rmat = flatMaterial(scene, 'river-water', PALETTE.sea, 0.4); rmat.alpha = 0.7; river.material = rmat;
    river.isPickable = false; this.register(river, 'render');
    const sea = MeshBuilder.CreateGround('river-sea', { width: 80, height: 12 }, scene);
    sea.position.set(40, SEA.surfaceY, -2);
    const smat = flatMaterial(scene, 'river-sea', PALETTE.sea, 0.4); smat.alpha = 0.7; sea.material = smat;
    sea.isPickable = false; this.register(sea, 'render');

    // Bridge deck + rails.
    const deck = MeshBuilder.CreateBox('river-bridge', { width: BRIDGE.maxX - BRIDGE.minX, height: 0.2, depth: RIVER.maxZ - RIVER.minZ + 2 }, scene);
    deck.position.set((BRIDGE.minX + BRIDGE.maxX) / 2, BRIDGE.deckY, (RIVER.minZ + RIVER.maxZ) / 2);
    deck.material = flatMaterial(scene, 'river-bridge', PALETTE.wood, 0.22); deck.isPickable = false; this.register(deck, 'render');

    // West cliff plateau (the overlook).
    const cliff = MeshBuilder.CreateBox('river-cliff', { width: CLIFF.maxX, height: CLIFF.y, depth: 140 }, scene);
    cliff.position.set(CLIFF.maxX / 2, CLIFF.y / 2, 70);
    cliff.material = flatMaterial(scene, 'river-cliff', PALETTE.cliff, 0.18); cliff.isPickable = false; this.register(cliff, 'render');

    // Hitching post (mount marker).
    const post = MeshBuilder.CreateBox('river-hitch', { width: 0.3, height: 1.2, depth: 2 }, scene);
    post.position.set(67.5, 0.6, 104); post.material = flatMaterial(scene, 'river-hitch', PALETTE.wood, 0.2);
    post.isPickable = false; this.register(post, 'render');

    // Sea stack + driftwood (coastal vocabulary).
    const stack = MeshBuilder.CreateCylinder('river-seastack', { height: 6, diameterTop: 3, diameterBottom: 5 }, scene);
    stack.position.set(23, 3, 5); stack.material = flatMaterial(scene, 'river-seastack', PALETTE.stone, 0.18);
    stack.isPickable = false; this.register(stack, 'render');
    for (let i = 0; i < 4; i++) {
      const log = MeshBuilder.CreateCylinder(`river-driftwood-${i}`, { height: 4, diameter: 0.5 }, scene);
      log.position.set(30 + i * 6, 0.25, 20 + pseudo(i) * 8); log.rotation.z = Math.PI / 2;
      log.material = flatMaterial(scene, `river-driftwood-${i}`, PALETTE.wood, 0.18); log.isPickable = false; this.register(log, 'render');
    }

    // Redwood ring (inland) + the gates.
    for (let i = 0; i < 12; i++) {
      const x = pseudo(i) < 0.5 ? 4 + pseudo(i + 1) * 6 : 70 + pseudo(i + 2) * 6;
      const z = 70 + pseudo(i + 3) * 68;
      const tree = MeshBuilder.CreateCylinder(`river-redwood-${i}`, { height: 12, diameterTop: 1.4, diameterBottom: 2.2 }, scene);
      tree.position.set(x, 6, z); tree.material = flatMaterial(scene, `river-redwood-${i}`, PALETTE.roof, 0.16);
      tree.isPickable = false; this.register(tree, 'render');
    }
    for (const g of ['willa-crick-gate', 'ballast-bay-gate'] as const) {
      const a = this.anchorAt(g)!;
      const arch = MeshBuilder.CreateBox(`river-gate-${g}`, { width: 6, height: 0.5, depth: 0.4 }, scene);
      arch.position.set(a.x, 4, a.z); arch.material = flatMaterial(scene, `river-gate-${g}`, PALETTE.roof, 0.2);
      arch.isPickable = false; this.register(arch, 'render');
    }
  }

  private buildDebugLayers(scene: Scene): void {
    for (const b of COLLISION) {
      const m = MeshBuilder.CreateBox(`dbg-col-${b.id}`, { width: Math.max(0.5, b.maxX - b.minX), height: 3, depth: Math.max(0.5, b.maxZ - b.minZ) }, scene);
      m.position.set((b.minX + b.maxX) / 2, 1.5, (b.minZ + b.maxZ) / 2);
      const mat = flatMaterial(scene, `dbg-col-${b.id}`, new Color3(0.9, 0.2, 0.2), 0.5); mat.alpha = 0.25; m.material = mat;
      m.isPickable = false; m.setEnabled(false); this.register(m, 'collision');
    }
    // Nav: the riverbank trail + the ford/bridge crossings.
    const trail = MeshBuilder.CreateGround('dbg-nav-trail', { width: 4, height: 120 }, scene);
    trail.position.set(64, 0.05, 70); const tmat = flatMaterial(scene, 'dbg-nav-trail', new Color3(0.2, 0.8, 0.3), 0.5); tmat.alpha = 0.2; trail.material = tmat;
    trail.isPickable = false; trail.setEnabled(false); this.register(trail, 'nav');
    for (const a of ANCHORS) {
      const m = MeshBuilder.CreateCylinder(`dbg-anchor-${a.id}`, { height: 2, diameter: 0.4 }, scene);
      m.position.set(a.x, 1, a.z); m.material = flatMaterial(scene, `dbg-anchor-${a.id}`, new Color3(0.95, 0.85, 0.2), 0.6);
      m.isPickable = false; m.setEnabled(false); this.register(m, 'anchor');
    }
    // Volume: the corridor framing band (single authored exterior volume).
    const vol = MeshBuilder.CreateBox('dbg-vol-corridor', { width: 80, height: 6, depth: 140 }, scene);
    vol.position.set(40, 3, 70); const vmat = flatMaterial(scene, 'dbg-vol-corridor', new Color3(0.3, 0.5, 0.95), 0.5); vmat.alpha = 0.1; vol.material = vmat;
    vol.isPickable = false; vol.setEnabled(false); this.register(vol, 'volume');
  }

  private setLayer(layer: RiverLayer, on: boolean): void {
    for (const m of this.layers.get(layer) ?? []) m.setEnabled(on);
  }

  // --- Debug API ------------------------------------------------------------

  private installDebugApi(): void {
    const api = {
      region: (): string => 'klam-ity-river',
      meshCount: (): number => this.scene.meshes.length,
      anchors: (): string[] => ANCHORS.map((a) => a.id),
      layerCount: (l: RiverLayer): number => this.layers.get(l)?.length ?? 0,
      enabledCount: (l: RiverLayer): number => (this.layers.get(l) ?? []).filter((m) => m.isEnabled()).length,
      setLayer: (l: RiverLayer, on: boolean): void => this.setLayer(l, on),
      state: (): { phase: MountState['phase']; ridden: boolean; cameraContext: string; speed: number; horse: { x: number; z: number }; player: { x: number; z: number; y: number; grounded: boolean }; riderGap: number } => ({
        phase: this.mount.phase, ridden: isRidden(this.mount), cameraContext: this.cameraCtx, speed: this.mount.speed,
        horse: { x: this.horseMotor.position.x, z: this.horseMotor.position.z },
        player: { x: this.playerMotor.position.x, z: this.playerMotor.position.z, y: this.playerMotor.position.y, grounded: this.playerMotor.grounded },
        riderGap: Math.hypot(this.playerMotor.position.x - this.horseMotor.position.x, this.playerMotor.position.z - this.horseMotor.position.z),
      }),
      cameraState: (): CameraRigState => this.rig.getState(),
      setPlayer: (x: number, z: number, facing?: number): void => { this.playerMotor = groundedPoseAt(x, z, riverGroundY(x, z), facing ?? this.playerMotor.facing); this.syncPlayer(); },
      setMove: (x: number, z: number): void => { this.moveX = x; this.moveZ = z; },
      setThrottle: (t: number): void => { this.throttle = Math.max(0, Math.min(1, t)); },
      pressAction: (): boolean => this.pressAction(),
      clockMinutes: (): number => this.clockMinutes,
      npcToken: (): string => this.npcToken,
      forded: (): boolean => this.forded,
      crossedSeam: (): boolean => this.crossedSeam,
      tunneled: (): boolean => this.tunneled,
      minRiderY: (): number => (this.minRiderY === Infinity ? this.riderWorldY() : this.minRiderY),
      finite: (): boolean => Number.isFinite(this.horseMotor.position.x) && Number.isFinite(this.horseMotor.position.z) && Number.isFinite(this.horseMotor.position.y),
      atGate: (id: string): boolean => this.nearAnchor(id, 3),
      tick: (n = 1): void => { for (let i = 0; i < n; i++) { this.step(FIXED_DT); this.updateCamera(FIXED_DT, ZERO_INPUT); } },
    };
    (window as unknown as { sturdyVolleyRiver?: typeof api }).sturdyVolleyRiver = api;
  }
}
