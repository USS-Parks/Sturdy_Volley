/**
 * Time, calendar, and day-resolution (Prompt 006). Pure + deterministic — the
 * scene advances time and reads derived state; saving uses `GameTime` directly.
 * A day runs 6:00 AM → 2:00 AM (collapse). Four 28-day seasons, 7-day weeks.
 */
export const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export const DAYS_PER_SEASON = 28;
export const SEASONS_PER_YEAR = SEASONS.length;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS_PER_YEAR;

/** Minutes-from-midnight bounds for an active day. */
export const DAY_START_MIN = 6 * 60; // 6:00 AM
export const DAY_END_MIN = 26 * 60; // 2:00 AM next day — forced collapse

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface GameTime {
  year: number; // 1+
  season: Season;
  day: number; // 1..28
  minutes: number; // minutes from midnight, DAY_START_MIN..DAY_END_MIN
}

export function createGameTime(): GameTime {
  return { year: 1, season: 'spring', day: 1, minutes: DAY_START_MIN };
}

/** "6:00 AM", "1:30 PM", "12:00 AM", "2:00 AM" (handles past-midnight hours). */
export function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

/** Absolute day index since the start of the game (year 1, spring 1 = 0). */
export function absoluteDay(t: Pick<GameTime, 'year' | 'season' | 'day'>): number {
  return (t.year - 1) * DAYS_PER_YEAR + SEASONS.indexOf(t.season) * DAYS_PER_SEASON + (t.day - 1);
}

export function weekdayOf(t: Pick<GameTime, 'year' | 'season' | 'day'>): Weekday {
  return WEEKDAYS[absoluteDay(t) % WEEKDAYS.length];
}

export function isSameDay(a: GameTime, b: GameTime): boolean {
  return a.year === b.year && a.season === b.season && a.day === b.day;
}

export interface AdvanceResult {
  time: GameTime;
  collapsed: boolean;
}

/** Advance the clock by `deltaMin`; clamps at 2:00 AM and reports a collapse. */
export function advanceTime(t: GameTime, deltaMin: number): AdvanceResult {
  const minutes = t.minutes + Math.max(0, deltaMin);
  if (minutes >= DAY_END_MIN) {
    return { time: { ...t, minutes: DAY_END_MIN }, collapsed: true };
  }
  return { time: { ...t, minutes }, collapsed: false };
}

/** Roll to the next day at `wakeMinutes` (default 6 AM), wrapping season + year. */
export function startNextDay(t: GameTime, wakeMinutes: number = DAY_START_MIN): GameTime {
  let { year, day } = t;
  let seasonIndex = SEASONS.indexOf(t.season);
  day += 1;
  if (day > DAYS_PER_SEASON) {
    day = 1;
    seasonIndex += 1;
    if (seasonIndex >= SEASONS_PER_YEAR) {
      seasonIndex = 0;
      year += 1;
    }
  }
  return { year, season: SEASONS[seasonIndex], day, minutes: wakeMinutes };
}

export interface CalendarEvent {
  season: Season;
  day: number;
}

export function festivalOn<T extends CalendarEvent>(t: GameTime, festivals: readonly T[]): T | null {
  return festivals.find((f) => f.season === t.season && f.day === t.day) ?? null;
}

export interface HasBirthday {
  id: string;
  birthday?: CalendarEvent;
}

export function birthdaysOn<T extends HasBirthday>(t: GameTime, npcs: readonly T[]): T[] {
  return npcs.filter((n) => n.birthday && n.birthday.season === t.season && n.birthday.day === t.day);
}

export interface DaySummary {
  dayLabel: string;
  income: number;
  skillXp: Record<string, number>;
  relationshipChanges: number;
  notices: string[];
}

/** Assemble the bedtime/day-summary view-model from already-computed inputs. */
export function buildDaySummary(input: {
  endingTime: GameTime;
  income?: number;
  skillXp?: Record<string, number>;
  relationshipChanges?: number;
  collapsed?: boolean;
  tomorrowFestival?: string | null;
  tomorrowBirthdays?: string[];
}): DaySummary {
  const notices: string[] = [];
  if (input.collapsed) notices.push('You collapsed and were carried home.');
  if (input.tomorrowFestival) notices.push(`Tomorrow: ${input.tomorrowFestival}.`);
  for (const name of input.tomorrowBirthdays ?? []) notices.push(`${name}'s birthday is tomorrow.`);
  const t = input.endingTime;
  return {
    dayLabel: `Year ${t.year}, ${t.season} ${t.day} (${weekdayOf(t)})`,
    income: input.income ?? 0,
    skillXp: input.skillXp ?? {},
    relationshipChanges: input.relationshipChanges ?? 0,
    notices,
  };
}
