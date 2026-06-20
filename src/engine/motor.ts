/**
 * Kinematic capsule motor core (WEF-02a, master Prompt 031). Pure + deterministic
 * — no Babylon, no physics-engine import. It integrates one fixed step of the
 * player capsule from the current state, the desired horizontal input, and a
 * ground probe supplied by the physics adapter (`src/physics/motor-physics.ts`).
 *
 * This is the single source of grounding / gravity / ground-snap / facing-turn
 * behaviour; the scene and both physics backends (Havok, ray-pick) feed it the
 * same `GroundHit`, so the motor behaves identically regardless of backend.
 *
 * Horizontal speed comes from the existing locomotion controller
 * (`src/engine/controller.ts`) so stamina + gait stay authoritative; the motor
 * only owns vertical motion, grounding, and facing. Terrain handling (slope
 * limit, step-up, stairs, low ceilings, pushing) is Prompt 032.
 *
 * Units: metres and seconds throughout.
 */

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
};

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface MotorState {
  /** Capsule centre position (m). Feet are at `y - capsuleHeight/2`. */
  position: Vec3;
  /** Vertical velocity (m/s). */
  velocityY: number;
  /** Whether the capsule is resting on ground this step. */
  grounded: boolean;
  /** Facing yaw (rad), atan2(x, z) convention. */
  facing: number;
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
  /** Y component of the ground normal (1 = flat). */
  normalY: number;
}

export function createMotorState(position: Vec3, facing = 0): MotorState {
  // Copy by accessor (not spread): `position` may be a Babylon Vector3 whose
  // x/y/z are getters — `{ ...v }` would copy the private _x/_y/_z and leave
  // x/y/z undefined, poisoning the motor with NaN.
  return {
    position: { x: position.x, y: position.y, z: position.z },
    velocityY: 0,
    grounded: false,
    facing,
  };
}

const TWO_PI = Math.PI * 2;

/** Shortest-arc step of `current` toward `target` by at most `maxStep` (rad). */
export function turnToward(current: number, target: number, maxStep: number): number {
  let diff = (target - current) % TWO_PI;
  if (diff > Math.PI) diff -= TWO_PI;
  else if (diff < -Math.PI) diff += TWO_PI;
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

/**
 * Integrate one motor step. Deterministic given the same inputs + dt.
 */
export function stepMotor(
  state: MotorState,
  input: MotorStepInput,
  ground: GroundHit,
  dt: number,
  cfg: MotorConfig = DEFAULT_MOTOR_CONFIG,
): MotorState {
  const half = cfg.capsuleHeight / 2;

  // Horizontal move (camera-relative direction already resolved by the caller).
  let x = state.position.x;
  let z = state.position.z;
  if (input.moveDir.x !== 0 || input.moveDir.z !== 0) {
    x += input.moveDir.x * input.speed * dt;
    z += input.moveDir.z * input.speed * dt;
  }

  // Vertical: grounding + gravity.
  let y = state.position.y;
  let vy = state.velocityY;
  let grounded = false;
  const groundY = ground.hit ? ground.groundY : Number.NEGATIVE_INFINITY;
  const feetY = y - half;
  const distToGround = feetY - groundY;

  if (ground.hit && vy <= 0 && distToGround <= cfg.groundSnapDistance + cfg.skinOffset) {
    // Resting on (or snapping down to) the ground.
    y = groundY + half;
    vy = 0;
    grounded = true;
  } else {
    // Airborne: integrate gravity, then catch the ground if we passed through it.
    vy = Math.max(cfg.terminalFall, vy + cfg.gravity * dt);
    y += vy * dt;
    const newFeetY = y - half;
    if (ground.hit && vy <= 0 && newFeetY <= groundY) {
      y = groundY + half;
      vy = 0;
      grounded = true;
    }
  }

  // Facing: turn toward the move direction.
  let facing = state.facing;
  if (input.moveDir.x !== 0 || input.moveDir.z !== 0) {
    const target = Math.atan2(input.moveDir.x, input.moveDir.z);
    facing = turnToward(facing, target, cfg.turnRate * dt);
  }

  return { position: { x, y, z }, velocityY: vy, grounded, facing };
}
