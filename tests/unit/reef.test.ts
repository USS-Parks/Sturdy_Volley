import { describe, it, expect } from 'vitest';
import {
  DEFAULT_OXYGEN_MAX,
  REEF_CROPS,
  REEF_SEA_LIFE,
  createOxygen,
  createReef,
  donateFragments,
  reefAccess,
  reefSeasonalRoll,
  tickOxygen,
} from '../../src/engine/reef';

describe('reefAccess (Prompt 022)', () => {
  it('open at low tide in good weather', () => {
    expect(reefAccess('low', 'sunny')).toBe('open');
  });
  it('wading on falling tide', () => {
    expect(reefAccess('falling', 'sunny')).toBe('wading');
  });
  it('closed at high tide', () => {
    expect(reefAccess('high', 'sunny')).toBe('closed');
  });
  it('storms close the reef even at low tide', () => {
    expect(reefAccess('low', 'windstorm')).toBe('closed');
  });
});

describe('oxygen meter', () => {
  it('drains 1s per real second underwater', () => {
    const s = createOxygen(10);
    const after = tickOxygen({ state: s, submerged: true, dt: 3 });
    expect(after.value).toBe(7);
    expect(after.warning).toBe(false);
  });
  it('refills fast when surfaced', () => {
    const s = { ...createOxygen(60), value: 0 };
    const after = tickOxygen({ state: s, submerged: false, dt: 5 });
    expect(after.value).toBe(20);
  });
  it('warning flips on under 30%', () => {
    const s = { ...createOxygen(60), value: 18 };
    const t = tickOxygen({ state: s, submerged: true, dt: 1 });
    expect(t.warning).toBe(true);
  });
  it('default max is 60 seconds', () => {
    expect(createOxygen().max).toBe(DEFAULT_OXYGEN_MAX);
  });
});

describe('reef restoration', () => {
  it('starts at zero', () => {
    const r = createReef();
    expect(r.health).toBe(0);
    expect(r.tier).toBe(0);
  });
  it('donateFragments climbs tier per 8 fragments', () => {
    let r = createReef();
    r = donateFragments(r, 8);
    expect(r.tier).toBe(1);
    expect(r.health).toBeCloseTo(0.25);
    r = donateFragments(r, 24);
    expect(r.tier).toBe(4);
    expect(r.health).toBe(1);
  });
});

describe('reef forage', () => {
  it('returns a known reef itemId', () => {
    const id = reefSeasonalRoll('summer', 1);
    expect(REEF_CROPS.find((c) => c.itemId === id)).toBeTruthy();
  });
  it('REEF_SEA_LIFE has at least four harmless encounters', () => {
    expect(REEF_SEA_LIFE.length).toBeGreaterThanOrEqual(4);
  });
});
