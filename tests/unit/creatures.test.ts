import { describe, it, expect } from 'vitest';
import {
  CREATURE_KINDS,
  LOOT_TABLES,
  kindsForDepth,
  rollCreatureLoot,
  scaleStats,
  stepAi,
} from '../../src/engine/creatures';

describe('creature kinds (Prompt 026)', () => {
  it('ships four roles across the four kinds', () => {
    const roles = new Set(Object.values(CREATURE_KINDS).map((k) => k.role));
    expect(roles.size).toBe(4);
  });
  it('every kind has a base hp + damage + speed > 0', () => {
    for (const kind of Object.values(CREATURE_KINDS)) {
      expect(kind.baseHp).toBeGreaterThan(0);
      expect(kind.baseDamage).toBeGreaterThan(0);
      expect(kind.baseSpeed).toBeGreaterThan(0);
    }
  });
});

describe('difficulty scaling', () => {
  it('depth raises hp + damage; combat skill softens it', () => {
    const kind = CREATURE_KINDS['cave-skitter'];
    const lo = scaleStats(kind, { depth: 0, combatSkill: 0, assist: false });
    const hi = scaleStats(kind, { depth: 10, combatSkill: 0, assist: false });
    expect(hi.hp).toBeGreaterThan(lo.hp);
    expect(hi.damage).toBeGreaterThan(lo.damage);
    const skilled = scaleStats(kind, { depth: 10, combatSkill: 1, assist: false });
    expect(skilled.hp).toBeLessThan(hi.hp);
  });
  it('assist mode replaces the combat-skill softener with 0.7×', () => {
    const kind = CREATURE_KINDS['stone-grub'];
    const assist = scaleStats(kind, { depth: 5, combatSkill: 0, assist: true });
    const off = scaleStats(kind, { depth: 5, combatSkill: 0, assist: false });
    expect(assist.hp).toBeLessThan(off.hp);
  });
});

describe('kindsForDepth bands', () => {
  it('returns a non-empty list at every depth', () => {
    for (let d = 0; d < 20; d++) {
      const list = kindsForDepth(d);
      expect(list.length).toBeGreaterThan(0);
    }
  });
});

describe('rollCreatureLoot', () => {
  it('returns an itemId from the matching table', () => {
    for (const kind of Object.values(CREATURE_KINDS)) {
      const id = rollCreatureLoot(kind, 7);
      expect(LOOT_TABLES[kind.loot].find((r) => r.itemId === id)).toBeTruthy();
    }
  });
});

describe('AI step', () => {
  it('chase narrows distance to player', () => {
    const start = { x: 5, z: 0, vx: 0, vz: 0 };
    const next = stepAi({
      state: start,
      role: 'chase',
      speed: 2,
      playerX: 0,
      playerZ: 0,
      dt: 0.5,
      seed: 1,
    });
    expect(Math.hypot(next.x, next.z)).toBeLessThan(Math.hypot(start.x, start.z));
  });
  it('retreat widens distance to player when close', () => {
    const start = { x: 1, z: 0, vx: 0, vz: 0 };
    const next = stepAi({
      state: start,
      role: 'retreat',
      speed: 2,
      playerX: 0,
      playerZ: 0,
      dt: 0.5,
      seed: 2,
    });
    expect(Math.hypot(next.x, next.z)).toBeGreaterThan(Math.hypot(start.x, start.z));
  });
  it('patrol orbits its anchor', () => {
    const a = stepAi({
      state: { x: 0, z: 0, vx: 0, vz: 0 },
      role: 'patrol',
      speed: 1,
      playerX: 0,
      playerZ: 0,
      dt: 0.5,
      seed: 1,
    });
    // First tick captures the anchor.
    expect(a.patrolAnchor).toBeTruthy();
  });
  it('swarm steps toward player only within aggro range', () => {
    // Within aggro: should approach.
    const near = stepAi({
      state: { x: 3, z: 0, vx: 0, vz: 0 },
      role: 'swarm',
      speed: 2,
      playerX: 0,
      playerZ: 0,
      dt: 0.5,
      seed: 3,
    });
    expect(Math.hypot(near.x, near.z)).toBeLessThan(3);
  });
});
