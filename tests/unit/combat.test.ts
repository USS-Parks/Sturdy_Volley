import { describe, it, expect } from 'vitest';
import {
  CAVE_CRITTER_LOOT,
  DEFAULT_IFRAME_SECS,
  WEAPON_DEFS,
  applyHitToPlayer,
  createPlayerCombat,
  rollLoot,
  swingHit,
  tickIframes,
  tickTelegraph,
  type CreatureSnapshot,
} from '../../src/engine/combat';

function critter(over: Partial<CreatureSnapshot> = {}): CreatureSnapshot {
  return {
    id: 'c1',
    hp: 12,
    maxHp: 12,
    phase: 'idle',
    phaseTime: 1.6,
    x: 0,
    z: 0,
    ...over,
  };
}

describe('combat foundation (Prompt 024)', () => {
  it('swingHit misses outside reach', () => {
    const r = swingHit({ weapon: WEAPON_DEFS.fists, creature: critter({ x: 5, z: 0 }), playerX: 0, playerZ: 0 });
    expect(r.hit).toBe(false);
  });
  it('swingHit lands damage and downs at 0 hp', () => {
    const c = critter({ hp: 2 });
    const r = swingHit({ weapon: WEAPON_DEFS.fists, creature: c, playerX: 0, playerZ: 0 });
    expect(r.hit).toBe(true);
    expect(r.creature.hp).toBe(0);
    expect(r.downed).toBe(true);
  });
  it('hitting during windup cancels the strike', () => {
    const c = critter({ phase: 'windup', phaseTime: 0.5 });
    const r = swingHit({ weapon: WEAPON_DEFS['tide-blade'], creature: c, playerX: 0.5, playerZ: 0 });
    expect(r.creature.phase).toBe('recover');
  });
});

describe('telegraph FSM', () => {
  it('cycles idle → windup → strike → recover', () => {
    let c: CreatureSnapshot = { id: 'x', hp: 10, maxHp: 10, phase: 'idle', phaseTime: 0.01, x: 0, z: 0 };
    let r = tickTelegraph(c, 0.02);
    expect(r.creature.phase).toBe('windup');
    c = r.creature;
    c = { ...c, phaseTime: 0.01 };
    r = tickTelegraph(c, 0.02);
    expect(r.creature.phase).toBe('strike');
    expect(r.striking).toBe(true);
    c = r.creature;
    c = { ...c, phaseTime: 0.01 };
    r = tickTelegraph(c, 0.02);
    expect(r.creature.phase).toBe('recover');
  });
});

describe('player i-frames', () => {
  it('applyHitToPlayer ignores damage during i-frames', () => {
    const state = { ...createPlayerCombat(50), iframes: 0.5 };
    const r = applyHitToPlayer({ state, damage: 10, dt: 0.1 });
    expect(r.damaged).toBe(false);
    expect(r.state.hp).toBe(50);
  });
  it('takes damage when iframes are gone and grants new iframes', () => {
    const r = applyHitToPlayer({ state: createPlayerCombat(50), damage: 10, dt: 0.05 });
    expect(r.damaged).toBe(true);
    expect(r.state.hp).toBe(40);
    expect(r.state.iframes).toBe(DEFAULT_IFRAME_SECS);
  });
  it('tickIframes drains over time without going below zero', () => {
    const s = tickIframes({ hp: 40, maxHp: 50, iframes: 0.3 }, 0.2);
    expect(s.iframes).toBeCloseTo(0.1, 5);
    const s2 = tickIframes(s, 1.0);
    expect(s2.iframes).toBe(0);
  });
});

describe('loot rolls', () => {
  it('returns a known itemId from the cave critter table', () => {
    for (let i = 0; i < 10; i++) {
      const id = rollLoot(CAVE_CRITTER_LOOT, i * 31);
      expect(CAVE_CRITTER_LOOT.find((r) => r.itemId === id)).toBeTruthy();
    }
  });
});
