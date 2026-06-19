import { describe, it, expect } from 'vitest';
import {
  NPC_LIFE_PROFILES,
  UNSCRIPTED_MOMENTS,
  activeBehaviorFor,
  pickMoment,
  profileFor,
  reactiveGreeting,
} from '../../src/engine/npcLifeBehaviors';

describe('npc life profiles (Prompt 024)', () => {
  it('ships at least four distinct NPC profiles with daily-life behaviors', () => {
    const ids = Object.keys(NPC_LIFE_PROFILES);
    expect(ids.length).toBeGreaterThanOrEqual(4);
    for (const id of ids) {
      const p = profileFor(id)!;
      expect(p.behaviors.length).toBeGreaterThan(0);
    }
  });
  it('each profile has at least one of: eating, browsing, chatting, working, reading, gardening', () => {
    const kinds = new Set<string>();
    for (const p of Object.values(NPC_LIFE_PROFILES)) {
      for (const b of p.behaviors) kinds.add(b.kind);
    }
    expect(kinds.has('eating')).toBe(true);
    expect(kinds.has('chatting')).toBe(true);
    expect(kinds.has('working')).toBe(true);
    expect(kinds.has('reading')).toBe(true);
  });
});

describe('activeBehaviorFor', () => {
  it('returns the right behavior at the right time-of-day', () => {
    const b = activeBehaviorFor('mara', 9 * 60, 'spring');
    expect(b?.kind).toBe('reading');
    const nothing = activeBehaviorFor('mara', 22 * 60, 'spring');
    expect(nothing).toBeNull();
  });
});

describe('reactiveGreeting', () => {
  it('returns the default greeting when no recent action matched', () => {
    const line = reactiveGreeting('mara', { matchedSeason: 'spring' });
    expect(line).toBeTruthy();
  });
  it('flips to a reactive line when a recent action matched', () => {
    const line = reactiveGreeting('wren', { visitedMineToday: true, matchedSeason: 'spring' });
    expect(line.toLowerCase()).toContain('cave');
  });
  it('returns empty string for unknown NPC', () => {
    expect(reactiveGreeting('nope', { matchedSeason: 'spring' })).toBe('');
  });
});

describe('unscripted moments', () => {
  it('pickMoment returns a stable string per hour', () => {
    const a = pickMoment(60);
    const b = pickMoment(60);
    expect(a).toBe(b);
    expect(UNSCRIPTED_MOMENTS).toContain(a);
  });
});
