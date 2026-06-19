import type { Season } from '../data/schemas';

/**
 * NPC daily-life depth (Prompt 024). Pure. Each NPC carries a set of
 * "idle living" behaviors keyed off a posture token and (optionally)
 * a partner NPC for paired chats. The renderer picks one when the
 * NPC is at its scheduled waypoint and not currently moving.
 *
 * The engine also exposes `reactiveGreeting(npc, recent)`: a small
 * lookup that produces a one-line greeting referencing the player's
 * recent actions ("Saw you out at the reef yesterday!"). The list is
 * data-only so writers can extend it without code.
 */
export type LifeBehaviorKind = 'eating' | 'browsing' | 'chatting' | 'working' | 'reading' | 'gardening';

export interface LifeBehavior {
  kind: LifeBehaviorKind;
  /** Posture token consumed by the renderer's anim layer. */
  posture: 'sit' | 'lean' | 'work' | 'idle';
  /** Time window in minutes-of-day when this behavior is preferred. */
  startMinute: number;
  endMinute: number;
  /** Partner NPC id (for chatting). */
  partnerId?: string;
  /** Optional scene/anchor hint. */
  sceneKey?: string;
  x?: number;
  z?: number;
  /** Season filter; omit = any season. */
  seasons?: readonly Season[];
}

export interface NpcLifeProfile {
  npcId: string;
  /** Display label for the renderer's tooltip ("Mara is reading"). */
  workTrade: string;
  behaviors: readonly LifeBehavior[];
}

/**
 * Four NPCs ship distinct, schedule-driven life behaviors to satisfy
 * the Prompt 024 acceptance line.
 */
export const NPC_LIFE_PROFILES: Record<string, NpcLifeProfile> = {
  mara: {
    npcId: 'mara',
    workTrade: 'Reading and writing in the apartments',
    behaviors: [
      { kind: 'eating', posture: 'sit', startMinute: 7 * 60, endMinute: 8 * 60, sceneKey: 'Interior', x: 0, z: 0.5 },
      { kind: 'reading', posture: 'sit', startMinute: 8 * 60, endMinute: 12 * 60, sceneKey: 'Interior', x: -3.4, z: -1 },
      { kind: 'browsing', posture: 'lean', startMinute: 13 * 60, endMinute: 14 * 60, sceneKey: 'Town', x: 4, z: -8 },
      { kind: 'chatting', posture: 'lean', startMinute: 15 * 60, endMinute: 16 * 60, partnerId: 'wren', sceneKey: 'Town', x: 6, z: -6 },
    ],
  },
  wren: {
    npcId: 'wren',
    workTrade: 'Baking at the market bakery',
    behaviors: [
      { kind: 'working', posture: 'work', startMinute: 6 * 60, endMinute: 10 * 60, sceneKey: 'Town', x: 4, z: -8 },
      { kind: 'eating', posture: 'sit', startMinute: 12 * 60, endMinute: 13 * 60, sceneKey: 'Town', x: 5, z: -7 },
      { kind: 'chatting', posture: 'lean', startMinute: 15 * 60, endMinute: 16 * 60, partnerId: 'mara', sceneKey: 'Town', x: 6, z: -6 },
      { kind: 'reading', posture: 'sit', startMinute: 19 * 60, endMinute: 21 * 60, sceneKey: 'Town', x: 7, z: 2 },
    ],
  },
  bree: {
    npcId: 'bree',
    workTrade: 'Tending the school garden',
    behaviors: [
      { kind: 'gardening', posture: 'work', startMinute: 9 * 60, endMinute: 12 * 60, sceneKey: 'Town', x: -2, z: 4, seasons: ['spring', 'summer', 'fall'] },
      { kind: 'eating', posture: 'sit', startMinute: 12 * 60, endMinute: 13 * 60, sceneKey: 'Town', x: -1, z: 5 },
      { kind: 'reading', posture: 'sit', startMinute: 16 * 60, endMinute: 18 * 60, sceneKey: 'Town', x: -4, z: 4 },
    ],
  },
  cas: {
    npcId: 'cas',
    workTrade: 'Mending boats on the dock',
    behaviors: [
      { kind: 'working', posture: 'work', startMinute: 8 * 60, endMinute: 14 * 60, sceneKey: 'Beach', x: -2, z: -2 },
      { kind: 'browsing', posture: 'lean', startMinute: 15 * 60, endMinute: 16 * 60, sceneKey: 'Town', x: 4, z: -8 },
      { kind: 'chatting', posture: 'lean', startMinute: 17 * 60, endMinute: 18 * 60, partnerId: 'wren', sceneKey: 'Town', x: 6, z: 0 },
    ],
  },
};

export function profileFor(npcId: string): NpcLifeProfile | null {
  return NPC_LIFE_PROFILES[npcId] ?? null;
}

/**
 * Pick the active behavior for an NPC given the current minute + season.
 * Returns null when no behavior matches (NPC is between behaviors).
 */
export function activeBehaviorFor(
  npcId: string,
  minutes: number,
  season: Season,
): LifeBehavior | null {
  const profile = profileFor(npcId);
  if (!profile) return null;
  for (const b of profile.behaviors) {
    if (b.seasons && !b.seasons.includes(season)) continue;
    if (minutes >= b.startMinute && minutes < b.endMinute) return b;
  }
  return null;
}

/* Reactive greetings -------------------------------------------- */

export interface RecentPlayerActions {
  visitedReefToday: boolean;
  visitedMineToday: boolean;
  giftedTodayId?: string;
  caughtFirstFishToday?: string;
  pettedAnimalToday: boolean;
  matchedSeason: Season;
}

export interface ReactiveGreeting {
  trigger: keyof RecentPlayerActions | 'default';
  line: string;
}

export const GREETING_TABLE: Record<string, readonly ReactiveGreeting[]> = {
  mara: [
    { trigger: 'caughtFirstFishToday', line: 'Heard you landed something new at the surf — what was it?' },
    { trigger: 'visitedReefToday', line: 'Mind the tide out at the reef, it shifts fast this season.' },
    { trigger: 'pettedAnimalToday', line: 'Pip looks happy lately — the way you fuss over them is kind.' },
    { trigger: 'default', line: 'A good day for a slow read on the porch.' },
  ],
  wren: [
    { trigger: 'visitedMineToday', line: 'You smell of cave dust again. Anything good in the quarry?' },
    { trigger: 'giftedTodayId', line: 'A gift, again? You are too generous.' },
    { trigger: 'default', line: 'Take a roll, friend, the rye is fresh.' },
  ],
  bree: [
    { trigger: 'pettedAnimalToday', line: 'The hens have been settling well under your care.' },
    { trigger: 'visitedReefToday', line: 'The reef forage is brightest at the change of tide.' },
    { trigger: 'default', line: 'Have you noticed how the garden moves with the season?' },
  ],
  cas: [
    { trigger: 'caughtFirstFishToday', line: 'A first-of-the-day catch! Show me — does it match my charts?' },
    { trigger: 'visitedMineToday', line: 'Bring me back any cold iron and I will sharpen the dock tools.' },
    { trigger: 'default', line: 'Tide is gentle. Boats hold steady today.' },
  ],
};

export function reactiveGreeting(npcId: string, recent: Partial<RecentPlayerActions>): string {
  const lines = GREETING_TABLE[npcId];
  if (!lines) return '';
  for (const greeting of lines) {
    if (greeting.trigger === 'default') continue;
    const value = recent[greeting.trigger as keyof RecentPlayerActions];
    if (value !== undefined && value !== false && value !== null && value !== '') {
      return greeting.line;
    }
  }
  return lines.find((l) => l.trigger === 'default')?.line ?? '';
}

/**
 * Small "unscripted moment" prompts the renderer can sample randomly
 * each in-game hour to surface micro-life over the town. Returns a
 * short label the renderer can floor as a sub-HUD line.
 */
export const UNSCRIPTED_MOMENTS: readonly string[] = [
  'Wren wipes flour from her sleeve and laughs.',
  'Mara closes her book and looks out at the harbor.',
  'Bree dusts soil from her gloves.',
  'Cas drops a coil of rope onto the dock with a thunk.',
  "Two gulls argue over a scrap on the boardwalk.",
  'A bell from the lighthouse chimes the hour.',
];

export function pickMoment(absoluteMinutes: number): string {
  const idx = Math.abs(Math.floor(absoluteMinutes / 60)) % UNSCRIPTED_MOMENTS.length;
  return UNSCRIPTED_MOMENTS[idx]!;
}
