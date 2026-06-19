import { describe, it, expect } from 'vitest';
import {
  MINE_LEVELS,
  ORE_DEFS,
  TOTAL_MINE_LEVELS,
  ascend,
  createMineHealth,
  createMineProgress,
  descend,
  healPlayer,
  hurtPlayer,
  jumpToCheckpoint,
  levelAt,
  mineNode,
  recordCheckpoint,
  rollOreNodes,
} from '../../src/engine/mine';

describe('mine catalog (Prompt 023)', () => {
  it('ships 20 levels split between Ironroot + Rainhall', () => {
    expect(MINE_LEVELS.length).toBe(20);
    expect(TOTAL_MINE_LEVELS).toBe(20);
    const ironroot = MINE_LEVELS.filter((l) => l.system === 'ironroot');
    const rainhall = MINE_LEVELS.filter((l) => l.system === 'rainhall');
    expect(ironroot.length).toBe(10);
    expect(rainhall.length).toBe(10);
  });
  it('every level has at least one ore in the mix', () => {
    for (const l of MINE_LEVELS) {
      expect(l.oreMix.length).toBeGreaterThan(0);
    }
  });
  it('checkpoint levels appear every few levels', () => {
    const checkpoints = MINE_LEVELS.filter((l) => l.checkpoint).map((l) => l.index);
    expect(checkpoints.length).toBeGreaterThanOrEqual(6);
    expect(checkpoints).toContain(0);
    expect(checkpoints).toContain(19);
  });
});

describe('rollOreNodes', () => {
  it('returns oreDensity nodes per call', () => {
    const def = MINE_LEVELS[3]!;
    const nodes = rollOreNodes(def, 1);
    expect(nodes.length).toBe(def.oreDensity);
    for (const n of nodes) {
      expect(ORE_DEFS[n.ore]).toBeTruthy();
    }
  });
});

describe('mineNode pickaxe + stamina gating', () => {
  it('refuses too-soft pickaxe', () => {
    const r = mineNode({
      node: { id: 'n', ore: 'silver-vein', x: 0, z: 0 },
      pickaxeLevel: 0,
      staminaCost: 3,
      currentStamina: 100,
    });
    expect(r.broke).toBe(false);
    expect(r.reason).toBe('too-soft');
  });
  it('refuses when stamina is gone', () => {
    const r = mineNode({
      node: { id: 'n', ore: 'gravel', x: 0, z: 0 },
      pickaxeLevel: 0,
      staminaCost: 5,
      currentStamina: 2,
    });
    expect(r.broke).toBe(false);
    expect(r.reason).toBe('no-stamina');
  });
  it('breaks the node and returns the drop', () => {
    const r = mineNode({
      node: { id: 'n', ore: 'gravel', x: 0, z: 0 },
      pickaxeLevel: 0,
      staminaCost: 2,
      currentStamina: 50,
    });
    expect(r.broke).toBe(true);
    expect(r.drop?.itemId).toBe('gravel');
    expect(r.stamina).toBe(48);
  });
});

describe('mine progress', () => {
  it('descend caps at the final level', () => {
    let p = createMineProgress();
    for (let i = 0; i < 30; i++) p = descend(p);
    expect(p.currentLevel).toBe(19);
    expect(p.deepestLevel).toBe(19);
  });
  it('ascend caps at level 0', () => {
    let p = createMineProgress();
    p = descend(p);
    p = descend(p);
    p = ascend(p);
    p = ascend(p);
    p = ascend(p);
    expect(p.currentLevel).toBe(0);
    expect(p.deepestLevel).toBe(2);
  });
  it('checkpoints record + sort + dedupe', () => {
    let p = createMineProgress();
    p = recordCheckpoint(p, 6);
    p = recordCheckpoint(p, 3);
    p = recordCheckpoint(p, 6);
    expect(p.checkpoints).toEqual([3, 6]);
  });
  it('jumpToCheckpoint only honors recorded levels', () => {
    let p = createMineProgress();
    p = recordCheckpoint(p, 9);
    const j = jumpToCheckpoint(p, 9);
    expect(j.currentLevel).toBe(9);
    const noop = jumpToCheckpoint(p, 12);
    expect(noop.currentLevel).toBe(p.currentLevel);
  });
});

describe('player hp', () => {
  it('hurt and heal clamp to [0, max]', () => {
    let h = createMineHealth();
    h = hurtPlayer(h, 100);
    expect(h.hp).toBe(0);
    h = healPlayer(h, 25);
    expect(h.hp).toBe(25);
  });
});

describe('levelAt', () => {
  it('returns null beyond TOTAL_MINE_LEVELS', () => {
    expect(levelAt(20)).toBeNull();
  });
});
