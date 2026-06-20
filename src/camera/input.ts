/**
 * Camera input paths (WEF-01b, Prompt 029): keyboard/mouse drag, controller
 * right-stick, and touch drag, plus a recenter trigger. The pure helpers
 * (deadzone, stick→yaw mapping, frame merge) are unit-tested; the controller is
 * the thin DOM/gamepad binding that accumulates per-frame deltas.
 *
 * Lives under src/camera (not src/engine) so touching the DOM + Gamepad API here
 * does not violate the engine-purity rule.
 */

export interface CameraInput {
  /** Manual yaw delta this frame (rad), already deadzoned/scaled. */
  yawDelta: number;
  /** Manual pitch delta this frame (rad). Contexts may clamp/ignore. */
  pitchDelta: number;
  /** Recenter-to-rest requested this frame. */
  recenter: boolean;
}

export interface CameraInputConfig {
  /** Yaw radians per pixel of pointer drag. */
  pointerYawPerPx: number;
  /** Pitch radians per pixel of pointer drag. */
  pointerPitchPerPx: number;
  /** Right-stick yaw rate (rad/s) at full deflection. */
  stickYawRate: number;
  /** Right-stick pitch rate (rad/s) at full deflection. */
  stickPitchRate: number;
  /** Analog-stick deadzone (0..1). */
  deadzone: number;
  /** Invert vertical look. */
  invertY: boolean;
}

export const DEFAULT_CAMERA_INPUT_CONFIG: CameraInputConfig = {
  pointerYawPerPx: 0.005,
  pointerPitchPerPx: 0.004,
  stickYawRate: 2.6,
  stickPitchRate: 1.8,
  deadzone: 0.18,
  invertY: false,
};

export const ZERO_INPUT: CameraInput = { yawDelta: 0, pitchDelta: 0, recenter: false };

/** Radial deadzone with rescale so output ramps smoothly from the edge. */
export function applyDeadzone(value: number, deadzone: number): number {
  const a = Math.abs(value);
  if (a <= deadzone) return 0;
  const scaled = (a - deadzone) / (1 - deadzone);
  return Math.sign(value) * Math.min(1, scaled);
}

/** Map a right-stick X axis to a yaw delta for this frame. */
export function stickToYaw(axisX: number, dt: number, cfg: CameraInputConfig): number {
  return applyDeadzone(axisX, cfg.deadzone) * cfg.stickYawRate * dt;
}

/** Map a right-stick Y axis to a pitch delta for this frame (respects invertY). */
export function stickToPitch(axisY: number, dt: number, cfg: CameraInputConfig): number {
  const sign = cfg.invertY ? -1 : 1;
  return sign * applyDeadzone(axisY, cfg.deadzone) * cfg.stickPitchRate * dt;
}

/** Sum two input frames (recenter is sticky-or). */
export function mergeInput(a: CameraInput, b: CameraInput): CameraInput {
  return {
    yawDelta: a.yawDelta + b.yawDelta,
    pitchDelta: a.pitchDelta + b.pitchDelta,
    recenter: a.recenter || b.recenter,
  };
}

/**
 * Binds pointer (mouse + touch) drag, keyboard recenter, and the right-stick to
 * accumulate camera input. Call `consume(dt)` once per frame; it polls the
 * gamepad, returns the merged delta, and resets the pointer accumulator.
 */
export class CameraInputController {
  private pointerYaw = 0;
  private pointerPitch = 0;
  private dragging = false;
  private recenterLatched = false;
  private readonly cfg: CameraInputConfig;
  private readonly target: HTMLElement;
  private readonly onPointerDown: (e: PointerEvent) => void;
  private readonly onPointerMove: (e: PointerEvent) => void;
  private readonly onPointerUp: (e: PointerEvent) => void;
  private readonly onKeyDown: (e: KeyboardEvent) => void;

  constructor(target: HTMLElement, cfg: CameraInputConfig = DEFAULT_CAMERA_INPUT_CONFIG) {
    this.target = target;
    this.cfg = cfg;

    this.onPointerDown = (e) => {
      // Mouse: left or right button drags. Touch/pen: any contact drags.
      this.dragging = true;
      void this.target.setPointerCapture?.(e.pointerId);
    };
    this.onPointerMove = (e) => {
      if (!this.dragging) return;
      this.pointerYaw += e.movementX * this.cfg.pointerYawPerPx;
      const sign = this.cfg.invertY ? -1 : 1;
      this.pointerPitch += sign * e.movementY * this.cfg.pointerPitchPerPx;
    };
    this.onPointerUp = (e) => {
      this.dragging = false;
      void this.target.releasePointerCapture?.(e.pointerId);
    };
    this.onKeyDown = (e) => {
      if (e.key === 'r' || e.key === 'R') this.recenterLatched = true;
    };

    target.addEventListener('pointerdown', this.onPointerDown);
    target.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
  }

  /** Programmatic recenter request (e.g. an on-screen button). */
  requestRecenter(): void {
    this.recenterLatched = true;
  }

  consume(dt: number): CameraInput {
    let input: CameraInput = {
      yawDelta: this.pointerYaw,
      pitchDelta: this.pointerPitch,
      recenter: this.recenterLatched,
    };
    this.pointerYaw = 0;
    this.pointerPitch = 0;
    this.recenterLatched = false;

    const pad = this.firstGamepad();
    if (pad) {
      const axisX = pad.axes[2] ?? 0;
      const axisY = pad.axes[3] ?? 0;
      input = mergeInput(input, {
        yawDelta: stickToYaw(axisX, dt, this.cfg),
        pitchDelta: stickToPitch(axisY, dt, this.cfg),
        // Right-stick click (button 10) or B/Circle (button 1) recenters.
        recenter: Boolean(pad.buttons[10]?.pressed || pad.buttons[1]?.pressed),
      });
    }
    return input;
  }

  private firstGamepad(): Gamepad | null {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    const pads = nav?.getGamepads?.();
    if (!pads) return null;
    for (const p of pads) if (p) return p;
    return null;
  }

  dispose(): void {
    this.target.removeEventListener('pointerdown', this.onPointerDown);
    this.target.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
  }
}
