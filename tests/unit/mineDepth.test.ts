import { describe, it, expect } from 'vitest';
import {
  ROOM_KITS,
  buildRoomLayout,
  createBoss,
  createLantern,
  damageBoss,
  elevatorOptions,
  pickKitForLevel,
  refillLantern,
  tickBossPattern,
  tickLantern,
} from '../../src/engine/mineDepth';

describe('room kits (Prompt 025)', () => {
  it('pickKitForLevel is deterministic per (level, seed)', () => {
    const a = pickKitForLevel(5, 12345);
    const b = pickKitForLevel(5, 12345);
    expect(a.id).toBe(b.id);
  });
  it('L19 always returns the heartrock chamber', () => {
    expect(pickKitForLevel(19, 1).id).toBe('heartrock-chamber');
    expect(pickKitForLevel(19, 99999).id).toBe('heartrock-chamber');
  });
  it('every kit has at least one anchor slot summed', () => {
    for (const kit of Object.values(ROOM_KITS)) {
      expect(kit.oreSlots + kit.hazardSlots + kit.creatureSlots).toBeGreaterThan(0);
    }
  });
});

describe('buildRoomLayout', () => {
  it('returns deterministic anchors for the same seed', () => {
    const a = buildRoomLayout(7, 100);
    const b = buildRoomLayout(7, 100);
    expect(a).toEqual(b);
  });
  it('returns different anchors for different seeds', () => {
    const a = buildRoomLayout(7, 100);
    const c = buildRoomLayout(7, 200);
    // Same kit (deterministic per (level, seed)) but anchors differ.
    expect(a.oreAnchors).not.toEqual(c.oreAnchors);
  });
});

describe('elevator options', () => {
  it('lists checkpoints sorted and flags the current level', () => {
    const opts = elevatorOptions({
      checkpoints: [12, 3, 6, 0],
      currentLevel: 6,
      levelName: (l) => `L${l}`,
    });
    expect(opts.map((o) => o.level)).toEqual([0, 3, 6, 12]);
    expect(opts.find((o) => o.level === 6)?.isCurrent).toBe(true);
  });
});

describe('lantern', () => {
  it('does not drain in well-lit levels', () => {
    const s = createLantern(60);
    const t = tickLantern({ state: s, lighting: 2, dt: 5 });
    expect(t.fuel).toBe(60);
  });
  it('drains by dt seconds in dim levels', () => {
    const s = createLantern(60);
    const t = tickLantern({ state: s, lighting: 4, dt: 5 });
    expect(t.fuel).toBe(55);
  });
  it('refillLantern caps at max', () => {
    const s = { fuel: 590, max: 600 };
    expect(refillLantern(s, 100).fuel).toBe(600);
  });
});

describe('boss pattern', () => {
  it('cycles idle → windup → strike → recover and emits a strike flag once per cycle', () => {
    let b = createBoss(50);
    b = { ...b, stepTime: 0.01, phase: 'windup' };
    const r = tickBossPattern(b, 0.02);
    expect(r.state.phase).toBe('strike');
    expect(r.striking).toBe(true);
  });
  it('escalates cadence as boss HP drops', () => {
    let b = createBoss(100);
    b = damageBoss(b, 60); // → 40/100 = 0.4 < 0.5 → cadence 1 on next idle restart
    // Force a full cycle.
    b = { ...b, phase: 'recover', stepTime: 0.01 };
    const r = tickBossPattern(b, 0.02);
    expect(r.state.cadence).toBe(1);
  });
  it('damageBoss clamps to 0', () => {
    const b = damageBoss(createBoss(20), 100);
    expect(b.hp).toBe(0);
  });
});
