import type { Season } from '../data/schemas';

/**
 * Fishing + crab pots (Prompt 021). Pure. Three layers:
 *
 * 1. **Catalog** — 12 original Sturdy-Coast fish, each with season(s),
 *    preferred location, difficulty (0..5), and base sell price. The
 *    catalog also includes the treasure / trash table.
 * 2. **Bite timing** — a deterministic `nextBiteSeconds(seed)` picks
 *    when the next nibble fires after casting; weather + tide modify
 *    the wait.
 * 3. **Tension minigame** — a 1-D bar with the fish moving randomly
 *    and the player adjusting their reel speed to keep their cursor
 *    over the fish. Assist mode widens the cursor band and slows the
 *    fish wander.
 *
 * Crab pots are decoupled: a placed pot accumulates an hourly chance
 * of catching a `pot-creature` while baited. Pots persist on `save`
 * via the `crabPots: Record<id, CrabPotState>` map.
 */
export type FishingLocation = 'beach' | 'pond' | 'reef' | 'river';
export type FishingTime = 'any' | 'morning' | 'evening' | 'night';

export interface FishDefinition {
  id: string;
  name: string;
  seasons: readonly Season[];
  location: FishingLocation;
  time: FishingTime;
  /** 0..5; higher = faster wander + more frequent direction flips. */
  difficulty: number;
  sellPrice: number;
  /** "Common" / "uncommon" / "rare" affects the catch roll weight. */
  rarity: 'common' | 'uncommon' | 'rare';
}

export const FISH_CATALOG: readonly FishDefinition[] = [
  { id: 'silver-skipper', name: 'Silver Skipper', seasons: ['spring', 'summer'], location: 'beach', time: 'any', difficulty: 1, sellPrice: 60, rarity: 'common' },
  { id: 'striped-mullet', name: 'Striped Mullet', seasons: ['spring'], location: 'beach', time: 'morning', difficulty: 2, sellPrice: 80, rarity: 'common' },
  { id: 'kelp-perch', name: 'Kelp Perch', seasons: ['spring', 'fall'], location: 'reef', time: 'any', difficulty: 2, sellPrice: 110, rarity: 'common' },
  { id: 'lantern-eel', name: 'Lantern Eel', seasons: ['summer', 'fall'], location: 'reef', time: 'night', difficulty: 4, sellPrice: 220, rarity: 'uncommon' },
  { id: 'sun-rockfish', name: 'Sun Rockfish', seasons: ['summer'], location: 'beach', time: 'any', difficulty: 3, sellPrice: 150, rarity: 'common' },
  { id: 'bluemoon-trout', name: 'Bluemoon Trout', seasons: ['spring', 'summer'], location: 'river', time: 'evening', difficulty: 2, sellPrice: 130, rarity: 'common' },
  { id: 'salt-pike', name: 'Salt Pike', seasons: ['fall', 'winter'], location: 'beach', time: 'any', difficulty: 3, sellPrice: 175, rarity: 'common' },
  { id: 'tide-jellies', name: 'Tide Jellies', seasons: ['spring', 'summer'], location: 'beach', time: 'morning', difficulty: 1, sellPrice: 40, rarity: 'common' },
  { id: 'reef-snapper', name: 'Reef Snapper', seasons: ['summer', 'fall'], location: 'reef', time: 'any', difficulty: 3, sellPrice: 160, rarity: 'common' },
  { id: 'storm-marlin', name: 'Storm Marlin', seasons: ['fall', 'winter'], location: 'beach', time: 'any', difficulty: 5, sellPrice: 420, rarity: 'rare' },
  { id: 'pond-bream', name: 'Pond Bream', seasons: ['spring'], location: 'pond', time: 'any', difficulty: 1, sellPrice: 35, rarity: 'common' },
  { id: 'glasswing-mackerel', name: 'Glasswing Mackerel', seasons: ['summer', 'fall'], location: 'beach', time: 'evening', difficulty: 4, sellPrice: 260, rarity: 'uncommon' },
  { id: 'pearl-cod', name: 'Pearl Cod', seasons: ['winter'], location: 'beach', time: 'any', difficulty: 3, sellPrice: 210, rarity: 'common' },
];

export const TREASURE_TABLE = [
  { itemId: 'driftwood', weight: 50 },
  { itemId: 'tide-shell', weight: 30 },
  { itemId: 'pearl-shard', weight: 6 },
  { itemId: 'salt', weight: 14 },
] as const;

export type WeatherKind = 'sunny' | 'rain' | 'sea-fog' | 'windstorm';
export type TideKind = 'low' | 'rising' | 'high' | 'falling';

export interface BiteRollInput {
  /** Game minutes of day (0..1440). */
  timeMinutes: number;
  season: Season;
  weather: WeatherKind;
  tide: TideKind;
  location: FishingLocation;
  /** PRNG seed (use absoluteDay + cast index). */
  seed: number;
  /** True when the player has bait on their hook. */
  withBait: boolean;
}

export interface BiteRollResult {
  /** Seconds until the bite, capped to 8s without bait / 12s with bait floor. */
  waitSeconds: number;
  /** True when this cast hits the treasure table instead of a fish. */
  isTreasure: boolean;
  /** When non-treasure: the resolved fish id. Otherwise the treasure itemId. */
  resolvedId: string;
}

function pseudoFloat(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function weightedPick<T extends { weight: number }>(
  rows: readonly T[],
  seed: number,
): T {
  const total = rows.reduce((s, r) => s + r.weight, 0);
  const r = pseudoFloat(seed) * total;
  let acc = 0;
  for (const row of rows) {
    acc += row.weight;
    if (r <= acc) return row;
  }
  return rows[rows.length - 1]!;
}

function fishMatches(fish: FishDefinition, input: BiteRollInput): boolean {
  if (!fish.seasons.includes(input.season)) return false;
  if (fish.location !== input.location) return false;
  if (fish.time === 'any') return true;
  if (fish.time === 'morning') return input.timeMinutes < 12 * 60;
  if (fish.time === 'evening') return input.timeMinutes >= 16 * 60 && input.timeMinutes < 22 * 60;
  return input.timeMinutes >= 22 * 60 || input.timeMinutes < 4 * 60;
}

const RARITY_WEIGHT: Record<FishDefinition['rarity'], number> = { common: 60, uncommon: 25, rare: 5 };

export function nextBite(input: BiteRollInput): BiteRollResult {
  const matching = FISH_CATALOG.filter((f) => fishMatches(f, input));
  const treasureRoll = pseudoFloat(input.seed + 11);
  const treasureChance = input.location === 'beach' ? 0.18 : 0.08;
  const isTreasure = treasureRoll < treasureChance;

  // Wait window: 3..8 sunny, 2..6 rainy (fish bite more), 4..10 windstorm.
  const min = input.weather === 'rain' ? 2 : input.weather === 'windstorm' ? 4 : 3;
  const max = input.weather === 'rain' ? 6 : input.weather === 'windstorm' ? 10 : 8;
  let waitSeconds = min + pseudoFloat(input.seed + 3) * (max - min);
  if (!input.withBait) waitSeconds += 2;
  if (input.tide === 'low' && input.location === 'beach') waitSeconds = Math.max(2, waitSeconds - 1);

  if (isTreasure) {
    const t = weightedPick(TREASURE_TABLE.map((r) => ({ ...r })), input.seed + 19);
    return { waitSeconds, isTreasure: true, resolvedId: t.itemId };
  }

  if (matching.length === 0) {
    // No species matches this slice; fall back to treasure-style trash.
    return { waitSeconds, isTreasure: true, resolvedId: 'driftwood' };
  }

  // Weight each match by rarity.
  const rows = matching.map((f) => ({ ...f, weight: RARITY_WEIGHT[f.rarity] }));
  const fish = weightedPick(rows, input.seed + 7);
  return { waitSeconds, isTreasure: false, resolvedId: fish.id };
}

/**
 * Tension minigame. The fish has a position in [0,1]; the player's
 * cursor is centered around its own position with width = `assist ? 0.32 : 0.18`.
 * Each tick the fish wanders by `(rand - 0.5) * difficulty * 0.04`,
 * the player can tap up or down to nudge their cursor, and the catch
 * counter advances when the fish is inside the cursor band.
 */
export interface MinigameState {
  fishPos: number; // 0..1
  cursorPos: number;
  cursorWidth: number;
  /** 0..1; reaches 1 → catch. */
  progress: number;
  /** Difficulty 0..5, drives fish wander speed. */
  difficulty: number;
  /** Latest direction the fish moved (used by renderer hints). */
  fishVelocity: number;
}

export function startMinigame(opts: { difficulty: number; assist: boolean }): MinigameState {
  return {
    fishPos: 0.5,
    cursorPos: 0.5,
    cursorWidth: opts.assist ? 0.32 : 0.18,
    progress: 0,
    difficulty: opts.difficulty,
    fishVelocity: 0,
  };
}

export interface MinigameInput {
  state: MinigameState;
  dt: number;
  /** -1 / 0 / +1 player intent. */
  intent: -1 | 0 | 1;
  seed: number;
  assist: boolean;
}

export interface MinigameStep {
  state: MinigameState;
  caught: boolean;
  lost: boolean;
}

const FISH_WANDER_BASE = 0.7;
const CURSOR_SPEED = 1.1;
const PROGRESS_RATE = 0.6;
const SLIP_RATE = 0.4;

export function stepMinigame(input: MinigameInput): MinigameStep {
  const { state, dt, intent, seed, assist } = input;
  const wanderScale = (state.difficulty + 1) * 0.06 * (assist ? 0.5 : 1.0);
  const noise = pseudoFloat(seed) - 0.5;
  const newFishPos = clamp01(state.fishPos + noise * FISH_WANDER_BASE * wanderScale * dt * 60);
  const fishVelocity = newFishPos - state.fishPos;

  const newCursorPos = clamp01(state.cursorPos + intent * CURSOR_SPEED * dt);
  const onTarget = Math.abs(newFishPos - newCursorPos) <= state.cursorWidth / 2;
  let progress = state.progress + (onTarget ? PROGRESS_RATE : -SLIP_RATE) * dt;
  progress = Math.max(0, Math.min(1, progress));
  const next: MinigameState = {
    ...state,
    fishPos: newFishPos,
    cursorPos: newCursorPos,
    progress,
    fishVelocity,
  };
  return {
    state: next,
    caught: progress >= 1,
    lost: progress <= 0 && state.progress < PROGRESS_RATE * dt,
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/* Crab pots --------------------------------------------------------- */

export interface CrabPotState {
  id: string;
  sceneKey: string;
  x: number;
  z: number;
  /** Baited at the time the timer started. */
  baited: boolean;
  /** Absolute minute when the pot was baited. */
  startedAt: number | null;
  /** Cached catch when the timer expires. */
  catchItemId: string | null;
}

export const CRAB_POT_CATCH_MINUTES = 720; // 12 hours

export const CRAB_POT_LOOT_TABLE = [
  { itemId: 'tide-shell', weight: 40 },
  { itemId: 'pond-bream', weight: 30 },
  { itemId: 'silver-skipper', weight: 18 },
  { itemId: 'lantern-eel', weight: 6 },
  { itemId: 'storm-marlin', weight: 1 },
  { itemId: 'driftwood', weight: 5 },
] as const;

export function baitPot(pot: CrabPotState, nowAbsoluteMinutes: number, seed: number): CrabPotState {
  const loot = weightedPick(CRAB_POT_LOOT_TABLE.map((r) => ({ ...r })), seed);
  return { ...pot, baited: true, startedAt: nowAbsoluteMinutes, catchItemId: loot.itemId };
}

export function potReady(pot: CrabPotState, nowAbsoluteMinutes: number): boolean {
  if (!pot.baited || pot.startedAt === null) return false;
  return nowAbsoluteMinutes - pot.startedAt >= CRAB_POT_CATCH_MINUTES;
}

export interface PotCollectResult {
  pot: CrabPotState;
  itemId: string | null;
}

export function collectPot(pot: CrabPotState, nowAbsoluteMinutes: number): PotCollectResult {
  if (!potReady(pot, nowAbsoluteMinutes)) return { pot, itemId: null };
  return {
    pot: { ...pot, baited: false, startedAt: null, catchItemId: null },
    itemId: pot.catchItemId,
  };
}

/* First-catch notification helper ---------------------------------- */

export function markFirstCatch(seen: Record<string, boolean>, fishId: string): {
  seen: Record<string, boolean>;
  isFirst: boolean;
} {
  if (seen[fishId]) return { seen, isFirst: false };
  return { seen: { ...seen, [fishId]: true }, isFirst: true };
}
