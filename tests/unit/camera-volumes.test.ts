import { describe, it, expect } from 'vitest';
import {
  containsPoint,
  containsPointWithMargin,
  pickVolume,
  pickVolumeSticky,
  type CameraVolume,
} from '../../src/camera/volumes';

const box = (id: string, cx: number, hx: number, priority: number, over: Partial<CameraVolume> = {}): CameraVolume => ({
  id,
  min: { x: cx - hx, y: 0, z: -5 },
  max: { x: cx + hx, y: 5, z: 5 },
  profileId: `p-${id}`,
  priority,
  ...over,
});

const at = (x: number) => ({ x, y: 1, z: 0 });

describe('camera volume containment', () => {
  it('containsPoint respects bounds', () => {
    const v = box('a', 0, 2, 1);
    expect(containsPoint(v, at(0))).toBe(true);
    expect(containsPoint(v, at(2.1))).toBe(false);
  });

  it('containsPointWithMargin expands bounds', () => {
    const v = box('a', 0, 2, 1);
    expect(containsPointWithMargin(v, at(2.4), 0.5)).toBe(true);
    expect(containsPointWithMargin(v, at(2.6), 0.5)).toBe(false);
  });

  it('pickVolume picks the highest priority on overlap', () => {
    const lo = box('lo', 0, 5, 1);
    const hi = box('hi', 0, 2, 5);
    expect(pickVolume(at(0), [lo, hi])?.id).toBe('hi');
    expect(pickVolume(at(4), [lo, hi])?.id).toBe('lo'); // outside hi
    expect(pickVolume(at(9), [lo, hi])).toBeNull();
  });
});

describe('pickVolumeSticky — blend-boundary hysteresis (no oscillation)', () => {
  const a = box('a', 0, 2, 10, { blendBoundary: 1 });
  const b = box('b', 4, 2, 10, { blendBoundary: 1 });

  it('with no current selection, behaves like pickVolume', () => {
    expect(pickVolumeSticky(at(0), [a, b], null)?.id).toBe('a');
    expect(pickVolumeSticky(at(4), [a, b], null)?.id).toBe('b');
  });

  it('retains the current volume within its blend boundary even when outside the strict bounds', () => {
    // x=2.6 is outside a (max 2) but within a's 1 m blend margin (≤ 3).
    expect(pickVolumeSticky(at(2.6), [a, b], 'a')?.id).toBe('a');
  });

  it('releases the current volume once past the blend boundary', () => {
    // x=3.5 is beyond a's margin (3) and inside b (2..6) → switch to b.
    expect(pickVolumeSticky(at(3.5), [a, b], 'a')?.id).toBe('b');
  });

  it('does not flip-flop while loitering on the shared edge', () => {
    // Sweep across the a/b gap repeatedly; once in a, stay in a until margin.
    let current: string | null = 'a';
    for (const x of [2.2, 2.8, 2.5, 2.9, 2.4]) {
      current = pickVolumeSticky(at(x), [a, b], current)?.id ?? null;
      expect(current, `x=${x} stays on a within margin`).toBe('a');
    }
  });

  it('lets a strictly-higher-priority volume preempt the sticky current', () => {
    const wide = box('wide', 0, 6, 5, { blendBoundary: 2 });
    const nook = box('nook', 0, 1, 20);
    // Currently in the wide volume, but the high-priority nook contains the point.
    expect(pickVolumeSticky(at(0), [wide, nook], 'wide')?.id).toBe('nook');
  });
});
