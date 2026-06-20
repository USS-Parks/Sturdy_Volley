import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FLOCK_CONFIG,
  fleeVelocity,
  flockVelocity,
  forageTarget,
  patrolStep,
  type Boid,
} from '../../src/engine/fauna-behavior';
import {
  wildFamilies,
  familyHasBehavior,
  familyOf,
  ANIMAL_FAMILIES,
} from '../../src/engine/animal-families';

describe('flee', () => {
  it('points directly away from the threat, scaled by urgency', () => {
    const v = fleeVelocity({ x: 2, z: 0 }, { x: 0, z: 0 }, 3, 6);
    expect(v.x).toBeGreaterThan(0); // away on +x
    expect(Math.abs(v.z)).toBeLessThan(1e-9);
  });

  it('is zero outside the flee radius', () => {
    expect(fleeVelocity({ x: 10, z: 0 }, { x: 0, z: 0 }, 3, 6)).toEqual({ x: 0, z: 0 });
  });
});

describe('flocking (boids)', () => {
  it('coheres toward the local centre when neighbours are off to one side', () => {
    const self: Boid = { x: 0, z: 0, vx: 0, vz: 0 };
    const neighbors: Boid[] = [
      { x: 3, z: 0, vx: 1, vz: 0 },
      { x: 3.2, z: 0.5, vx: 1, vz: 0 },
    ];
    const v = flockVelocity(self, neighbors);
    expect(v.x, 'steers toward the school on +x').toBeGreaterThan(0);
  });

  it('separates from a neighbour that is too close', () => {
    const self: Boid = { x: 0, z: 0, vx: 0, vz: 0 };
    const tooClose: Boid[] = [{ x: 0.3, z: 0, vx: 0, vz: 0 }];
    const v = flockVelocity(self, tooClose);
    expect(v.x, 'pushes away from the crowding neighbour').toBeLessThan(0);
  });

  it('clamps to maxSpeed', () => {
    const self: Boid = { x: 0, z: 0, vx: 0, vz: 0 };
    const many: Boid[] = Array.from({ length: 6 }, (_, i) => ({ x: 0.2 * (i + 1), z: 0, vx: 0, vz: 0 }));
    const v = flockVelocity(self, many);
    expect(Math.hypot(v.x, v.z)).toBeLessThanOrEqual(DEFAULT_FLOCK_CONFIG.maxSpeed + 1e-6);
  });
});

describe('patrol', () => {
  it('steers toward the current waypoint and advances on arrival (looping)', () => {
    const wps = [{ x: 0, z: 0 }, { x: 10, z: 0 }];
    const far = patrolStep(wps, 1, { x: 0, z: 0 });
    expect(far.dir.x).toBeGreaterThan(0.9);
    expect(far.index).toBe(1);
    const atWp = patrolStep(wps, 1, { x: 10, z: 0 });
    expect(atWp.arrived).toBe(true);
    expect(atWp.index).toBe(0); // wrapped
  });
});

describe('forage', () => {
  it('returns a deterministic target within bounds', () => {
    const bounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };
    const t = forageTarget(bounds, 7);
    expect(t.x).toBeGreaterThanOrEqual(-5);
    expect(t.x).toBeLessThanOrEqual(5);
    expect(forageTarget(bounds, 7)).toEqual(t); // deterministic
  });
});

describe('wild families', () => {
  it('declares the four wild families with behaviours', () => {
    const ids = wildFamilies().map((f) => f.id).sort();
    expect(ids).toEqual(['bird', 'cave-creature', 'shoreline-crawler', 'swimming-fauna']);
    for (const f of wildFamilies()) expect((f.behaviors ?? []).length).toBeGreaterThan(0);
  });

  it('maps signature behaviours to families', () => {
    expect(familyHasBehavior(familyOf('bird'), 'flock')).toBe(true);
    expect(familyHasBehavior(familyOf('swimming-fauna'), 'swim')).toBe(true);
    expect(familyHasBehavior(familyOf('cave-creature'), 'patrol')).toBe(true);
    expect(familyHasBehavior(familyOf('shoreline-crawler'), 'forage')).toBe(true);
    expect(familyHasBehavior(familyOf('grazing-livestock'), 'flock')).toBe(false);
  });

  it('water eligibility differs (fish + crabs swim, birds + cave do not)', () => {
    expect(ANIMAL_FAMILIES['swimming-fauna'].waterCapable).toBe(true);
    expect(ANIMAL_FAMILIES['shoreline-crawler'].waterCapable).toBe(true);
    expect(ANIMAL_FAMILIES.bird.waterCapable).toBe(false);
    expect(ANIMAL_FAMILIES['cave-creature'].waterCapable).toBe(false);
  });
});
