import { describe, it, expect } from 'vitest';
import {
  LEVEL_XP_THRESHOLDS,
  MAX_LEVEL,
  SKILL_IDS,
  SKILL_TREES,
  aggregatePerks,
  awardMasteryXp,
  createMastery,
  levelFromXp,
  professionOptionsFor,
  xpToNextLevel,
} from '../../src/engine/professions';

describe('skill ladder (Prompt 027)', () => {
  it('every skill ships a branching level-5 and level-10 pair', () => {
    for (const id of SKILL_IDS) {
      const tree = SKILL_TREES[id];
      expect(tree.level5).toHaveLength(2);
      expect(tree.level10).toHaveLength(2);
    }
  });
  it('XP thresholds cover 11 entries (levels 0..10)', () => {
    expect(LEVEL_XP_THRESHOLDS).toHaveLength(MAX_LEVEL + 1);
  });
});

describe('XP curves', () => {
  it('levelFromXp climbs through the threshold table', () => {
    expect(levelFromXp(0)).toBe(0);
    expect(levelFromXp(40)).toBe(1);
    expect(levelFromXp(600)).toBe(5);
    expect(levelFromXp(3100)).toBe(10);
    expect(levelFromXp(99999)).toBe(10);
  });
  it('xpToNextLevel returns 0 at max and positive otherwise', () => {
    expect(xpToNextLevel(0)).toBe(40);
    expect(xpToNextLevel(599)).toBe(1);
    expect(xpToNextLevel(3100)).toBe(0);
  });
});

describe('profession options', () => {
  it('returns 0 choices under level 5', () => {
    expect(professionOptionsFor('cultivation', 4)).toHaveLength(0);
  });
  it('returns 2 choices at level 5', () => {
    expect(professionOptionsFor('cultivation', 5)).toHaveLength(2);
  });
  it('returns the level-10 pair at 10+', () => {
    const opts = professionOptionsFor('cultivation', 10);
    expect(opts.map((o) => o.id).sort()).toEqual(['cultivation-artisan', 'cultivation-gardener'].sort());
  });
});

describe('perk aggregation', () => {
  it('empty professions → identity perks', () => {
    const p = aggregatePerks({});
    expect(p.cropPriceMult).toBe(1);
    expect(p.hazardResist).toBe(0);
  });
  it('cultivation-tiller multiplies the crop price', () => {
    const p = aggregatePerks({ cultivation: 'cultivation-tiller' });
    expect(p.cropPriceMult).toBeCloseTo(1.2);
  });
  it('stacking two hazard-resist perks caps below 1.0', () => {
    const p = aggregatePerks({ exploring: 'exploring-scout', combat: 'combat-defender' });
    expect(p.hazardResist).toBeGreaterThan(0);
    expect(p.hazardResist).toBeLessThan(0.9);
  });
  it('crafting-smith multiplies tool stamina by 0.75', () => {
    const p = aggregatePerks({ crafting: 'crafting-smith' });
    expect(p.toolStaminaMult).toBeCloseTo(0.75);
  });
});

describe('mastery', () => {
  it('awardMasteryXp climbs the per-skill rank up to 5', () => {
    let s = createMastery();
    s = awardMasteryXp(s, 'cultivation', 600);
    expect(s.ranks.cultivation).toBe(1);
    s = awardMasteryXp(s, 'cultivation', 5000);
    expect(s.ranks.cultivation).toBe(5);
    expect(s.totalMasteryXp).toBeGreaterThan(0);
  });
});
