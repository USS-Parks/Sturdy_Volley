import { describe, it, expect } from 'vitest';
import {
  applyDailyTalk,
  applyDecay,
  applyGift,
  classifyGift,
  isBirthdayToday,
  relationshipBand,
  relationshipLevel,
  buildTastingTable,
  GIFT_POINTS,
  POINTS_PER_LEVEL,
  BIRTHDAY_MULTIPLIER,
  WEEKLY_GIFT_LIMIT,
} from '../../src/engine/friendship';
import type { Npc } from '../../src/data/schemas';

const TABLE = {
  mara: {
    loved: ['goat-cheese'],
    liked: ['driftwood'],
    disliked: ['gear-oil'],
    hated: ['sea-fog-jar'],
  },
};

describe('classifyGift', () => {
  it('routes to the correct tier or neutral', () => {
    expect(classifyGift(TABLE, 'mara', 'goat-cheese')).toBe('loved');
    expect(classifyGift(TABLE, 'mara', 'driftwood')).toBe('liked');
    expect(classifyGift(TABLE, 'mara', 'gear-oil')).toBe('disliked');
    expect(classifyGift(TABLE, 'mara', 'sea-fog-jar')).toBe('hated');
    expect(classifyGift(TABLE, 'mara', 'random')).toBe('neutral');
    expect(classifyGift(TABLE, 'who', 'anything')).toBe('neutral');
  });
});

describe('relationshipLevel', () => {
  it('converts points to a clamped level', () => {
    expect(relationshipLevel(0)).toBe(0);
    expect(relationshipLevel(POINTS_PER_LEVEL)).toBe(1);
    expect(relationshipLevel(POINTS_PER_LEVEL * 5 + 50)).toBe(5);
    expect(relationshipLevel(POINTS_PER_LEVEL * 12)).toBe(10);
    expect(relationshipLevel(POINTS_PER_LEVEL * 12, 14)).toBe(12);
  });

  it('bands map roughly to Stardew heart milestones', () => {
    expect(relationshipBand(0)).toBe('cold');
    expect(relationshipBand(1)).toBe('neutral');
    expect(relationshipBand(4)).toBe('warm');
    expect(relationshipBand(9)).toBe('close');
    expect(relationshipBand(13)).toBe('beloved');
  });
});

describe('applyGift', () => {
  it('returns the per-tier delta', () => {
    const r = applyGift(TABLE, {
      npcId: 'mara',
      itemId: 'goat-cheese',
      isBirthday: false,
      giftsThisWeek: 0,
    });
    expect(r.accepted).toBe(true);
    expect(r.tier).toBe('loved');
    expect(r.delta).toBe(GIFT_POINTS.loved);
  });

  it('birthdays multiply the delta', () => {
    const r = applyGift(TABLE, {
      npcId: 'mara',
      itemId: 'driftwood',
      isBirthday: true,
      giftsThisWeek: 0,
    });
    expect(r.delta).toBe(GIFT_POINTS.liked * BIRTHDAY_MULTIPLIER);
  });

  it('rejects gifts past the weekly limit unless it is the NPC birthday', () => {
    const r = applyGift(TABLE, {
      npcId: 'mara',
      itemId: 'goat-cheese',
      isBirthday: false,
      giftsThisWeek: WEEKLY_GIFT_LIMIT,
    });
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('weekly-limit');

    const birthday = applyGift(TABLE, {
      npcId: 'mara',
      itemId: 'goat-cheese',
      isBirthday: true,
      giftsThisWeek: WEEKLY_GIFT_LIMIT,
    });
    expect(birthday.accepted).toBe(true);
  });
});

describe('applyDailyTalk + applyDecay', () => {
  it('first talk of the day grants the daily delta', () => {
    expect(applyDailyTalk(false).delta).toBe(5);
    expect(applyDailyTalk(true).delta).toBe(0);
  });

  it('decay kicks in after 7 days of silence and respects the protect floor', () => {
    expect(applyDecay(200, 6)).toBe(200);
    expect(applyDecay(200, 10)).toBe(196);
    expect(applyDecay(10, 30, 50)).toBe(50);
  });
});

describe('isBirthdayToday', () => {
  it('checks season + day exactly', () => {
    const npc: Npc = {
      id: 'mara-vale',
      name: 'Mara',
      role: 'r',
      description: 'd',
      birthday: { season: 'summer', day: 14 },
      lovedGiftItemIds: [],
      romanceable: true,
    };
    expect(isBirthdayToday(npc, { season: 'summer', day: 14 })).toBe(true);
    expect(isBirthdayToday(npc, { season: 'summer', day: 15 })).toBe(false);
    expect(isBirthdayToday(npc, { season: 'fall', day: 14 })).toBe(false);
  });
});

describe('buildTastingTable', () => {
  it('lifts lovedGiftItemIds out of the bundled NPC data', () => {
    const npcs: Npc[] = [
      {
        id: 'mara-vale',
        name: 'Mara',
        role: 'r',
        description: 'd',
        birthday: { season: 'summer', day: 14 },
        lovedGiftItemIds: ['goat-cheese', 'driftwood'],
        romanceable: true,
      },
    ];
    const t = buildTastingTable(npcs);
    expect(t['mara-vale']?.loved).toEqual(['goat-cheese', 'driftwood']);
  });
});
