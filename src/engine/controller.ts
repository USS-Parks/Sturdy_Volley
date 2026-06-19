/**
 * Renderer-agnostic player locomotion state (Prompt 005): turns a desired move
 * direction + sprint intent into a speed with acceleration/braking, a gait
 * (idle/walk/jog/sprint), and stamina drain/recovery. The scene applies
 * `speed` along the move direction; the gait drives the animation state machine
 * once real rigs/clips arrive. Pure + deterministic.
 */
export type Gait = 'idle' | 'walk' | 'jog' | 'sprint';

export interface ControllerConfig {
  jogSpeed: number;
  sprintSpeed: number;
  accel: number;
  decel: number;
  maxStamina: number;
  sprintDrain: number;
  staminaRecovery: number;
  exhaustedSpeed: number;
}

export const DEFAULT_CONTROLLER_CONFIG: ControllerConfig = {
  jogSpeed: 4,
  sprintSpeed: 7.5,
  accel: 30,
  decel: 40,
  maxStamina: 100,
  sprintDrain: 26,
  staminaRecovery: 16,
  exhaustedSpeed: 2.4,
};

export interface ControllerInput {
  /** Desired move direction (any magnitude; zero = no input). */
  dir: { x: number; z: number };
  sprint: boolean;
}

export interface ControllerState {
  speed: number;
  gait: Gait;
  stamina: number;
  moving: boolean;
}

export function createControllerState(cfg: ControllerConfig = DEFAULT_CONTROLLER_CONFIG): ControllerState {
  return { speed: 0, gait: 'idle', stamina: cfg.maxStamina, moving: false };
}

function approach(current: number, target: number, rate: number, dt: number): number {
  if (current < target) return Math.min(target, current + rate * dt);
  if (current > target) return Math.max(target, current - rate * dt);
  return current;
}

export function stepController(
  state: ControllerState,
  input: ControllerInput,
  dt: number,
  cfg: ControllerConfig = DEFAULT_CONTROLLER_CONFIG,
): ControllerState {
  const wantsMove = input.dir.x !== 0 || input.dir.z !== 0;
  const canSprint = input.sprint && wantsMove && state.stamina > 0;

  const stamina = canSprint
    ? Math.max(0, state.stamina - cfg.sprintDrain * dt)
    : Math.min(cfg.maxStamina, state.stamina + cfg.staminaRecovery * dt);

  let target = 0;
  if (wantsMove) {
    if (canSprint) target = cfg.sprintSpeed;
    else if (input.sprint && stamina <= 0) target = cfg.exhaustedSpeed;
    else target = cfg.jogSpeed;
  }

  const rate = target > state.speed ? cfg.accel : cfg.decel;
  const speed = Math.max(0, approach(state.speed, target, rate, dt));

  let gait: Gait = 'idle';
  if (speed > 0.1) {
    if (speed >= cfg.sprintSpeed * 0.85) gait = 'sprint';
    else if (speed >= cfg.jogSpeed * 0.55) gait = 'jog';
    else gait = 'walk';
  }

  return { speed, gait, stamina, moving: wantsMove };
}
