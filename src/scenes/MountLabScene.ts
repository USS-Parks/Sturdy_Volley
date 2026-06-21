import {
  Scene,
  MeshBuilder,
  TransformNode,
  Vector3,
  type Mesh,
} from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, PALETTE } from '../render/scene-helpers';
import { buildHorseGraybox } from '../render/horse-graybox';
import { CameraRig, type FollowTarget } from '../camera/rig';
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
import {
  familyOf,
  type AnimalFamily,
} from '../engine/animal-families';
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
  serializeMount,
  restoreMount,
  type MountState,
  type MountSave,
} from '../engine/mount';

/**
 * Mount-system proving ground (master Prompt 044).
 *
 * Horseback as a cohesive vertical slice — the early-game faster-transport option
 * between Willa Crick and Ballast Bay. A graybox rideable horse (the
 * `rideable-mount` family) sits on a course that exercises the whole contract:
 * a contextual one-button **mount/dismount**, a **ridden-locomotion motor** (the
 * faster `RIDDEN_MOTOR_CONFIG` + ridden gait bands + momentum ramp from
 * `mount.ts`), and **mounted-camera integration** that hands the real
 * `CameraRig` to the Prompt 030 `mounted` baseline while ridden and blends back
 * to `exterior` on dismount with no discontinuity.
 *
 * The course proves stability across slope, a shallow-water **ford** (the horse
 * wades, not swims), a **bridge** deck, a **community-to-community seam**
 * (Willa-Crick-tinted ground → Ballast-Bay-tinted ground, ridden across without
 * a pop), and a solid **obstruction** (the ride stops, never tunnels). A
 * riderless horse wanders within course bounds and recovers if it drifts off.
 *
 * Graybox geometry is Claude's (§0.9): faceted primitives sized to the OoT-era
 * low-poly horse (`sv_theme_03_004_shape_language.png` panel 11), withers ≈ 1.6 m
 * against the 1.7–1.8 m human in `sv_style_007_camera_scale_guide.png`. A future
 * `.glb` swaps `buildHorseGraybox` without touching the motor / camera / anchors.
 *
 * Reachable via the Title "Dev · Mount Lab" item or `?scene=MountLab`.
 */

const FIXED_DT = 1 / 30;
const PLAYER_HEIGHT = 1.8;
const PLAYER_SPEED = 4; // on-foot lab speed (m/s)

/** Course bounds the ride + riderless wander are clamped to (recovery). */
const COURSE = { minX: -6, maxX: 6, minZ: -6, maxZ: 50 };
/** Riderless wander box near the start. */
const PADDOCK = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };
/** Shallow ford strip (z band); the horse wades across it. */
const FORD = { minZ: 8, maxZ: 12, surfaceY: 0.15, bedY: -0.3 };
/** Raised bridge deck (z band, central strip). */
const BRIDGE = { minZ: 28, maxZ: 36, deckY: 0.5, halfWidth: 3 };
/** Slope hump (z band). */
const SLOPE = { minZ: 16, maxZ: 26, peakY: 1.2 };
/** Willa Crick ↔ Ballast Bay seam (cross while ridden = community transition). */
const SEAM_Z = 40;
/** Solid obstruction (rock) on the far path — the ride must not tunnel it. */
const ROCK = { minX: -1.5, maxX: 1.5, minZ: 42.5, maxZ: 45.5 };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** Course ground height at (x, z): flat grass + ford dip + slope hump + bridge deck. */
function courseGroundY(x: number, z: number): number {
  if (z >= BRIDGE.minZ - 1 && z <= BRIDGE.maxZ + 1 && Math.abs(x) <= BRIDGE.halfWidth) {
    if (z < BRIDGE.minZ) return lerp(0, BRIDGE.deckY, z - (BRIDGE.minZ - 1));
    if (z > BRIDGE.maxZ) return lerp(BRIDGE.deckY, 0, z - BRIDGE.maxZ);
    return BRIDGE.deckY;
  }
  if (z >= SLOPE.minZ && z <= SLOPE.maxZ) {
    if (z < 20) return lerp(0, SLOPE.peakY, (z - SLOPE.minZ) / 4);
    if (z <= 24) return SLOPE.peakY;
    return lerp(SLOPE.peakY, 0, (z - 24) / 2);
  }
  if (z >= FORD.minZ - 1 && z <= FORD.maxZ + 1) {
    if (z < FORD.minZ) return lerp(0, FORD.bedY, z - (FORD.minZ - 1));
    if (z > FORD.maxZ) return lerp(FORD.bedY, 0, z - FORD.maxZ);
    return FORD.bedY;
  }
  return 0;
}

/** Water column over the ford strip, else none. */
function courseWater(_x: number, z: number): WaterColumn | undefined {
  if (z >= FORD.minZ && z <= FORD.maxZ) return { surfaceY: FORD.surfaceY, bedY: FORD.bedY };
  return undefined;
}

/** Circle-vs-AABB wall probe for the rock: approach gap + penetration recovery. */
function rockWall(pos: { x: number; z: number }, radius: number, moveDir: { x: number; z: number }, mag: number): WallHit {
  const minX = ROCK.minX - radius;
  const maxX = ROCK.maxX + radius;
  const minZ = ROCK.minZ - radius;
  const maxZ = ROCK.maxZ + radius;
  // Already inside the expanded box → push out along the least-penetration axis.
  if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
    const dxL = pos.x - minX;
    const dxR = maxX - pos.x;
    const dzL = pos.z - minZ;
    const dzR = maxZ - pos.z;
    const m = Math.min(dxL, dxR, dzL, dzR);
    const normal = m === dxL ? { x: -1, y: 0, z: 0 }
      : m === dxR ? { x: 1, y: 0, z: 0 }
      : m === dzL ? { x: 0, y: 0, z: -1 }
      : { x: 0, y: 0, z: 1 };
    return { hit: true, distance: -m, normal };
  }
  // Approaching: slab raycast from pos along moveDir; nearest face entry within mag.
  if (mag <= 0) return { hit: false, distance: Number.POSITIVE_INFINITY, normal: { x: 0, y: 0, z: 0 } };
  let tEnter = -Infinity;
  let enterAxis: 'x' | 'z' = 'x';
  for (const axis of ['x', 'z'] as const) {
    const o = pos[axis];
    const d = moveDir[axis];
    const lo = axis === 'x' ? minX : minZ;
    const hi = axis === 'x' ? maxX : maxZ;
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return { hit: false, distance: Number.POSITIVE_INFINITY, normal: { x: 0, y: 0, z: 0 } };
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tEnter) {
      tEnter = t1;
      enterAxis = axis;
    }
    if (t2 < 0) return { hit: false, distance: Number.POSITIVE_INFINITY, normal: { x: 0, y: 0, z: 0 } };
  }
  if (tEnter >= 0 && tEnter <= mag) {
    const sign = -Math.sign(moveDir[enterAxis]);
    const normal = enterAxis === 'x' ? { x: sign, y: 0, z: 0 } : { x: 0, y: 0, z: sign };
    return { hit: true, distance: tEnter, normal };
  }
  return { hit: false, distance: Number.POSITIVE_INFINITY, normal: { x: 0, y: 0, z: 0 } };
}

function clampToCourse(p: { x: number; z: number }): { x: number; z: number } {
  return {
    x: Math.max(COURSE.minX, Math.min(COURSE.maxX, p.x)),
    z: Math.max(COURSE.minZ, Math.min(COURSE.maxZ, p.z)),
  };
}

function pseudo(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export class MountLabScene extends GameScene {
  private readonly family: AnimalFamily = familyOf('rideable-mount');
  private mount: MountState = createMountState(true);

  private playerMotor!: MotorState;
  private playerMesh!: Mesh;

  private horseMotor!: MotorState;
  private horseRoot!: TransformNode;
  private readonly horseMeshes: Mesh[] = [];

  private rig!: CameraRig;
  private input?: CameraInputController;
  private cameraCtx: CameraContextId = 'exterior';

  // Inputs (set by debug API / keyboard).
  private moveX = 0;
  private moveZ = 0;
  private throttle = 0;
  private reducedMotion = false;
  private seed = 7;

  // Proving-ground latches.
  private forded = false;
  private crossedBridge = false;
  private crossedSeam = false;
  private tunneled = false;
  private minRiderY = Infinity;

  // Keyboard handler (manual play; e2e drives the debug API).
  private onKey?: (e: KeyboardEvent) => void;

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    this.scene = scene;
    addFog(scene, PALETTE.fog, 0.008);
    addLights(scene);

    this.buildCourse(scene);

    // Player capsule.
    const player = MeshBuilder.CreateCapsule('mount-player', { height: PLAYER_HEIGHT, radius: 0.4 }, scene);
    player.material = flatMaterial(scene, 'mount-player', PALETTE.player, 0.35);
    this.playerMesh = player;
    this.playerMotor = groundedPoseAt(0, 0, courseGroundY(0, 0));
    player.position.set(0, this.playerMotor.position.y, 0);

    // Horse graybox at the paddock, riderless.
    this.horseRoot = new TransformNode('mount-horse-root', scene);
    this.horseMeshes.push(...buildHorseGraybox(scene, this.horseRoot, this.family, 'mount-horse'));
    this.horseMotor = createMotorState({ x: 0, y: courseGroundY(0, 3) + RIDDEN_MOTOR_CONFIG.capsuleHeight / 2, z: 3 }, 0);
    this.syncHorseMesh();

    // Real data-driven camera rig (Prompt 029/030): exterior baseline on foot.
    this.rig = new CameraRig(scene, baselineProfile('exterior'), -Math.PI / 2);
    const follow: FollowTarget = {
      position: () => this.followPoint(),
      velocity: () => this.followVelocity(),
      ignore: () => [this.playerMesh, ...this.horseMeshes],
    };
    this.rig.setTarget(follow);

    return scene;
  }

  override enter(): void {
    const canvas = this.ctx.engine.getRenderingCanvas();
    if (canvas) this.input = new CameraInputController(canvas);
    this.onKey = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      if (k === 'e' || k === 'enter' || k === ' ') this.pressAction();
      if (k === 'w' || k === 'arrowup') this.throttle = 1;
      if (k === 's' || k === 'arrowdown') this.throttle = 0;
    };
    window.addEventListener('keydown', this.onKey);
    this.installDebugApi();
  }

  override update(dt: number): void {
    if (dt > 0) this.step(dt);
    const input: CameraInput = this.input ? this.input.consume(dt) : ZERO_INPUT;
    this.updateCamera(dt, input);
  }

  override dispose(): void {
    if (this.onKey) window.removeEventListener('keydown', this.onKey);
    this.input?.dispose();
    this.rig?.dispose();
    delete (window as unknown as { sturdyVolleyMount?: unknown }).sturdyVolleyMount;
    super.dispose();
  }

  // --- Simulation -----------------------------------------------------------

  private step(dt: number): void {
    const wasTransition = this.mount.phase === 'mounting' || this.mount.phase === 'dismounting';
    if (wasTransition) this.mount = stepMountTransition(this.mount, dt);

    if (isRidden(this.mount)) {
      this.stepRidden(dt);
    } else if (this.mount.phase === 'free') {
      this.stepRiderlessHorse(dt);
      this.stepPlayerOnFoot(dt);
    } else {
      // Mid mount/dismount blend: hold the horse, ease the player toward/away.
      this.stepPlayerOnFoot(dt);
    }
    this.syncHorseMesh();
    this.syncPlayerMesh();
  }

  /** Ridden locomotion: the faster `RIDDEN_MOTOR_CONFIG` + gait ramp + momentum. */
  private stepRidden(dt: number): void {
    const targetSpeed = riddenGaitSpeed(gaitIndexFromThrottle(this.throttle));
    this.mount = { ...this.mount, speed: rampSpeed(this.mount.speed, targetSpeed, dt) };
    const mag = Math.hypot(this.moveX, this.moveZ);
    const moveDir = mag > 1e-4 ? { x: this.moveX / mag, z: this.moveZ / mag } : { x: 0, z: 0 };

    const env = this.envFor(this.horseMotor, moveDir, this.mount.speed * dt, RIDDEN_MOTOR_CONFIG.capsuleRadius);
    this.horseMotor = stepMotor(this.horseMotor, { moveDir, speed: this.mount.speed }, env, dt, RIDDEN_MOTOR_CONFIG);
    this.recoverHorse();
    this.trackCourse();
  }

  private stepRiderlessHorse(dt: number): void {
    // Calm wander within the paddock (free gait bands), nav-style target reseed.
    this.seed += 1;
    const tx = pseudo(this.seed) * (PADDOCK.maxX - PADDOCK.minX) + PADDOCK.minX;
    const tz = pseudo(this.seed + 17) * (PADDOCK.maxZ - PADDOCK.minZ) + PADDOCK.minZ;
    const pos = { x: this.horseMotor.position.x, z: this.horseMotor.position.z };
    const dir = { x: tx - pos.x, z: tz - pos.z };
    const d = Math.hypot(dir.x, dir.z);
    const moveDir = d > 0.4 ? { x: dir.x / d, z: dir.z / d } : { x: 0, z: 0 };
    const speed = d > 0.4 ? this.family.gaits[1].speed : 0; // amble
    const env = this.envFor(this.horseMotor, moveDir, speed * dt, RIDDEN_MOTOR_CONFIG.capsuleRadius);
    this.horseMotor = stepMotor(this.horseMotor, { moveDir, speed }, env, dt, RIDDEN_MOTOR_CONFIG);
    // Riderless recovery: never leave the paddock.
    const c = {
      x: Math.max(PADDOCK.minX, Math.min(PADDOCK.maxX, this.horseMotor.position.x)),
      z: Math.max(PADDOCK.minZ, Math.min(PADDOCK.maxZ, this.horseMotor.position.z)),
    };
    this.horseMotor.position.x = c.x;
    this.horseMotor.position.z = c.z;
  }

  private stepPlayerOnFoot(dt: number): void {
    const mag = Math.hypot(this.moveX, this.moveZ);
    const moveDir = mag > 1e-4 ? { x: this.moveX / mag, z: this.moveZ / mag } : { x: 0, z: 0 };
    const env = this.envFor(this.playerMotor, moveDir, PLAYER_SPEED * dt, 0.4);
    this.playerMotor = stepMotor(this.playerMotor, { moveDir, speed: mag > 1e-4 ? PLAYER_SPEED : 0 }, env, dt);
    const c = clampToCourse({ x: this.playerMotor.position.x, z: this.playerMotor.position.z });
    this.playerMotor.position.x = c.x;
    this.playerMotor.position.z = c.z;
  }

  /** Assemble the motor environment at a body's XZ from the course functions. */
  private envFor(motor: MotorState, moveDir: { x: number; z: number }, mag: number, radius: number): MotorEnvironment {
    const x = motor.position.x;
    const z = motor.position.z;
    const groundY = courseGroundY(x, z);
    return {
      ground: { hit: true, groundY, normal: { x: 0, y: 1, z: 0 } },
      wall: rockWall({ x, z }, radius, moveDir, mag),
      stepGround: NO_GROUND,
      ceiling: NO_CEILING,
      water: courseWater(x, z),
    };
  }

  private recoverHorse(): void {
    const c = clampToCourse({ x: this.horseMotor.position.x, z: this.horseMotor.position.z });
    this.horseMotor.position.x = c.x;
    this.horseMotor.position.z = c.z;
  }

  private trackCourse(): void {
    const z = this.horseMotor.position.z;
    if (this.horseMotor.medium === 'wade' && z >= FORD.minZ && z <= FORD.maxZ) this.forded = true;
    if (z >= BRIDGE.minZ && z <= BRIDGE.maxZ && Math.abs(this.horseMotor.position.x) <= BRIDGE.halfWidth) this.crossedBridge = true;
    if (z >= SEAM_Z) this.crossedSeam = true;
    // No-tunnel guard: the ridden body must never sit inside the rock footprint.
    const px = this.horseMotor.position.x;
    if (px > ROCK.minX && px < ROCK.maxX && z > ROCK.minZ && z < ROCK.maxZ) this.tunneled = true;
    this.minRiderY = Math.min(this.minRiderY, this.riderWorldY());
  }

  // --- Mount / dismount -----------------------------------------------------

  private pressAction(): boolean {
    const before = this.mount.phase;
    const playerXZ = { x: this.playerMotor.position.x, z: this.playerMotor.position.z };
    const horseXZ = { x: this.horseMotor.position.x, z: this.horseMotor.position.z };
    this.mount = toggleMount(this.mount, playerXZ, horseXZ, this.family.interactionDistance);
    if (this.mount.phase === 'dismounting') {
      // Place the rider beside the horse on valid ground.
      const pose = dismountPose(horseXZ, this.horseMotor.facing, 1.2);
      const c = clampToCourse(pose);
      this.playerMotor = groundedPoseAt(c.x, c.z, courseGroundY(c.x, c.z), this.horseMotor.facing);
    }
    return this.mount.phase !== before;
  }

  // --- Camera ---------------------------------------------------------------

  private updateCamera(dt: number, input: CameraInput): void {
    const wantMounted = shouldUseMountedCamera(this.mount);
    const ctx: CameraContextId = wantMounted ? 'mounted' : 'exterior';
    if (ctx !== this.cameraCtx) {
      this.cameraCtx = ctx;
      this.rig.setProfile(baselineProfile(ctx));
    }
    this.rig.setReducedMotion(this.reducedMotion);
    this.rig.update(dt, input);
  }

  /** The framed point: the rider's saddle when ridden, else the player chest. */
  private followPoint(): Vector3 {
    if (isRidden(this.mount) || this.mount.phase === 'mounting') {
      return new Vector3(this.horseMotor.position.x, this.riderWorldY(), this.horseMotor.position.z);
    }
    return new Vector3(this.playerMotor.position.x, this.playerMotor.position.y, this.playerMotor.position.z);
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
    const feetY = this.horseMotor.position.y - RIDDEN_MOTOR_CONFIG.capsuleHeight / 2;
    return feetY + (this.family.mountAnchor?.y ?? 1.5);
  }

  // --- Meshes ---------------------------------------------------------------

  private syncHorseMesh(): void {
    const feetY = this.horseMotor.position.y - RIDDEN_MOTOR_CONFIG.capsuleHeight / 2;
    this.horseRoot.position.set(this.horseMotor.position.x, feetY, this.horseMotor.position.z);
    this.horseRoot.rotation.y = this.horseMotor.facing;
  }

  private syncPlayerMesh(): void {
    if (isRidden(this.mount) || this.mount.phase === 'mounting') {
      // Seat the rider on the saddle anchor.
      this.playerMesh.position.set(this.horseMotor.position.x, this.riderWorldY() + PLAYER_HEIGHT / 2 - 0.4, this.horseMotor.position.z);
      this.playerMesh.rotation.y = this.horseMotor.facing;
    } else {
      this.playerMesh.position.set(this.playerMotor.position.x, this.playerMotor.position.y, this.playerMotor.position.z);
      this.playerMesh.rotation.y = this.playerMotor.facing;
    }
  }

  private buildCourse(scene: Scene): void {
    // Willa-Crick-side ground (green) up to the seam; Ballast-Bay-side (sand) beyond.
    const willa = MeshBuilder.CreateGround('mount-ground-willa', { width: 40, height: SEAM_Z + 12 }, scene);
    willa.position.set(0, 0, (SEAM_Z - 12) / 2);
    willa.material = flatMaterial(scene, 'mount-ground-willa', PALETTE.grass, 0.2);
    willa.isPickable = false;
    const bay = MeshBuilder.CreateGround('mount-ground-bay', { width: 40, height: 20 }, scene);
    bay.position.set(0, -0.01, SEAM_Z + 8);
    bay.material = flatMaterial(scene, 'mount-ground-bay', PALETTE.sand, 0.2);
    bay.isPickable = false;

    // Ford water plane (translucent).
    const ford = MeshBuilder.CreateGround('mount-ford', { width: 14, height: FORD.maxZ - FORD.minZ }, scene);
    ford.position.set(0, FORD.surfaceY, (FORD.minZ + FORD.maxZ) / 2);
    const fordMat = flatMaterial(scene, 'mount-ford', PALETTE.sea, 0.4);
    fordMat.alpha = 0.7;
    ford.material = fordMat;
    ford.isPickable = false;

    // Slope hump (a wedge box for the screenshot; logic is courseGroundY).
    const slope = MeshBuilder.CreateBox('mount-slope', { width: 12, height: SLOPE.peakY, depth: SLOPE.maxZ - SLOPE.minZ }, scene);
    slope.position.set(0, SLOPE.peakY / 2, (SLOPE.minZ + SLOPE.maxZ) / 2);
    slope.material = flatMaterial(scene, 'mount-slope', PALETTE.grassAlt, 0.2);
    slope.isPickable = false;

    // Bridge deck + rails.
    const deck = MeshBuilder.CreateBox('mount-bridge', { width: BRIDGE.halfWidth * 2, height: 0.2, depth: BRIDGE.maxZ - BRIDGE.minZ }, scene);
    deck.position.set(0, BRIDGE.deckY, (BRIDGE.minZ + BRIDGE.maxZ) / 2);
    deck.material = flatMaterial(scene, 'mount-bridge', PALETTE.wood, 0.22);
    deck.isPickable = false;
    for (const rx of [-BRIDGE.halfWidth, BRIDGE.halfWidth]) {
      const rail = MeshBuilder.CreateBox('mount-bridge-rail', { width: 0.15, height: 0.6, depth: BRIDGE.maxZ - BRIDGE.minZ }, scene);
      rail.position.set(rx, BRIDGE.deckY + 0.4, (BRIDGE.minZ + BRIDGE.maxZ) / 2);
      rail.material = flatMaterial(scene, 'mount-bridge-rail', PALETTE.wood, 0.22);
      rail.isPickable = false;
    }

    // Seam arch (two posts + lintel) marking the community-to-community boundary.
    for (const px of [-3.5, 3.5]) {
      const post = MeshBuilder.CreateBox('mount-seam-post', { width: 0.4, height: 4, depth: 0.4 }, scene);
      post.position.set(px, 2, SEAM_Z);
      post.material = flatMaterial(scene, 'mount-seam-post', PALETTE.roof, 0.22);
      post.isPickable = false;
    }
    const lintel = MeshBuilder.CreateBox('mount-seam-lintel', { width: 7.8, height: 0.5, depth: 0.4 }, scene);
    lintel.position.set(0, 4.2, SEAM_Z);
    lintel.material = flatMaterial(scene, 'mount-seam-lintel', PALETTE.roof, 0.22);
    lintel.isPickable = false;

    // Obstruction rock (pickable so the camera rig treats it as an occluder).
    const rock = MeshBuilder.CreateBox('mount-rock', { width: ROCK.maxX - ROCK.minX, height: 2.4, depth: ROCK.maxZ - ROCK.minZ }, scene);
    rock.position.set((ROCK.minX + ROCK.maxX) / 2, 1.2, (ROCK.minZ + ROCK.maxZ) / 2);
    rock.material = flatMaterial(scene, 'mount-rock', PALETTE.stone, 0.18);

    // Paddock fence (visual; PADDOCK bound is the logical pen).
    for (const [w, d, x, z] of [[10, 0.2, 0, -5], [0.2, 10, -5, 0], [0.2, 10, 5, 0]] as const) {
      const f = MeshBuilder.CreateBox('mount-fence', { width: w, height: 1.1, depth: d }, scene);
      f.position.set(x, 0.55, z);
      f.material = flatMaterial(scene, 'mount-fence', PALETTE.wood, 0.2);
      f.isPickable = false;
    }
  }

  // --- Debug API (deterministic; both-project e2e) --------------------------

  private installDebugApi(): void {
    const api = {
      meshCount: (): number => this.scene.meshes.length,
      state: (): {
        phase: MountState['phase'];
        ridden: boolean;
        owned: boolean;
        cameraContext: string;
        speed: number;
        horse: { x: number; z: number; facing: number };
        player: { x: number; z: number; y: number; grounded: boolean };
        riderGap: number;
      } => ({
        phase: this.mount.phase,
        ridden: isRidden(this.mount),
        owned: this.mount.owned,
        cameraContext: this.cameraCtx,
        speed: this.mount.speed,
        horse: { x: this.horseMotor.position.x, z: this.horseMotor.position.z, facing: this.horseMotor.facing },
        player: {
          x: this.playerMotor.position.x,
          z: this.playerMotor.position.z,
          y: this.playerMotor.position.y,
          grounded: this.playerMotor.grounded,
        },
        riderGap: Math.hypot(this.playerMotor.position.x - this.horseMotor.position.x, this.playerMotor.position.z - this.horseMotor.position.z),
      }),
      cameraState: () => this.rig.getState(),
      canMount: (): boolean => {
        const p = { x: this.playerMotor.position.x, z: this.playerMotor.position.z };
        const h = { x: this.horseMotor.position.x, z: this.horseMotor.position.z };
        return this.mount.phase === 'free' && this.mount.owned && Math.hypot(p.x - h.x, p.z - h.z) <= this.family.interactionDistance;
      },
      setMove: (x: number, z: number): void => {
        this.moveX = x;
        this.moveZ = z;
      },
      setThrottle: (t: number): void => {
        this.throttle = Math.max(0, Math.min(1, t));
      },
      setPlayer: (x: number, z: number): void => {
        this.playerMotor = groundedPoseAt(x, z, courseGroundY(x, z), this.playerMotor.facing);
        this.syncPlayerMesh();
      },
      pressAction: (): boolean => this.pressAction(),
      tick: (n = 1): void => {
        for (let i = 0; i < n; i++) {
          this.step(FIXED_DT);
          this.updateCamera(FIXED_DT, ZERO_INPUT);
        }
      },
      setReducedMotion: (on: boolean): void => {
        this.reducedMotion = on;
      },
      // Course-traversal proofs.
      forded: (): boolean => this.forded,
      crossedBridge: (): boolean => this.crossedBridge,
      crossedSeam: (): boolean => this.crossedSeam,
      tunneled: (): boolean => this.tunneled,
      minRiderY: (): number => (this.minRiderY === Infinity ? this.riderWorldY() : this.minRiderY),
      finite: (): boolean =>
        Number.isFinite(this.horseMotor.position.x) &&
        Number.isFinite(this.horseMotor.position.y) &&
        Number.isFinite(this.horseMotor.position.z),
      // Save / load.
      serialize: (): MountSave => serializeMount(this.mount, { x: this.horseMotor.position.x, z: this.horseMotor.position.z, facing: this.horseMotor.facing }),
      restore: (save: MountSave): void => {
        const r = restoreMount(save);
        this.mount = r.state;
        this.horseMotor = createMotorState({ x: r.horse.x, y: courseGroundY(r.horse.x, r.horse.z) + RIDDEN_MOTOR_CONFIG.capsuleHeight / 2, z: r.horse.z }, r.horse.facing);
        if (this.mount.phase === 'free') {
          this.playerMotor = groundedPoseAt(r.horse.x + 1.2, r.horse.z, courseGroundY(r.horse.x + 1.2, r.horse.z));
        }
        this.cameraCtx = shouldUseMountedCamera(this.mount) ? 'mounted' : 'exterior';
        this.rig.setProfile(baselineProfile(this.cameraCtx));
        this.syncHorseMesh();
        this.syncPlayerMesh();
      },
    };
    (window as unknown as { sturdyVolleyMount?: typeof api }).sturdyVolleyMount = api;
  }
}
