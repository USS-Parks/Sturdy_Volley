import type {
  Festival,
  FestivalMinigame,
  FestivalStall,
  QuestReward,
} from '../data/schemas';
import type { FestivalRecord, FestivalState } from './saveModel';
import { summarizeRewards, type RewardNameResolvers } from './rewards';

/**
 * Seasonal festival engine (Prompt 056). Pure + deterministic over the festival
 * definitions (`content.festivals`) and the per-save participation record
 * (`save.festivals`). Nothing here touches the DOM, renderer, globals, or clock.
 *
 * On a festival day the host scene reshapes itself — NPC schedules move to the
 * `byFestival` layer keyed by the festival id, regular shops close, festival
 * dressing + music come up — and the player can:
 *   - play a non-sport minigame (a foraging hunt / lantern release / cook-off /
 *     fishing contest) for a once-per-year prize,
 *   - buy from a festival special stall,
 *   - share a once-per-year relationship moment with a townsperson.
 *
 * **Multiplayer hook (considered, per the Prompt 056 acceptance):** the minigame
 * is a pure, seed-driven, fully-serializable state machine. The seed is derived
 * from the festival id + calendar day, so a future networked layer can replay or
 * share an identical run across clients without any change to this module, and
 * per-participant records can key off the same `FestivalRecord` shape.
 */

/* Detection ---------------------------------------------------------- */

export interface CalendarPoint {
  year: number;
  season: Festival['season'];
  day: number;
  minutes: number;
}

/** The festival on this season + day, or null. */
export function festivalForDay(
  point: Pick<CalendarPoint, 'season' | 'day'>,
  festivals: readonly Festival[],
): Festival | null {
  return festivals.find((f) => f.season === point.season && f.day === point.day) ?? null;
}

/** True when `minutes` falls inside the festival's active window. */
export function isFestivalActiveNow(festival: Festival, minutes: number): boolean {
  return minutes >= festival.startMinutes && minutes < festival.endMinutes;
}

/** "9:00 AM–10:00 PM" window label (handles past-midnight end times). */
export function festivalWindowLabel(festival: Festival): string {
  const fmt = (m: number): string => {
    const h24 = Math.floor(m / 60) % 24;
    const mm = Math.floor(m % 60);
    const period = h24 < 12 ? 'AM' : 'PM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${mm.toString().padStart(2, '0')} ${period}`;
  };
  return `${fmt(festival.startMinutes)}–${fmt(festival.endMinutes)}`;
}

/* Participation record ----------------------------------------------- */

export function emptyFestivalState(): FestivalState {
  return { attendedYear: null, bestScore: 0, minigameWonYear: null, relationshipYear: null };
}

export function festivalStateFor(record: FestivalRecord, festivalId: string): FestivalState {
  return record[festivalId] ?? emptyFestivalState();
}

/** Mark the player as having attended the festival this year (idempotent within a year). */
export function markAttended(record: FestivalRecord, festivalId: string, year: number): FestivalRecord {
  const state = festivalStateFor(record, festivalId);
  if (state.attendedYear === year) return record;
  return { ...record, [festivalId]: { ...state, attendedYear: year } };
}

/** Whether the minigame prize can still be claimed this year. */
export function canClaimMinigame(record: FestivalRecord, festival: Festival, year: number): boolean {
  if (!festival.minigame) return false;
  return festivalStateFor(record, festival.id).minigameWonYear !== year;
}

/** Whether the relationship moment can still be claimed this year. */
export function canClaimRelationship(record: FestivalRecord, festival: Festival, year: number): boolean {
  if (!festival.relationship) return false;
  return festivalStateFor(record, festival.id).relationshipYear !== year;
}

export interface RecordMinigameResult {
  record: FestivalRecord;
  /** Rewards to grant this call (empty unless the run won AND the prize was unclaimed this year). */
  rewards: QuestReward[];
  /** True when this run set a new personal best. */
  newBest: boolean;
}

/**
 * Fold a finished minigame run into the record: always updates `bestScore`;
 * grants the prize (returned in `rewards`) only when the run won and the prize
 * was not already claimed this year, then stamps `minigameWonYear`.
 */
export function recordMinigameRun(
  record: FestivalRecord,
  festival: Festival,
  year: number,
  score: number,
  won: boolean,
): RecordMinigameResult {
  const state = festivalStateFor(record, festival.id);
  const newBest = score > state.bestScore;
  const bestScore = Math.max(state.bestScore, score);
  const claim = won && festival.minigame !== null && state.minigameWonYear !== year;
  const next: FestivalState = {
    ...state,
    bestScore,
    minigameWonYear: claim ? year : state.minigameWonYear,
  };
  return {
    record: { ...record, [festival.id]: next },
    rewards: claim ? [...(festival.minigame?.rewards ?? [])] : [],
    newBest,
  };
}

export interface ClaimRelationshipResult {
  record: FestivalRecord;
  rewards: QuestReward[];
  /** True when the moment was newly claimed (false if already claimed this year). */
  claimed: boolean;
}

/** Claim the festival's relationship moment once per year; returns the rewards on first claim. */
export function claimRelationshipMoment(
  record: FestivalRecord,
  festival: Festival,
  year: number,
): ClaimRelationshipResult {
  if (!festival.relationship || !canClaimRelationship(record, festival, year)) {
    return { record, rewards: [], claimed: false };
  }
  const state = festivalStateFor(record, festival.id);
  return {
    record: { ...record, [festival.id]: { ...state, relationshipYear: year } },
    rewards: [...festival.relationship.rewards],
    claimed: true,
  };
}

/* Minigame state machine --------------------------------------------- */

export interface FestivalMinigameState {
  festivalId: string;
  kind: FestivalMinigame['kind'];
  targetLabel: string;
  slots: number;
  rounds: number;
  /** Rounds played so far (0..rounds). */
  round: number;
  score: number;
  goal: number;
  /** The lit slot for the current round. */
  activeSlot: number;
  finished: boolean;
  won: boolean;
}

function pseudoFloat(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Deterministic lit-slot for a round given the run seed. */
export function activeSlotFor(seed: number, round: number, slots: number): number {
  return Math.floor(pseudoFloat(seed + round * 17.17 + 3) * slots) % slots;
}

export function startFestivalMinigame(festival: Festival, seed: number): FestivalMinigameState | null {
  const mg = festival.minigame;
  if (!mg) return null;
  return {
    festivalId: festival.id,
    kind: mg.kind,
    targetLabel: mg.targetLabel,
    slots: mg.slots,
    rounds: mg.rounds,
    round: 0,
    score: 0,
    goal: mg.goalScore,
    activeSlot: activeSlotFor(seed, 0, mg.slots),
    finished: false,
    won: false,
  };
}

export interface FestivalTapResult {
  state: FestivalMinigameState;
  /** True when the tapped slot was the lit one. */
  hit: boolean;
  finished: boolean;
  won: boolean;
}

/** Tap one slot for the current round; advances to the next round (or finishes). */
export function tapFestivalSlot(
  state: FestivalMinigameState,
  slot: number,
  seed: number,
): FestivalTapResult {
  if (state.finished) {
    return { state, hit: false, finished: true, won: state.won };
  }
  const hit = slot === state.activeSlot;
  const score = state.score + (hit ? 1 : 0);
  const nextRound = state.round + 1;
  const finished = nextRound >= state.rounds;
  const won = finished && score >= state.goal;
  const next: FestivalMinigameState = {
    ...state,
    round: nextRound,
    score,
    activeSlot: finished ? state.activeSlot : activeSlotFor(seed, nextRound, state.slots),
    finished,
    won,
  };
  return { state: next, hit, finished, won };
}

/* Selectors for the UI ----------------------------------------------- */

export interface FestivalStallRow {
  itemId: string;
  name: string;
  price: number;
}

export function festivalStallRows(
  stall: FestivalStall,
  itemName: (id: string) => string = (id) => id,
): FestivalStallRow[] {
  return stall.entries.map((e) => ({ itemId: e.itemId, name: itemName(e.itemId), price: e.price }));
}

export function minigameRewardSummary(festival: Festival, names: RewardNameResolvers = {}): string {
  return festival.minigame ? summarizeRewards(festival.minigame.rewards, names) : 'No reward';
}

export function relationshipRewardSummary(festival: Festival, names: RewardNameResolvers = {}): string {
  return festival.relationship ? summarizeRewards(festival.relationship.rewards, names) : 'No reward';
}
