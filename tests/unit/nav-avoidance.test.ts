import { describe, it, expect } from 'vitest';
import {
  DEFAULT_AVOID_CONFIG,
  shouldWaitForLink,
  steerAvoid,
  wouldOverlap,
  type Obstacle,
} from '../../src/engine/nav-avoidance';

const speed = 2.6;

describe('steerAvoid', () => {
  it('passes the desired heading through with no obstacles', () => {
    const v = steerAvoid({ x: 0, z: 0 }, { x: 1, z: 0 }, speed, []);
    expect(v.x).toBeCloseTo(speed, 5);
    expect(v.z).toBeCloseTo(0, 5);
  });

  it('clamps the output to maxSpeed', () => {
    const close: Obstacle[] = [{ x: 0.2, z: 0, radius: 0.4 }];
    const v = steerAvoid({ x: 0, z: 0 }, { x: -1, z: 0 }, speed, close);
    expect(Math.hypot(v.x, v.z)).toBeLessThanOrEqual(DEFAULT_AVOID_CONFIG.maxSpeed + 1e-6);
  });

  it('gains a perpendicular component when an obstacle blocks the path (no head-on jam)', () => {
    // Walking +x straight at an obstacle dead ahead (inside the influence band).
    const obs: Obstacle[] = [{ x: 0.7, z: 0, radius: 0.4 }];
    const v = steerAvoid({ x: 0, z: 0 }, { x: 1, z: 0 }, speed, obs);
    expect(Math.abs(v.z), 'steers sideways to pass the obstacle').toBeGreaterThan(0.2);
  });

  it('yields to the player rather than pushing into them', () => {
    // Desired heading points straight at a very close player.
    const player: Obstacle[] = [{ x: 0.5, z: 0, radius: 0.4, isPlayer: true }];
    const v = steerAvoid({ x: 0, z: 0 }, { x: 1, z: 0 }, speed, player);
    // The net velocity must not close on the player along +x.
    expect(v.x, 'does not advance into the player').toBeLessThan(0);
  });

  it('two head-on agents both gain a consistent sideways push (slide past)', () => {
    const a = steerAvoid({ x: 0, z: 0 }, { x: 1, z: 0 }, speed, [{ x: 0.9, z: 0, radius: 0.4 }]);
    const b = steerAvoid({ x: 0.9, z: 0 }, { x: -1, z: 0 }, speed, [{ x: 0, z: 0, radius: 0.4 }]);
    // They pass on opposite sides (one +z biased, the other -z biased).
    expect(Math.sign(a.z)).not.toBe(Math.sign(b.z));
  });
});

describe('door-queue gate', () => {
  it('waits when another agent occupies the link, proceeds otherwise', () => {
    const link = { x: 0, z: 4 };
    const occ = [{ id: 'other', x: 0.2, z: 4.1 }];
    expect(shouldWaitForLink(link, 'self', occ)).toBe(true);
    expect(shouldWaitForLink(link, 'self', [{ id: 'other', x: 5, z: 4 }])).toBe(false);
    // Ignores itself.
    expect(shouldWaitForLink(link, 'self', [{ id: 'self', x: 0, z: 4 }])).toBe(false);
  });
});

describe('wouldOverlap', () => {
  it('detects overlap by centre distance', () => {
    expect(wouldOverlap({ x: 0, z: 0 }, { x: 0.5, z: 0 }, 0.8)).toBe(true);
    expect(wouldOverlap({ x: 0, z: 0 }, { x: 2, z: 0 }, 0.8)).toBe(false);
  });
});
