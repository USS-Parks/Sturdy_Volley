/**
 * Pure, deterministic camera math the rig runs each frame (WEF-01b, Prompt 029):
 * manual-orbit clamping, auto-recenter grace, look-ahead lead, exponential
 * follow smoothing, and obstruction pull-in / occluder-fade resolution. No
 * Babylon import — all behaviour is driven by CameraProfile data so it is fully
 * unit-testable and tunable from profile data alone.
 */
import type { CameraProfile } from './profiles';

export interface Planar {
  x: number;
  z: number;
}

const DEG2RAD = Math.PI / 180;

/** Normalise an angle to (-π, π]. */
export function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  let r = a % twoPi;
  if (r <= -Math.PI) r += twoPi;
  else if (r > Math.PI) r -= twoPi;
  return r;
}

/** Clamp a manual yaw offset (rad) to ±limit. null limit = unbounded (wrapped). */
export function clampYawOffset(yawOffset: number, limitDeg: number | null): number {
  const wrapped = wrapAngle(yawOffset);
  if (limitDeg == null) return wrapped;
  const lim = limitDeg * DEG2RAD;
  return Math.max(-lim, Math.min(lim, wrapped));
}

/** Apply a manual yaw delta, clamped to the profile's orbit limit. */
export function applyYawInput(yawOffset: number, deltaRad: number, profile: CameraProfile): number {
  return clampYawOffset(yawOffset + deltaRad, profile.yawLimitDeg);
}

/**
 * Auto-recenter: once the player has not touched the camera for `recenterDelay`
 * seconds, decay the manual yaw offset toward 0 at `recenterSpeed` rad/s without
 * overshooting. Before the grace window elapses the offset is held.
 */
export function stepRecenter(
  yawOffset: number,
  timeSinceInput: number,
  profile: CameraProfile,
  dt: number,
): number {
  if (timeSinceInput < profile.recenterDelay) return yawOffset;
  const step = profile.recenterSpeed * dt;
  if (Math.abs(yawOffset) <= step) return 0;
  return yawOffset - Math.sign(yawOffset) * step;
}

/**
 * Planar look-ahead lead: lead the framed target in the direction of motion by
 * `lookAheadGain` metres per (m/s) of speed, clamped to `lookAheadMax`. Zero
 * velocity → zero lead. Gait-scaled contexts (mounted) carry the larger gains.
 */
export function lookAheadLead(velocity: Planar, profile: CameraProfile): Planar {
  const speed = Math.hypot(velocity.x, velocity.z);
  if (speed < 1e-4) return { x: 0, z: 0 };
  const lead = Math.min(profile.lookAheadMax, speed * profile.lookAheadGain);
  return { x: (velocity.x / speed) * lead, z: (velocity.z / speed) * lead };
}

/**
 * Frame-rate-independent exponential smoothing toward a target with time
 * constant `lag` (s). lag <= 0 snaps. Deterministic given dt.
 */
export function dampToward(current: number, target: number, lag: number, dt: number): number {
  if (lag <= 0 || dt <= 0) return target;
  const t = 1 - Math.exp(-dt / lag);
  return current + (target - current) * t;
}

/** Smooth a planar position toward a target with the same time constant. */
export function dampPlanar(current: Planar, target: Planar, lag: number, dt: number): Planar {
  return { x: dampToward(current.x, target.x, lag, dt), z: dampToward(current.z, target.z, lag, dt) };
}

export interface ObstructionResult {
  /** The follow distance the rig should use this frame (m). */
  distance: number;
  /** Occluder fade in 0..1 (0 = fully visible, 1 = fully faded). */
  fade: number;
}

/**
 * Resolve a camera obstruction. `hitDistance` is the distance to the nearest
 * blocker along camera→target (or null when the line of sight is clear).
 *
 * When blocked the camera pulls in toward the target (never closer than
 * `minDistance`) at `pullSpeed`, and when the blocker sits inside
 * `fadeThreshold × desiredDistance` an occluder-fade factor ramps up so an
 * interior wall can be faded/cut rather than slammed into the lens.
 */
export function stepObstruction(
  currentDistance: number,
  desiredDistance: number,
  hitDistance: number | null,
  profile: CameraProfile,
  dt: number,
): ObstructionResult {
  const o = profile.obstruction;
  let targetDistance = desiredDistance;
  let fade = 0;

  if (hitDistance != null && hitDistance < desiredDistance) {
    targetDistance = Math.max(o.minDistance, hitDistance - o.probeRadius);
    const fadeBand = desiredDistance * o.fadeThreshold;
    if (hitDistance < fadeBand) {
      fade = Math.min(1, (fadeBand - hitDistance) / Math.max(1e-3, fadeBand));
    }
  }

  const step = o.pullSpeed * dt;
  let distance: number;
  if (Math.abs(targetDistance - currentDistance) <= step) distance = targetDistance;
  else distance = currentDistance + Math.sign(targetDistance - currentDistance) * step;

  return { distance, fade };
}
