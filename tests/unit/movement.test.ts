import { describe, it, expect } from 'vitest';
import { computeMoveVector } from '../../src/engine/movement';

const NONE = { up: false, down: false, left: false, right: false };

describe('computeMoveVector', () => {
  it('returns zero with no input', () => {
    expect(computeMoveVector(NONE)).toEqual({ x: 0, y: 0 });
  });

  it('moves right / up along the axes', () => {
    expect(computeMoveVector({ ...NONE, right: true })).toEqual({ x: 1, y: 0 });
    expect(computeMoveVector({ ...NONE, up: true })).toEqual({ x: 0, y: -1 });
  });

  it('normalizes diagonals to unit length', () => {
    const v = computeMoveVector({ ...NONE, up: true, right: true });
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 5);
    expect(v.x).toBeCloseTo(Math.SQRT1_2, 5);
    expect(v.y).toBeCloseTo(-Math.SQRT1_2, 5);
  });

  it('cancels opposite directions', () => {
    expect(computeMoveVector({ ...NONE, left: true, right: true })).toEqual({ x: 0, y: 0 });
  });

  it('uses the pointer when no keys are held', () => {
    const v = computeMoveVector({ ...NONE, pointer: { dx: 0, dy: 30, active: true } });
    expect(v).toEqual({ x: 0, y: 1 });
  });

  it('ignores the pointer inside the deadzone', () => {
    expect(computeMoveVector({ ...NONE, pointer: { dx: 2, dy: 2, active: true } })).toEqual({ x: 0, y: 0 });
  });

  it('lets keyboard override the pointer', () => {
    const v = computeMoveVector({ ...NONE, left: true, pointer: { dx: 100, dy: 0, active: true } });
    expect(v).toEqual({ x: -1, y: 0 });
  });
});
