import { advanceTime, DAY_END_MIN, type AdvanceResult, type GameTime } from './timeSystem';

/**
 * Real-time → game-time ticker. Owns the "0.7 real seconds = 10 game minutes"
 * cadence Stardew uses as a comfort baseline (≈85 real seconds for a full 20-h
 * day at 1× scale), the menu pause, and a debug-only time scale. Pure: no DOM
 * coupling, no Babylon, no Date.now — drives off the delta seconds the scene
 * already computes for its render loop.
 */
export const REAL_SECONDS_PER_GAME_MINUTE = 0.7;

export interface TimeClockState {
  time: GameTime;
  paused: boolean;
  /** Debug-only multiplier on game-time advance. 1 = normal cadence. */
  scale: number;
  /** Accumulates fractional minutes between integer-minute advances. */
  carryRealSeconds: number;
}

export function createTimeClock(time: GameTime): TimeClockState {
  return { time, paused: false, scale: 1, carryRealSeconds: 0 };
}

export interface ClockTickResult {
  state: TimeClockState;
  advancedMinutes: number;
  collapsed: boolean;
}

/**
 * Advance the clock by `dt` real seconds. Whole game-minutes accumulate; the
 * remainder is carried so a 1× tick at 60 FPS adds about 0.024 minutes a frame
 * and lands a real minute every ~42 frames.
 */
export function tickClock(state: TimeClockState, dt: number): ClockTickResult {
  if (state.paused || dt <= 0 || state.scale <= 0) {
    return { state, advancedMinutes: 0, collapsed: state.time.minutes >= DAY_END_MIN };
  }

  const realSeconds = state.carryRealSeconds + dt * state.scale;
  const minutes = Math.floor(realSeconds / REAL_SECONDS_PER_GAME_MINUTE);
  const carryRealSeconds = realSeconds - minutes * REAL_SECONDS_PER_GAME_MINUTE;

  if (minutes <= 0) {
    return {
      state: { ...state, carryRealSeconds },
      advancedMinutes: 0,
      collapsed: state.time.minutes >= DAY_END_MIN,
    };
  }

  const result: AdvanceResult = advanceTime(state.time, minutes);
  return {
    state: { ...state, time: result.time, carryRealSeconds },
    advancedMinutes: result.time.minutes - state.time.minutes,
    collapsed: result.collapsed,
  };
}

export function pauseClock(state: TimeClockState, paused: boolean): TimeClockState {
  if (state.paused === paused) return state;
  return { ...state, paused, carryRealSeconds: paused ? 0 : state.carryRealSeconds };
}

/** Debug-only time scale. Clamped so a fat-finger doesn't lock the clock. */
export function setClockScale(state: TimeClockState, scale: number): TimeClockState {
  const safe = Math.max(0, Math.min(120, scale));
  return { ...state, scale: safe };
}

export function setClockTime(state: TimeClockState, time: GameTime): TimeClockState {
  return { ...state, time, carryRealSeconds: 0 };
}
