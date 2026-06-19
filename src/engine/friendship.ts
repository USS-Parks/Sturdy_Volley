import type { Npc, Season } from '../data/schemas';

/**
 * Relationship, gifts, daily talk, and birthdays (Prompt 013). Pure.
 * Point bands echo Stardew's "10 hearts" feel without copying the numbers —
 * one level per 100 points, 10 levels for everyone, 14 for a confirmed
 * partner. Gift impact is data-driven via NPC tasting lists.
 */
export const POINTS_PER_LEVEL = 100;
export const DEFAULT_MAX_LEVEL = 10;
export const SPOUSE_MAX_LEVEL = 14;

export const WEEKLY_GIFT_LIMIT = 2;
export const BIRTHDAY_MULTIPLIER = 8;

export type GiftTier = 'loved' | 'liked' | 'neutral' | 'disliked' | 'hated';

export const GIFT_POINTS: Record<GiftTier, number> = {
  loved: 80,
  liked: 45,
  neutral: 20,
  disliked: -20,
  hated: -40,
};

export interface NpcTastings {
  loved: readonly string[];
  liked: readonly string[];
  disliked: readonly string[];
  hated: readonly string[];
}

export type TastingTable = Record<string, NpcTastings>;

export function classifyGift(
  table: TastingTable,
  npcId: string,
  itemId: string,
): GiftTier {
  const t = table[npcId];
  if (!t) return 'neutral';
  if (t.loved.includes(itemId)) return 'loved';
  if (t.liked.includes(itemId)) return 'liked';
  if (t.disliked.includes(itemId)) return 'disliked';
  if (t.hated.includes(itemId)) return 'hated';
  return 'neutral';
}

export function relationshipLevel(points: number, max: number = DEFAULT_MAX_LEVEL): number {
  if (points <= 0) return 0;
  return Math.min(max, Math.floor(points / POINTS_PER_LEVEL));
}

/** Stardew-style heart band classifier — purely informational. */
export function relationshipBand(level: number): 'cold' | 'neutral' | 'warm' | 'close' | 'beloved' {
  if (level >= 12) return 'beloved';
  if (level >= 8) return 'close';
  if (level >= 4) return 'warm';
  if (level >= 1) return 'neutral';
  return 'cold';
}

export interface GiftAttempt {
  npcId: string;
  itemId: string;
  isBirthday: boolean;
  /** Number of gifts the player has already given this NPC this week. */
  giftsThisWeek: number;
}

export interface GiftResult {
  accepted: boolean;
  tier: GiftTier;
  /** Net points applied to the NPC. */
  delta: number;
  /** Why the gift was rejected, if any. */
  reason?: 'weekly-limit';
}

export function applyGift(
  table: TastingTable,
  attempt: GiftAttempt,
): GiftResult {
  if (attempt.giftsThisWeek >= WEEKLY_GIFT_LIMIT && !attempt.isBirthday) {
    return { accepted: false, tier: 'neutral', delta: 0, reason: 'weekly-limit' };
  }
  const tier = classifyGift(table, attempt.npcId, attempt.itemId);
  const mult = attempt.isBirthday ? BIRTHDAY_MULTIPLIER : 1;
  const delta = GIFT_POINTS[tier] * mult;
  return { accepted: true, tier, delta };
}

/** Daily +5 for chatting once per day per NPC. */
export const DAILY_TALK_POINTS = 5;

export function applyDailyTalk(
  alreadyTalkedToday: boolean,
): { delta: number; talked: boolean } {
  if (alreadyTalkedToday) return { delta: 0, talked: false };
  return { delta: DAILY_TALK_POINTS, talked: true };
}

/**
 * Stardew-style passive decay: NPCs you ignore for many days lose a single
 * point per day below a "cared" floor. Engaged spouses + romantic partners
 * are exempt — caller decides via `protectFloor`.
 */
export function applyDecay(
  points: number,
  daysSinceLastTalk: number,
  protectFloor = 0,
): number {
  if (daysSinceLastTalk < 7) return points;
  const decayDays = Math.min(daysSinceLastTalk - 6, 21);
  return Math.max(protectFloor, points - decayDays);
}

export function isBirthdayToday(
  npc: Npc,
  now: { season: Season; day: number },
): boolean {
  return npc.birthday.season === now.season && npc.birthday.day === now.day;
}

/** Compose a tasting table from the bundled NPC data. */
export function buildTastingTable(npcs: readonly Npc[]): TastingTable {
  const t: TastingTable = {};
  for (const n of npcs) {
    t[n.id] = {
      loved: n.lovedGiftItemIds,
      liked: [],
      disliked: [],
      hated: [],
    };
  }
  return t;
}
