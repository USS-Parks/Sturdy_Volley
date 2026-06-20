/**
 * Local avoidance + door-queue steering (WEF-07b, master Prompt 041).
 *
 * Pure, deterministic. Sits between the navigation service (which gives a
 * desired heading) and the shared motor (which moves the body): it nudges the
 * desired velocity away from nearby agents, the player, and dynamic obstacles so
 * NPCs don't overlap, shove the player, or deadlock head-on — and it serialises
 * off-mesh link crossings (door queue) so two NPCs don't dance in a doorway.
 */

export interface Vec2 {
  x: number;
  z: number;
}

/** A circular obstacle to avoid (another NPC, the player, a dynamic prop). */
export interface Obstacle {
  x: number;
  z: number;
  radius: number;
  /** The player is never pushed: NPCs yield to, never displace, the player. */
  isPlayer?: boolean;
}

export interface AvoidConfig {
  /** Personal-space radius added to each obstacle before steering kicks in. */
  radius: number;
  /** Max output speed (m/s). */
  maxSpeed: number;
  /** Separation push strength (0..n). */
  separation: number;
  /** Perpendicular bias to break symmetric head-on deadlock (consistent side). */
  perpBias: number;
}

export const DEFAULT_AVOID_CONFIG: AvoidConfig = {
  radius: 0.6,
  maxSpeed: 2.6,
  separation: 1.4,
  perpBias: 0.8,
};

/** Whether two circles overlap given a minimum centre separation. */
export function wouldOverlap(a: Vec2, b: Vec2, minDist: number): boolean {
  return Math.hypot(a.x - b.x, a.z - b.z) < minDist;
}

/**
 * Steer a desired heading away from obstacles. Returns a velocity vector
 * (m/s). With no nearby obstacles it is `desiredDir * speed`; near obstacles it
 * gains a separation push (stronger the closer) + a consistent perpendicular
 * bias so two agents converging head-on slide past instead of jamming.
 */
export function steerAvoid(
  pos: Vec2,
  desiredDir: Vec2,
  speed: number,
  obstacles: readonly Obstacle[],
  cfg: AvoidConfig = DEFAULT_AVOID_CONFIG,
): Vec2 {
  let vx = desiredDir.x * speed;
  let vz = desiredDir.z * speed;

  for (const obs of obstacles) {
    const dx = pos.x - obs.x;
    const dz = pos.z - obs.z;
    const d = Math.hypot(dx, dz);
    const influence = obs.radius + cfg.radius;
    if (d >= influence) continue;
    if (d < 1e-4) {
      // Exactly coincident: shove along a deterministic axis to separate.
      vx += cfg.separation * speed;
      continue;
    }
    const strength = ((influence - d) / influence) * cfg.separation;
    // The player gets extra yield weight (NPCs never crowd the player).
    const weight = obs.isPlayer ? 1.6 : 1;
    // Separation: push directly away.
    vx += (dx / d) * strength * weight * speed;
    vz += (dz / d) * strength * weight * speed;
    // Perpendicular bias: rotate the away vector 90° (consistent side).
    vx += (-dz / d) * strength * cfg.perpBias * speed;
    vz += (dx / d) * strength * cfg.perpBias * speed;
  }

  const m = Math.hypot(vx, vz);
  if (m > cfg.maxSpeed && m > 1e-9) {
    vx = (vx / m) * cfg.maxSpeed;
    vz = (vz / m) * cfg.maxSpeed;
  }
  return { x: vx, z: vz };
}

/**
 * Door-queue gate: an agent may begin crossing a link only if no *other* agent
 * is already on it within `clearance`. Returns true when the agent should wait
 * (yield its turn). Serialises link traversal so doorways never jam.
 */
export function shouldWaitForLink(
  linkPoint: Vec2,
  selfId: string,
  occupants: ReadonlyArray<{ id: string; x: number; z: number }>,
  clearance = 1.0,
): boolean {
  for (const o of occupants) {
    if (o.id === selfId) continue;
    if (Math.hypot(o.x - linkPoint.x, o.z - linkPoint.z) <= clearance) return true;
  }
  return false;
}
