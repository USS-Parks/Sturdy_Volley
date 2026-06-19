import { describe, it, expect } from 'vitest';
import {
  advanceWorld,
  collect,
  forageQualityRoll,
  TREE_REGROW_DAYS,
  type EntityMap,
  type RegionForageTable,
} from '../../src/engine/forage';

const FARM_TABLE: RegionForageTable = {
  region: 'Farm',
  items: { spring: ['tide-shell', 'driftwood'], fall: ['driftwood'] },
  cellKeys: Array.from({ length: 8 }, (_, i) => `Farm:0,${i}`),
};

describe('advanceWorld', () => {
  it('regrows stumps into trees after TREE_REGROW_DAYS', () => {
    const entities: EntityMap = {
      'Farm:0,0': { kind: 'stump', itemId: 'driftwood', age: TREE_REGROW_DAYS - 1 },
    };
    const r = advanceWorld({ entities, newSeason: 'spring', tables: [], seed: 1 });
    expect(r.entities['Farm:0,0']?.kind).toBe('tree');
    expect(r.regrew).toBe(1);
  });

  it('ages stumps but does not promote them too early', () => {
    const entities: EntityMap = {
      'Farm:0,0': { kind: 'stump', itemId: 'driftwood', age: 0 },
    };
    const r = advanceWorld({ entities, newSeason: 'spring', tables: [], seed: 1 });
    expect(r.entities['Farm:0,0']?.kind).toBe('stump');
    expect(r.entities['Farm:0,0']?.age).toBe(1);
    expect(r.regrew).toBe(0);
  });

  it('spawns seasonal forage from the table pool only in empty cells', () => {
    const r = advanceWorld({ entities: {}, newSeason: 'spring', tables: [FARM_TABLE], seed: 42 });
    expect(r.spawned).toBeGreaterThan(0);
    for (const e of Object.values(r.entities)) {
      expect(e.kind).toBe('forage');
      expect(['tide-shell', 'driftwood']).toContain(e.itemId);
    }
  });

  it('does not overwrite occupied cells', () => {
    const entities: EntityMap = { 'Farm:0,3': { kind: 'tree', itemId: 'driftwood', age: 1 } };
    const r = advanceWorld({ entities, newSeason: 'spring', tables: [FARM_TABLE], seed: 7 });
    expect(r.entities['Farm:0,3']?.kind).toBe('tree');
  });

  it('is deterministic for the same seed + inputs', () => {
    const a = advanceWorld({ entities: {}, newSeason: 'spring', tables: [FARM_TABLE], seed: 99 });
    const b = advanceWorld({ entities: {}, newSeason: 'spring', tables: [FARM_TABLE], seed: 99 });
    expect(a.entities).toEqual(b.entities);
  });
});

describe('collect', () => {
  it('forage yields its item and disappears', () => {
    const r = collect({ kind: 'forage', itemId: 'tide-shell', age: 0 });
    expect(r.next).toBeNull();
    expect(r.reward).toEqual({ itemId: 'tide-shell', qty: 1 });
  });

  it('trees require a level-1 axe (hardness ≥ 2) to chop', () => {
    expect(collect({ kind: 'tree', itemId: 'driftwood', age: 5 }, 1).next?.kind).toBe('tree');
    const r = collect({ kind: 'tree', itemId: 'driftwood', age: 5 }, 2);
    expect(r.next?.kind).toBe('stump');
    expect(r.reward).toEqual({ itemId: 'driftwood', qty: 3 });
  });

  it('debris is broken with any hardness ≥ 1', () => {
    const r = collect({ kind: 'debris', itemId: 'driftwood', age: 0 }, 1);
    expect(r.next).toBeNull();
    expect(r.reward).toEqual({ itemId: 'driftwood', qty: 1 });
  });
});

describe('forageQualityRoll', () => {
  it('returns 0..3 and is deterministic', () => {
    expect(forageQualityRoll(123, 0)).toBe(forageQualityRoll(123, 0));
    for (let i = 0; i < 20; i++) {
      const q = forageQualityRoll(i, 5);
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThanOrEqual(3);
    }
  });

  it('biases toward higher tiers as foraging skill rises', () => {
    let lowSum = 0;
    let highSum = 0;
    for (let i = 0; i < 100; i++) {
      lowSum += forageQualityRoll(i, 0);
      highSum += forageQualityRoll(i, 12);
    }
    expect(highSum).toBeGreaterThan(lowSum);
  });
});
