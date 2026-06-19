/** Directional + pointer input collapsed into a normalized move vector. Pure. */
export interface MoveInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  pointer?: { dx: number; dy: number; active: boolean };
}

const POINTER_DEADZONE = 6;

/**
 * Returns a unit-length (or zero) movement vector. Keyboard direction takes
 * precedence; if no keys are held and the pointer is active beyond a small
 * deadzone, the vector points toward the pointer.
 */
export function computeMoveVector(input: MoveInput): { x: number; y: number } {
  let x = 0;
  let y = 0;
  if (input.left) x -= 1;
  if (input.right) x += 1;
  if (input.up) y -= 1;
  if (input.down) y += 1;

  if (x !== 0 || y !== 0) {
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  }

  const p = input.pointer;
  if (p?.active) {
    const len = Math.hypot(p.dx, p.dy);
    if (len > POINTER_DEADZONE) {
      return { x: p.dx / len, y: p.dy / len };
    }
  }

  return { x: 0, y: 0 };
}
