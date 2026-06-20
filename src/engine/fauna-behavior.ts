/**
 * Wild-fauna behaviours (WEF-08b, master Prompt 043).
 *
 * Pure, deterministic steering primitives for the wild families — flee, flock
 * (boids: separation + alignment + cohesion), patrol, and forage — returning a
 * desired velocity/heading the shared motor consumes. Species-appropriate
 * combinations are assembled per family in the proving ground; none of this
 * requires an animal to be a dynamic rigid body.
 */

export interface Vec2 {
  x: number;
  z: number;
}

export interface Boid extends Vec2 {
  /** Current velocity (m/s). */
  vx: number;
  vz: number;
}

/**
 * Velocity directly away from a threat (the player, a predator), scaled to
 * `speed`, falling to zero outside `radius`. Stronger the closer the threat.
 */
export function fleeVelocity(pos: Vec2, threat: Vec2, speed: number, radius: number): Vec2 {
  const dx = pos.x - threat.x;
  const dz = pos.z - threat.z;
  const d = Math.hypot(dx, dz);
  if (d >= radius || d < 1e-6) return { x: 0, z: 0 };
  const urgency = (radius - d) / radius; // 0..1
  return { x: (dx / d) * speed * urgency, z: (dz / d) * speed * urgency };
}

export interface FlockConfig {
  /** Below this distance, neighbours push apart (separation). */
  separationRadius: number;
  /** Within this distance, neighbours align + cohere. */
  neighborRadius: number;
  sepWeight: number;
  alignWeight: number;
  cohWeight: number;
  maxSpeed: number;
}

export const DEFAULT_FLOCK_CONFIG: FlockConfig = {
  separationRadius: 1.2,
  neighborRadius: 4,
  sepWeight: 1.6,
  alignWeight: 1.0,
  cohWeight: 0.9,
  maxSpeed: 3,
};

/**
 * Boids flocking velocity: separation (avoid crowding) + alignment (match
 * neighbour heading) + cohesion (steer toward the local centre). Returns a
 * velocity clamped to `maxSpeed`. With no neighbours it returns the boid's
 * current velocity (keep gliding).
 */
export function flockVelocity(self: Boid, neighbors: readonly Boid[], cfg: FlockConfig = DEFAULT_FLOCK_CONFIG): Vec2 {
  let sepX = 0;
  let sepZ = 0;
  let alignX = 0;
  let alignZ = 0;
  let cohX = 0;
  let cohZ = 0;
  let count = 0;

  for (const n of neighbors) {
    const dx = self.x - n.x;
    const dz = self.z - n.z;
    const d = Math.hypot(dx, dz);
    if (d > cfg.neighborRadius || d < 1e-6) continue;
    count++;
    if (d < cfg.separationRadius) {
      sepX += dx / d;
      sepZ += dz / d;
    }
    alignX += n.vx;
    alignZ += n.vz;
    cohX += n.x;
    cohZ += n.z;
  }

  let vx = self.vx;
  let vz = self.vz;
  if (count > 0) {
    alignX /= count;
    alignZ /= count;
    cohX = cohX / count - self.x;
    cohZ = cohZ / count - self.z;
    vx += sepX * cfg.sepWeight + alignX * cfg.alignWeight + cohX * cfg.cohWeight;
    vz += sepZ * cfg.sepWeight + alignZ * cfg.alignWeight + cohZ * cfg.cohWeight;
  }
  const m = Math.hypot(vx, vz);
  if (m > cfg.maxSpeed && m > 1e-9) {
    vx = (vx / m) * cfg.maxSpeed;
    vz = (vz / m) * cfg.maxSpeed;
  }
  return { x: vx, z: vz };
}

export interface PatrolResult {
  /** Unit direction toward the current waypoint (zero when the loop is empty). */
  dir: Vec2;
  /** The (possibly advanced) waypoint index. */
  index: number;
  arrived: boolean;
}

/**
 * Patrol a looping list of waypoints: steer toward the current one and advance
 * (wrapping) once within `arrivalRadius`.
 */
export function patrolStep(waypoints: readonly Vec2[], index: number, pos: Vec2, arrivalRadius = 0.5): PatrolResult {
  if (waypoints.length === 0) return { dir: { x: 0, z: 0 }, index, arrived: false };
  const wp = waypoints[index % waypoints.length];
  const dx = wp.x - pos.x;
  const dz = wp.z - pos.z;
  const d = Math.hypot(dx, dz);
  if (d <= arrivalRadius) {
    return { dir: { x: 0, z: 0 }, index: (index + 1) % waypoints.length, arrived: true };
  }
  return { dir: { x: dx / d, z: dz / d }, index, arrived: false };
}

/**
 * Forage wander: a fresh random target within `[min,max]` bounds when the
 * previous one is reached. Deterministic from `seed`.
 */
export function forageTarget(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, seed: number): Vec2 {
  const rx = pseudo(seed) * (bounds.maxX - bounds.minX) + bounds.minX;
  const rz = pseudo(seed + 41) * (bounds.maxZ - bounds.minZ) + bounds.minZ;
  return { x: rx, z: rz };
}

function pseudo(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
