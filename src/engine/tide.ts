import { absoluteDay, DAY_END_MIN, type GameTime } from './timeSystem';

/**
 * Tides reshape Driftwood Beach and the Kelpglass Reefs twice per day. We model
 * a deterministic two-cycle schedule keyed off the absolute day: low and high
 * tides slide forward ~25 minutes each day (matching real-world tide drift) so
 * the player can't memorize a single clock time forever.
 */
export type TideState = 'low' | 'rising' | 'high' | 'falling';

export interface TideEvent {
  minutes: number; // minutes from midnight, may exceed 24*60 for past-midnight events
  state: TideState;
}

const DAY_MIN = 24 * 60;
const TIDE_DRIFT_PER_DAY = 25; // ~25 min later each day, ~12 hr cycle resets every ~28 days
const CYCLE_MIN = 12 * 60 + 25; // ~12h25m — matches a real semidiurnal cycle

/** Anchor times for low/high tide on the absolute day 0. */
const ANCHOR_LOW_AM = 4 * 60 + 30; // 4:30 AM
const ANCHOR_HIGH_AM = ANCHOR_LOW_AM + CYCLE_MIN / 2; // ~10:42 AM
const ANCHOR_LOW_PM = ANCHOR_LOW_AM + CYCLE_MIN;
const ANCHOR_HIGH_PM = ANCHOR_HIGH_AM + CYCLE_MIN;

function wrapDay(n: number): number {
  return ((n % DAY_MIN) + DAY_MIN) % DAY_MIN;
}

/** All four tide events for the given calendar day, sorted in time-of-day order. */
export function tidesFor(time: GameTime): TideEvent[] {
  const drift = absoluteDay(time) * TIDE_DRIFT_PER_DAY;
  const events: TideEvent[] = [
    { minutes: wrapDay(ANCHOR_LOW_AM + drift), state: 'low' },
    { minutes: wrapDay(ANCHOR_HIGH_AM + drift), state: 'high' },
    { minutes: wrapDay(ANCHOR_LOW_PM + drift), state: 'low' },
    { minutes: wrapDay(ANCHOR_HIGH_PM + drift), state: 'high' },
  ];
  events.sort((a, b) => a.minutes - b.minutes);
  return events;
}

/**
 * The next low/high tide on or after `time.minutes`. Past 2 AM the next tide is
 * on tomorrow's schedule, but for an active day the schedule wraps within the
 * same calendar day — callers handle the rollover via startNextDay.
 */
export function nextTide(time: GameTime): TideEvent {
  const events = tidesFor(time);
  for (const evt of events) {
    if (evt.minutes >= time.minutes % DAY_MIN) return evt;
  }
  return events[0]!; // wrap to tomorrow's first low tide
}

/** Coarse state at a given minute — useful for HUD chips and ecology gates. */
export function tideStateAt(time: GameTime, minute: number = time.minutes): TideState {
  const events = tidesFor(time);
  const m = minute % DAY_MIN;
  let prev = events[events.length - 1]!;
  let prevAdj = prev.minutes - DAY_MIN;
  for (const evt of events) {
    if (m < evt.minutes) {
      return interpolate(prev.state, evt.state, m, prevAdj, evt.minutes);
    }
    prev = evt;
    prevAdj = evt.minutes;
  }
  // After the last event of the day, interpolate to tomorrow's first.
  const tomorrowFirst = events[0]!;
  return interpolate(prev.state, tomorrowFirst.state, m, prevAdj, tomorrowFirst.minutes + DAY_MIN);
}

function interpolate(
  from: TideState,
  to: TideState,
  m: number,
  start: number,
  end: number,
): TideState {
  if (from === to) return from;
  const half = (start + end) / 2;
  if (from === 'low' && to === 'high') return m < half ? 'rising' : 'high';
  if (from === 'high' && to === 'low') return m < half ? 'falling' : 'low';
  return from;
}

/** True when reef/snorkeling content should be accessible at this minute. */
export function isLowTide(time: GameTime, minute: number = time.minutes): boolean {
  const state = tideStateAt(time, minute);
  return state === 'low' || state === 'falling';
}

/** Convenience export so the HUD can fit the cap inside the bedtime collapse window. */
export const TIDE_LATE_BOUND = DAY_END_MIN;
