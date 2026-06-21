/**
 * Mount system (master Prompt 044): rideable horse + mount/dismount + ridden
 * locomotion. Pure + deterministic — no Babylon, no DOM, no physics-engine
 * import — so the ridden motor profile and the mount state machine are
 * unit-testable and behave identically across backends.
 *
 * Horseback is the early-game faster-transport option between Willa Crick and
 * Ballast Bay (§1.3). This module owns the parts that differ from on-foot play:
 *
 *  - the **ridden locomotion profile** — a distinct, faster MotorConfig + gait
 *    bands layered over the shared kinematic motor (`engine/motor.ts stepMotor`),
 *    with a momentum-based accel/brake ramp (a horse is not a person — it builds
 *    speed and turns in a wider arc);
 *  - the **mount/dismount state machine** — contextual one-button transitions
 *    with a short blend, plus the camera-handoff decision (`shouldUseMounted
 *    Camera`) the scene reads to swap to the Prompt 030 `mounted` baseline;
 *  - **save/restore** of the mounted/dismounted state + horse pose + ownership.
 *
 * The rideable horse **body** (proxy size, free-roam gaits, ford capability, nav
 * + recovery bounds when riderless, mount-anchor socket, save authority) lives in
 * `engine/animal-families.ts` as the `rideable-mount` family. This module is the
 * *ridden* layer on top of that body.
 *
 * Units: metres and seconds throughout.
 */
import type { MotorConfig } from './motor';

// --- Ridden locomotion profile ---------------------------------------------

/**
 * The ridden capsule + tuning: a **distinct, faster** profile vs. the on-foot
 * player motor (`DEFAULT_MOTOR_CONFIG`). The collision capsule is the combined
 * horse+rider unit (taller, broader); the gaits top out far above the player's
 * run; turning is deliberately *slower* than on foot (a wider arc — a horse
 * cannot pivot like a person); fording wades shallow water rather than swimming.
 * Documented in `docs/ANIMAL_AND_FAUNA_PHYSICS.md` §7.
 */
export const RIDDEN_MOTOR_CONFIG: MotorConfig = {
  capsuleHeight: 2.6, // horse body + seated rider
  capsuleRadius: 0.7,
  skinOffset: 0.08,
  gravity: -22,
  terminalFall: -45,
  turnRate: 6, // deliberate, wider arc than the on-foot 12 rad/s
  groundSnapDistance: 0.4,
  slopeLimitDeg: 40, // a large body holds slightly shallower ground than a goat
  stepOffset: 0.45, // steps onto bridge decks / low ledges without a jump
  slideSpeed: 6,
  recoverMinY: -25,
  swimDepth: 1.3, // fords (wades) water shallower than this; deeper would swim
  wadeSpeedFactor: 0.6,
  swimSpeedFactor: 0.5,
  waterlineOffset: 0.6,
  buoyancyLag: 0.25,
};

export interface MountGaitBand {
  name: string;
  /** Planar speed (m/s). */
  speed: number;
}

/**
 * Ridden gait bands — halt → gallop. Gallop (11 m/s) is far faster than the
 * on-foot player run (~5 m/s), so horseback is a genuine traversal upgrade.
 */
export const RIDDEN_GAITS: readonly MountGaitBand[] = [
  { name: 'halt', speed: 0 },
  { name: 'walk', speed: 2.0 },
  { name: 'trot', speed: 5.0 },
  { name: 'canter', speed: 8.0 },
  { name: 'gallop', speed: 11.0 },
];

/** Momentum: how fast the ridden speed ramps up toward the target gait (m/s²). */
export const RIDDEN_ACCEL = 6;
/** Momentum: how fast the ridden speed bleeds off when easing down (m/s²). */
export const RIDDEN_BRAKE = 9;

/** Speed (m/s) for a ridden gait index, clamped to the band table. */
export function riddenGaitSpeed(gaitIndex: number): number {
  const i = Math.max(0, Math.min(RIDDEN_GAITS.length - 1, Math.round(gaitIndex)));
  return RIDDEN_GAITS[i].speed;
}

/** Map a 0..1 throttle to a ridden gait index (0 = halt … last = gallop). */
export function gaitIndexFromThrottle(throttle01: number): number {
  const t = Math.max(0, Math.min(1, throttle01));
  return Math.round(t * (RIDDEN_GAITS.length - 1));
}

/**
 * Momentum ramp toward a target speed (the "accel" half of the ridden profile).
 * Accelerates at `RIDDEN_ACCEL`, decelerates at `RIDDEN_BRAKE`, never overshoots.
 */
export function rampSpeed(current: number, target: number, dt: number): number {
  if (target > current) return Math.min(target, current + RIDDEN_ACCEL * dt);
  if (target < current) return Math.max(target, current - RIDDEN_BRAKE * dt);
  return current;
}

// --- Mount / dismount state machine ----------------------------------------

export type MountPhase = 'free' | 'mounting' | 'ridden' | 'dismounting';

export interface MountState {
  phase: MountPhase;
  /** Transition progress 0..1 while `mounting`/`dismounting`; 0 otherwise. */
  transition: number;
  /** Tamed/owned by the player — persists across save (acceptance: ownership). */
  owned: boolean;
  /** Current ridden speed (m/s), carried for the momentum ramp. */
  speed: number;
}

/** Seconds the mount/dismount blend takes (camera + pose ease over this). */
export const MOUNT_DURATION = 0.45;

export function createMountState(owned = true): MountState {
  return { phase: 'free', transition: 0, owned, speed: 0 };
}

/** Whether the player may mount: free, owned, and within the horse's reach. */
export function canMount(
  playerXZ: { x: number; z: number },
  horseXZ: { x: number; z: number },
  reach: number,
  state: MountState,
): boolean {
  if (state.phase !== 'free' || !state.owned) return false;
  return Math.hypot(playerXZ.x - horseXZ.x, playerXZ.z - horseXZ.z) <= reach;
}

/** Begin mounting (free → mounting). No-op unless currently free. */
export function beginMount(state: MountState): MountState {
  if (state.phase !== 'free') return state;
  return { ...state, phase: 'mounting', transition: 0, speed: 0 };
}

/** Begin dismounting (ridden → dismounting). No-op unless currently ridden. */
export function beginDismount(state: MountState): MountState {
  if (state.phase !== 'ridden') return state;
  return { ...state, phase: 'dismounting', transition: 0, speed: 0 };
}

/**
 * Advance an in-progress mount/dismount blend. At completion, `mounting`→`ridden`
 * and `dismounting`→`free`. Stable (idempotent) in the `free`/`ridden` phases.
 */
export function stepMountTransition(state: MountState, dt: number, duration = MOUNT_DURATION): MountState {
  if (state.phase !== 'mounting' && state.phase !== 'dismounting') return state;
  const t = Math.min(1, state.transition + dt / Math.max(1e-6, duration));
  if (t >= 1) {
    return { ...state, phase: state.phase === 'mounting' ? 'ridden' : 'free', transition: 0, speed: 0 };
  }
  return { ...state, transition: t };
}

/** One-button contextual action: mount when free+in-reach, dismount when ridden. */
export function toggleMount(
  state: MountState,
  playerXZ: { x: number; z: number },
  horseXZ: { x: number; z: number },
  reach: number,
): MountState {
  if (state.phase === 'ridden') return beginDismount(state);
  if (canMount(playerXZ, horseXZ, reach, state)) return beginMount(state);
  return state;
}

export function isRidden(state: MountState): boolean {
  return state.phase === 'ridden';
}

/**
 * Whether the camera should use the Prompt 030 `mounted` baseline this frame.
 * True while `mounting` + `ridden` (the camera eases up as the rider settles);
 * reverts at `dismounting` so the blend back to the on-foot context has the full
 * dismount duration and lands with no discontinuity. Returns a boolean so the
 * engine layer stays decoupled from the camera profile catalogue.
 */
export function shouldUseMountedCamera(state: MountState): boolean {
  return state.phase === 'mounting' || state.phase === 'ridden';
}

// --- Dismount pose ----------------------------------------------------------

/**
 * A valid grounded XZ for the rider to step off to — beside the horse, offset to
 * the horse's left of travel so the player never lands inside the body. The
 * scene grounds the Y via the motor (`groundedPoseAt`).
 */
export function dismountPose(
  horseXZ: { x: number; z: number },
  horseFacing: number,
  sideOffset = 1.2,
): { x: number; z: number } {
  // Left of facing: facing is atan2(x, z); left = facing + 90°.
  const left = horseFacing + Math.PI / 2;
  return {
    x: horseXZ.x + Math.sin(left) * sideOffset,
    z: horseXZ.z + Math.cos(left) * sideOffset,
  };
}

// --- Save / restore ---------------------------------------------------------

/** Persisted mount state: collapsed to a stable phase + horse pose + ownership. */
export interface MountSave {
  /** Only the stable phases persist; a mid-transition save snaps to its endpoint. */
  phase: 'free' | 'ridden';
  owned: boolean;
  horse: { x: number; z: number; facing: number };
}

/** Serialize for save: mid-transition snaps to its destination phase. */
export function serializeMount(state: MountState, horse: { x: number; z: number; facing: number }): MountSave {
  const phase: 'free' | 'ridden' =
    state.phase === 'ridden' || state.phase === 'mounting' ? 'ridden' : 'free';
  return { phase, owned: state.owned, horse: { x: horse.x, z: horse.z, facing: horse.facing } };
}

/** Restore from save to a valid stable state + horse pose. */
export function restoreMount(save: MountSave): { state: MountState; horse: { x: number; z: number; facing: number } } {
  return {
    state: { phase: save.phase, transition: 0, owned: save.owned, speed: 0 },
    horse: { ...save.horse },
  };
}
