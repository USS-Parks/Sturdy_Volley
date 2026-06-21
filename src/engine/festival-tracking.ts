import { loadGameContent } from '../data/content';
import { getActiveSave, persistActiveSave } from './gameState';
import { absoluteDayFor } from './quest-tracking';
import { addItem } from './inventory';
import { relationshipLevel } from './friendship';
import { completedProjectFlags } from './civic';
import { grantRewards, summarizeRewards, type RewardNameResolvers } from './rewards';
import {
  availableFestivalForDay,
  claimRelationshipMoment,
  effectiveFestival,
  festivalStallRows,
  festivalStateFor,
  isFestivalActiveNow,
  markAttended,
  recordMinigameRun,
  type FestivalAvailabilityContext,
  type FestivalStallRow,
} from './festival';
import type { Festival } from '../data/schemas';
import type { SaveData } from './saveModel';

/**
 * Runtime glue between TownScene and the pure festival engine (`festival.ts`).
 * Reads/mutates the active save, grants rewards through the shared granter, and
 * persists. The minigame *state* itself lives in the scene (like fishing); this
 * module owns the save-side outcomes (prize + relationship moment + stall buys).
 */

export function festivalNameResolvers(): RewardNameResolvers {
  const content = loadGameContent();
  const items = new Map(content.items.map((i) => [i.id, i.name] as const));
  const npcs = new Map(content.npcs.map((n) => [n.id, n.name] as const));
  const recipes = new Map(content.recipes.map((r) => [r.id, r.name] as const));
  return {
    item: (id) => items.get(id) ?? id,
    npc: (id) => npcs.get(id) ?? id,
    recipe: (id) => recipes.get(id) ?? id,
  };
}

/**
 * Availability context for gated festivals (Prompt 057): a flag is set when it's
 * a truthy save flag OR a completed civic project's `civic:<id>` flag; the
 * relationship level reads from the friendship engine.
 */
export function festivalAvailabilityContextFor(save: SaveData): FestivalAvailabilityContext {
  const civicFlags = new Set(completedProjectFlags(save.projects));
  return {
    hasFlag: (flag) => Boolean(save.flags[flag]) || civicFlags.has(flag),
    relationshipLevel: (npcId) => relationshipLevel(save.relationships[npcId] ?? 0),
  };
}

/**
 * The festival on the active save's current date, or null. Gated festivals only
 * surface once their restoration/relationship requirements are met (Prompt 057),
 * and the year-two+ variation is applied when the calendar year ≥ 2.
 */
export function activeFestival(): Festival | null {
  const save = getActiveSave();
  if (!save) return null;
  const festival = availableFestivalForDay(
    { season: save.calendar.season, day: save.calendar.day },
    loadGameContent().festivals,
    festivalAvailabilityContextFor(save),
  );
  return festival ? effectiveFestival(festival, save.calendar.year) : null;
}

/** True when today is a festival day on the active save (whole-day, clock-independent). */
export function isFestivalToday(): boolean {
  return activeFestival() !== null;
}

/** True when today's festival is within its active time window right now. */
export function isFestivalActiveNowOnSave(): boolean {
  const save = getActiveSave();
  const festival = activeFestival();
  if (!save || !festival) return false;
  return isFestivalActiveNow(festival, save.calendar.timeMinutes);
}

/**
 * A deterministic per-run seed for the festival minigame: festival id hash mixed
 * with the absolute calendar day. Stable for a given festival + day so a future
 * networked layer can replay/share the same run (Prompt 056 multiplayer hook).
 */
export function festivalMinigameSeed(festival: Festival): number {
  const save = getActiveSave();
  let hash = 0;
  for (let i = 0; i < festival.id.length; i++) {
    hash = (hash * 31 + festival.id.charCodeAt(i)) | 0;
  }
  const day = save ? absoluteDayFor(save) : 0;
  return Math.abs(hash) + day * 101;
}

/** Mark the player as having attended today's festival this year. */
export function markActiveFestivalAttended(festivalId: string): void {
  const save = getActiveSave();
  if (!save) return;
  save.festivals = markAttended(save.festivals, festivalId, save.calendar.year);
  persistActiveSave();
}

export interface MinigameOutcome {
  rewardSummary: string | null;
  granted: boolean;
  newBest: boolean;
  bestScore: number;
}

/**
 * Fold a finished minigame run into the active save: updates the best score and,
 * on a win not yet claimed this year, grants the prize. Returns a summary for the
 * UI (rewardSummary is null when nothing was granted).
 */
export function recordActiveMinigameRun(festivalId: string, score: number, won: boolean): MinigameOutcome {
  const save = getActiveSave();
  const festival = activeFestival();
  if (!save || !festival || festival.id !== festivalId) {
    return { rewardSummary: null, granted: false, newBest: false, bestScore: score };
  }
  const result = recordMinigameRun(save.festivals, festival, save.calendar.year, score, won);
  save.festivals = result.record;
  if (result.rewards.length > 0) grantRewards(save, result.rewards);
  persistActiveSave();
  return {
    rewardSummary: result.rewards.length > 0 ? summarizeRewards(result.rewards, festivalNameResolvers()) : null,
    granted: result.rewards.length > 0,
    newBest: result.newBest,
    bestScore: festivalStateFor(save.festivals, festival.id).bestScore,
  };
}

export interface RelationshipOutcome {
  claimed: boolean;
  line: string | null;
  rewardSummary: string | null;
  npcId: string | null;
}

/** Claim today's festival relationship moment once per year; grants + persists. */
export function claimActiveFestivalRelationship(festivalId: string): RelationshipOutcome {
  const save = getActiveSave();
  const festival = activeFestival();
  if (!save || !festival || festival.id !== festivalId || !festival.relationship) {
    return { claimed: false, line: null, rewardSummary: null, npcId: null };
  }
  const result = claimRelationshipMoment(save.festivals, festival, save.calendar.year);
  if (!result.claimed) {
    return { claimed: false, line: null, rewardSummary: null, npcId: festival.relationship.npcId };
  }
  save.festivals = result.record;
  if (result.rewards.length > 0) grantRewards(save, result.rewards);
  persistActiveSave();
  return {
    claimed: true,
    line: festival.relationship.line,
    rewardSummary: result.rewards.length > 0 ? summarizeRewards(result.rewards, festivalNameResolvers()) : null,
    npcId: festival.relationship.npcId,
  };
}

export interface StallBuyResult {
  bought: boolean;
  reason?: 'no-stall' | 'unknown-item' | 'insufficient-funds';
  price: number;
}

/** Buy one unit from today's festival stall: deducts gold, adds the item, persists. */
export function buyFestivalStallItem(festivalId: string, itemId: string): StallBuyResult {
  const save = getActiveSave();
  const festival = activeFestival();
  if (!save || !festival || festival.id !== festivalId || !festival.stall) {
    return { bought: false, reason: 'no-stall', price: 0 };
  }
  const entry = festival.stall.entries.find((e) => e.itemId === itemId);
  if (!entry) return { bought: false, reason: 'unknown-item', price: 0 };
  if (save.wallet.gold < entry.price) return { bought: false, reason: 'insufficient-funds', price: entry.price };
  save.wallet.gold -= entry.price;
  save.inventory = addItem(save.inventory, itemId, 1, 0).container;
  persistActiveSave();
  return { bought: true, price: entry.price };
}

/** Resolved festival stall rows (item names) for the active festival, or []. */
export function activeFestivalStallRows(): FestivalStallRow[] {
  const festival = activeFestival();
  if (!festival || !festival.stall) return [];
  const names = festivalNameResolvers();
  return festivalStallRows(festival.stall, (id) => names.item?.(id) ?? id);
}

/** Best minigame score recorded for a festival on the active save. */
export function festivalBestScore(festivalId: string): number {
  const save = getActiveSave();
  if (!save) return 0;
  return festivalStateFor(save.festivals, festivalId).bestScore;
}
