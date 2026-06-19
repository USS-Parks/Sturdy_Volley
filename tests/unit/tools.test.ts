import { describe, it, expect } from 'vitest';
import {
  TOOL_DEFS,
  TOOL_ORDER,
  staminaCost,
  aoeAt,
  aoeOffsets,
  hardnessReach,
  chargedAoe,
  MAX_TOOL_LEVEL,
} from '../../src/engine/tools';

describe('tool definitions', () => {
  it('covers every tool in TOOL_ORDER', () => {
    for (const id of TOOL_ORDER) {
      expect(TOOL_DEFS[id]).toBeDefined();
      expect(TOOL_DEFS[id].aoeByLevel).toHaveLength(MAX_TOOL_LEVEL + 1);
      expect(TOOL_DEFS[id].hardnessByLevel).toHaveLength(MAX_TOOL_LEVEL + 1);
    }
  });
});

describe('staminaCost', () => {
  it('drops by 15% per upgrade level, never below 1', () => {
    expect(staminaCost('hoe', 0)).toBe(2);
    expect(staminaCost('hoe', 3)).toBe(1);
    expect(staminaCost('axe', 0)).toBe(4);
    expect(staminaCost('axe', 3)).toBe(2);
  });

  it('clamps invalid levels', () => {
    expect(staminaCost('hoe', -1)).toBe(staminaCost('hoe', 0));
    expect(staminaCost('hoe', 99)).toBe(staminaCost('hoe', 3));
  });
});

describe('aoeAt', () => {
  it('grows with level for area tools', () => {
    expect(aoeAt('hoe', 0)).toBe(1);
    expect(aoeAt('hoe', 1)).toBe(3);
    expect(aoeAt('hoe', 2)).toBe(5);
    expect(aoeAt('hoe', 3)).toBe(9);
    expect(aoeAt('watering-can', 3)).toBe(9);
  });

  it('stays at 1 for single-target tools', () => {
    expect(aoeAt('axe', 0)).toBe(1);
    expect(aoeAt('axe', 3)).toBe(1);
    expect(aoeAt('pick', 3)).toBe(1);
  });
});

describe('aoeOffsets', () => {
  it('single tile, line, plus, full 3×3', () => {
    expect(aoeOffsets(1)).toEqual([{ dc: 0, dr: 0 }]);
    expect(aoeOffsets(3)).toHaveLength(3);
    expect(aoeOffsets(5)).toHaveLength(5);
    expect(aoeOffsets(9)).toHaveLength(9);
  });
});

describe('hardnessReach', () => {
  it('upgrades the breakable threshold for chop/mine tools', () => {
    expect(hardnessReach('axe', 0)).toBe(1);
    expect(hardnessReach('axe', 3)).toBe(4);
    expect(hardnessReach('pick', 2)).toBe(3);
  });
});

describe('chargedAoe', () => {
  it('returns base AOE for sub-threshold charges', () => {
    expect(chargedAoe('hoe', 1, 0.2)).toBe(aoeAt('hoe', 1));
  });

  it('boosts area tools at the mid charge band', () => {
    expect(chargedAoe('hoe', 1, 1.0)).toBeGreaterThanOrEqual(aoeAt('hoe', 1));
  });

  it('clamps at 9 even at long charges', () => {
    expect(chargedAoe('hoe', 3, 5)).toBeLessThanOrEqual(9);
  });

  it('non-chargeable tools ignore charge time', () => {
    expect(chargedAoe('axe', 2, 2)).toBe(aoeAt('axe', 2));
  });
});
