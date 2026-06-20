/**
 * Kinematic capsule motor core (WEF-02a/02b, master Prompts 031–032). Pure +
 * deterministic — no Babylon, no physics-engine import. Integrates one fixed
 * step of the player capsule from the current state, the desired horizontal
 * input, and a `MotorEnvironment` (ground + wall + step + ceiling probes) the
 * physics adapter assembles (`src/physics/motor-physics.ts`).
 *
 * This is the single source of grounding, gravity, ground-snap, slope handling,
 * step-up, wall collide-and-slide, ceiling clamp, moving-platform carry,
 * penetration recovery, out-of-bounds recovery, and facing — so the motor
 * behaves identically across the Havok and ray-pick backends.
 *
 * Horizontal speed comes from the existing locomotion controller
 * (`src/engine/controller.ts`) so stamina + gait stay authoritative; the motor
 * owns everything else.
 *
 * Units: metres and seconds throughout.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface MotorConfig {
  /** Capsule total height (m). */
  capsuleHeight: number;
  /** Capsule radius (m). */
  capsuleRadius: number;
  /** Contact/skin offset kept between the capsule and surfaces (m). */
  skinOffset: number;
  /** Gravity acceleration (m/s², negative = down). */
  gravity: number;
  /** Terminal fall speed (m/s, negative). */
  terminalFall: number;
  /** Facing turn rate toward the move direction (rad/s). */
  turnRate: number;
  /** Max drop the feet snap down to while grounded (m) — small steps down. */
  groundSnapDistance: number;
  /** Steepest ground (deg from horizontal) the player can stand on; steeper = slide. */
  slopeLimitDeg: number;
  /** Max upward step the capsule climbs without jumping (m). */
  stepOffset: number;
  /** Downhill slide speed on too-steep ground (m/s). */
  slideSpeed: number;
  /** Y below which the player is out of bounds and recovers to the last safe pose (m). */
  recoverMinY: number;
}

/** Locked motor tuning (documented in docs/GAMEPLAY_MOTOR.md). */
export const DEFAULT_MOTOR_CONFIG: MotorConfig = {
  capsuleHeight: 1.8,
  capsuleRadius: 0.4,
  skinOffset: 0.08,
  gravity: -22,
  terminalFall: -45,
  turnRate: 12,
  groundSnapDistance: 0.35,
  slopeLimitDeg: 50,
  stepOffset: 0.4,
  slideSpeed: 6,
  recoverMinY: -25,
};

export interface MotorState {
  /** Capsule centre position (m). Feet are at `y - capsuleHeight/2`. */
  position: Vec3;
  /** Vertical velocity (m/s). */
  velocityY: number;
  /** Whether the capsule is resting on ground this step. */
  grounded: boolean;
  /** Whether the capsule is sliding down too-steep ground this step. */
  sliding: boolean;
  /** Facing yaw (rad), atan2(x, z) convention. */
  facing: number;
  /** Last stably-grounded pose, used for out-of-bounds recovery. */
  lastSafe: Vec3;
}

export interface MotorStepInput {
  /** Desired planar move direction (any magnitude; zero = no input). */
  moveDir: { x: number; z: number };
  /** Horizontal speed magnitude from the locomotion controller (m/s). */
  speed: number;
}

export interface GroundHit {
  hit: boolean;
  /** World Y of the ground surface beneath the capsule (m). */
  groundY: number;
  /** Ground surface normal (unit). normal.y near 1 = flat. */
  normal: Vec3;
  /** Velocity of a moving platform the capsule is standing on (m/s), if any. */
  platformVel?: { x: number; z: number };
}

export interface WallHit {
  hit: boolean;
  /** Gap from the capsule surface to the blocker along the move direction (m);
   *  negative = already penetrating. */
  distance: number;
  /** Wall normal (unit); only the planar x/z components are used. */
  normal: Vec3;
}

export interface CeilingHit {
  hit: boolean;
  /** World Y of the ceiling above the capsule (m). */
  ceilingY: number;
}

/** Everything the motor needs to resolve one step, from the physics adapter. */
export interface MotorEnvironment {
  ground: GroundHit;
  /** Blocker in the move direction (walls / too-tall steps). */
  wall: WallHit;
  /** Ground just beyond a wall, used to decide a step-up. */
  stepGround: GroundHit;
  /** Ceiling directly above the capsule. */
  ceiling: CeilingHit;
}

export const NO_WALL: WallHit = { hit: false, distance: Number.POSITIVE_INFINITY, normal: { x: 0, y: 0, z: 0 } };
export const NO_CEILING: CeilingHit = { hit: false, ceilingY: Number.POSITIVE_INFINITY };
export const NO_GROUND: GroundHit = { hit: false, groundY: 0, normal: { x: 0, y: 1, z: 0 } };

/** Flat ground hit at a given Y (convenience for callers + tests). */
export function flatGround(groundY = 0, platformVel?: { x: number; z: number }): GroundHit {
  return { hit: true, groundY, normal: { x: 0, y: 1, z: 0 }, ...(platformVel ? { platformVel } : {}) };
}

/** Wrap a ground hit into an otherwise-open environment (no wall/step/ceiling). */
export function openEnv(ground: GroundHit): MotorEnvironment {
  return { ground, wall: NO_WALL, stepGround: NO_GROUND, ceiling: NO_CEILING };
}

export function createMotorState(position: Vec3, facing = 0): MotorState {
  // Copy by accessor (not spread): `position` may be a Babylon Vector3 whose
  // x/y/z are getters — `{ ...v }` would copy the private _x/_y/_z and leave
  // x/y/z undefined, poisoning the motor with NaN.
  const p = { x: position.x, y: position.y, z: position.z };
  return { position: { ...p }, velocityY: 0, grounded: false, sliding: false, facing, lastSafe: { ...p } };
}

const TWO_PI = Math.PI * 2;
const RAD2DEG = 180 / Math.PI;

/** Shortest-arc step of `current` toward `target` by at most `maxStep` (rad). */
export function turnToward(current: number, target: number, maxStep: number): number {
  let diff = (target - current) % TWO_PI;
  if (diff > Math.PI) diff -= TWO_PI;
  else if (diff < -Math.PI) diff += TWO_PI;
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

/** Surface slope in degrees from horizontal, from its normal's Y component. */
export function slopeAngleDeg(normalY: number): number {
  return Math.acos(Math.max(-1, Math.min(1, normalY))) * RAD2DEG;
}

/**
 * Integrate one motor step. Deterministic given the same inputs + dt.
 */
export function stepMotor(
  state: MotorState,
  input: MotorStepInput,
  env: MotorEnvironment,
  dt: number,
  cfg: MotorConfig = DEFAULT_MOTOR_CONFIG,
): MotorState {
  const half = cfg.capsuleHeight / 2;
  let x = state.position.x;
  let y = state.position.y;
  let z = state.position.z;
  let vy = state.velocityY;
  let facing = state.facing;
  let lastSafe = state.lastSafe;

  const moving = input.moveDir.x !== 0 || input.moveDir.z !== 0;
  const mag = moving ? input.speed * dt : 0;

  // --- Horizontal move: wall collide-and-slide + step-up --------------------
  let steppedUp = false;
  let dx = moving ? input.moveDir.x * mag : 0;
  let dz = moving ? input.moveDir.z * mag : 0;

  if (moving && env.wall.hit && env.wall.distance < mag + cfg.skinOffset) {
    const feetY = y - half;
    const stepRise = env.stepGround.hit ? env.stepGround.groundY - feetY : Number.POSITIVE_INFINITY;
    const headRoom = env.ceiling.hit ? env.ceiling.ceilingY - (y + half) : Number.POSITIVE_INFINITY;
    if (env.stepGround.hit && stepRise > 1e-3 && stepRise <= cfg.stepOffset && headRoom > stepRise) {
      // Step up onto the surface beyond the wall; keep the full horizontal move.
      y = env.stepGround.groundY + half;
      steppedUp = true;
    } else {
      // Collide-and-slide: advance to the wall, slide the remainder along it.
      const along = Math.max(0, env.wall.distance - cfg.skinOffset);
      const n = env.wall.normal;
      const dot = input.moveDir.x * n.x + input.moveDir.z * n.z;
      const sx = input.moveDir.x - dot * n.x;
      const sz = input.moveDir.z - dot * n.z;
      const remain = Math.max(0, mag - along);
      dx = input.moveDir.x * along + sx * remain;
      dz = input.moveDir.z * along + sz * remain;
    }
  }
  x += dx;
  z += dz;

  // --- Penetration recovery: push out of a wall we are already inside -------
  if (env.wall.hit && env.wall.distance < 0) {
    const push = -env.wall.distance + cfg.skinOffset;
    x += env.wall.normal.x * push;
    z += env.wall.normal.z * push;
  }

  // --- Vertical: grounding + gravity ---------------------------------------
  const g = env.ground;
  const groundY = g.hit ? g.groundY : Number.NEGATIVE_INFINITY;
  let grounded = false;
  if (steppedUp) {
    grounded = true;
    vy = 0;
  } else {
    const feetY = y - half;
    const distToGround = feetY - groundY;
    if (g.hit && vy <= 0 && distToGround <= cfg.groundSnapDistance + cfg.skinOffset) {
      y = groundY + half;
      vy = 0;
      grounded = true;
    } else {
      vy = Math.max(cfg.terminalFall, vy + cfg.gravity * dt);
      y += vy * dt;
      const newFeetY = y - half;
      if (g.hit && vy <= 0 && newFeetY <= groundY) {
        y = groundY + half;
        vy = 0;
        grounded = true;
      }
    }
  }

  // --- Slope: slide down ground steeper than the limit ---------------------
  let sliding = false;
  if (grounded && g.hit) {
    const angle = slopeAngleDeg(g.normal.y);
    if (angle > cfg.slopeLimitDeg) {
      sliding = true;
      const hl = Math.hypot(g.normal.x, g.normal.z) || 1;
      const steepness = Math.min(1, (angle - cfg.slopeLimitDeg) / 20 + 0.3);
      const slide = cfg.slideSpeed * dt * steepness;
      x += (g.normal.x / hl) * slide;
      z += (g.normal.z / hl) * slide;
    }
  }

  // --- Ceiling: do not let the head pass into it ---------------------------
  if (env.ceiling.hit) {
    const maxY = env.ceiling.ceilingY - half - cfg.skinOffset;
    if (y > maxY) {
      y = maxY;
      if (vy > 0) vy = 0;
    }
  }

  // --- Moving-platform contact contract ------------------------------------
  if (grounded && g.platformVel) {
    x += g.platformVel.x * dt;
    z += g.platformVel.z * dt;
  }

  // --- Facing ---------------------------------------------------------------
  if (moving) {
    const target = Math.atan2(input.moveDir.x, input.moveDir.z);
    facing = turnToward(facing, target, cfg.turnRate * dt);
  }

  // --- Safe-pose tracking + out-of-bounds recovery -------------------------
  if (grounded && !sliding) lastSafe = { x, y, z };
  if (y < cfg.recoverMinY) {
    return {
      position: { ...lastSafe },
      velocityY: 0,
      grounded: true,
      sliding: false,
      facing,
      lastSafe,
    };
  }

  return { position: { x, y, z }, velocityY: vy, grounded, sliding, facing, lastSafe };
}
