import { describe, it, expect } from 'vitest';
import {
  advanceCrops,
  buildCropIndex,
  daysUntilHarvest,
  harvest,
  isHarvestReady,
  newPlanting,
  plantingKey,
  rollQuality,
  type Planting,
} from '../../src/engine/soil';
import type { Crop } from '../../src/data/schemas';

const CROPS: Crop[] = [
  {
    id: 'bell-peas',
    name: 'Bell Peas',
    seedItemId: 'bell-pea-seeds',
    produceItemId: 'bell-peas',
    seasons: ['spring'],
    growthDays: 6,
    regrowDays: 3,
  },
  {
    id: 'tide-turnip',
    name: 'Tide Turnip',
    seedItemId: 'tide-turnip-seeds',
    produceItemId: 'tide-turnip',
    seasons: ['spring'],
    growthDays: 5,
    regrowDays: null,
  },
];

const INDEX = buildCropIndex(CROPS);

describe('plantingKey', () => {
  it('namespaces by scene + col/row', () => {
    expect(plantingKey('Farm', 3, 4)).toBe('Farm:3,4');
  });
});

describe('daysUntilHarvest / isHarvestReady', () => {
  it('counts down to growth on first harvest', () => {
    const p: Planting = { cropId: 'bell-peas', daysGrown: 2, watered: false, harvests: 0 };
    expect(daysUntilHarvest(CROPS[0]!, p)).toBe(4);
    expect(isHarvestReady(CROPS[0]!, p)).toBe(false);
  });

  it('uses regrowDays after first harvest', () => {
    const p: Planting = { cropId: 'bell-peas', daysGrown: 3, watered: false, harvests: 1 };
    expect(daysUntilHarvest(CROPS[0]!, p)).toBe(0);
    expect(isHarvestReady(CROPS[0]!, p)).toBe(true);
  });

  it('returns infinity for non-regrow after first harvest', () => {
    const p: Planting = { cropId: 'tide-turnip', daysGrown: 0, watered: false, harvests: 1 };
    expect(daysUntilHarvest(CROPS[1]!, p)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('advanceCrops', () => {
  it('grows watered crops one day and resets the watered flag', () => {
    const plantings = {
      'Farm:0,0': { cropId: 'bell-peas', daysGrown: 1, watered: true, harvests: 0 },
    };
    const r = advanceCrops({ plantings, cropsById: INDEX, newSeason: 'spring', rained: false });
    expect(r.plantings['Farm:0,0']).toEqual({
      cropId: 'bell-peas',
      daysGrown: 2,
      watered: false,
      harvests: 0,
    });
    expect(r.grew).toBe(1);
  });

  it('does not grow unwatered crops', () => {
    const plantings = {
      'Farm:0,0': { cropId: 'bell-peas', daysGrown: 1, watered: false, harvests: 0 },
    };
    const r = advanceCrops({ plantings, cropsById: INDEX, newSeason: 'spring', rained: false });
    expect(r.plantings['Farm:0,0']?.daysGrown).toBe(1);
    expect(r.grew).toBe(0);
  });

  it('rain waters everything overnight', () => {
    const plantings = {
      'Farm:0,0': { cropId: 'bell-peas', daysGrown: 1, watered: false, harvests: 0 },
      'Farm:1,0': { cropId: 'tide-turnip', daysGrown: 2, watered: false, harvests: 0 },
    };
    const r = advanceCrops({ plantings, cropsById: INDEX, newSeason: 'spring', rained: true });
    expect(r.grew).toBe(2);
    expect(r.plantings['Farm:0,0']?.daysGrown).toBe(2);
  });

  it('kills out-of-season crops at the season change', () => {
    const plantings = {
      'Farm:0,0': { cropId: 'bell-peas', daysGrown: 3, watered: true, harvests: 0 },
    };
    const r = advanceCrops({ plantings, cropsById: INDEX, newSeason: 'summer', rained: false });
    expect(r.killed).toBe(1);
    expect(r.plantings['Farm:0,0']).toBeUndefined();
  });

  it('reports newly-matured crops', () => {
    const plantings = {
      'Farm:0,0': { cropId: 'tide-turnip', daysGrown: 4, watered: true, harvests: 0 },
    };
    const r = advanceCrops({ plantings, cropsById: INDEX, newSeason: 'spring', rained: false });
    expect(r.matured).toBe(1);
    expect(r.plantings['Farm:0,0']?.daysGrown).toBe(5);
  });
});

describe('harvest', () => {
  it('returns false when the crop is not ready', () => {
    const p = newPlanting('bell-peas');
    const r = harvest(CROPS[0]!, p);
    expect(r.harvested).toBe(false);
  });

  it('consumes non-regrow crops and produces a quality-tiered item', () => {
    const p: Planting = { cropId: 'tide-turnip', daysGrown: 5, watered: true, harvests: 0 };
    const r = harvest(CROPS[1]!, p);
    expect(r.harvested).toBe(true);
    expect(r.produceItemId).toBe('tide-turnip');
    expect(r.next).toBeNull();
    expect(r.quality).toBeGreaterThanOrEqual(0);
    expect(r.quality).toBeLessThanOrEqual(3);
  });

  it('resets regrow crops to daysGrown 0 with incremented harvests', () => {
    const p: Planting = { cropId: 'bell-peas', daysGrown: 6, watered: false, harvests: 0 };
    const r = harvest(CROPS[0]!, p);
    expect(r.harvested).toBe(true);
    expect(r.next).toEqual({ cropId: 'bell-peas', daysGrown: 0, watered: false, harvests: 1 });
  });
});

describe('rollQuality', () => {
  it('returns a tier in 0..3', () => {
    for (let i = 0; i < 50; i++) {
      const q = rollQuality('bell-peas', i, true, i * 17);
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThanOrEqual(3);
    }
  });

  it('is deterministic for the same input', () => {
    const a = rollQuality('bell-peas', 6, true, 100);
    const b = rollQuality('bell-peas', 6, true, 100);
    expect(a).toBe(b);
  });
});
