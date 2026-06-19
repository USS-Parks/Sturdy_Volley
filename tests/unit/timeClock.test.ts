import { describe, it, expect } from 'vitest';
import {
  createTimeClock,
  tickClock,
  pauseClock,
  setClockScale,
  setClockTime,
  REAL_SECONDS_PER_GAME_MINUTE,
} from '../../src/engine/timeClock';
import { createGameTime, DAY_END_MIN, DAY_START_MIN } from '../../src/engine/timeSystem';

describe('tickClock', () => {
  it('advances integer game minutes and carries the remainder', () => {
    const clock = createTimeClock(createGameTime());
    const r1 = tickClock(clock, REAL_SECONDS_PER_GAME_MINUTE);
    expect(r1.advancedMinutes).toBe(1);
    expect(r1.state.time.minutes).toBe(DAY_START_MIN + 1);

    const r2 = tickClock(r1.state, REAL_SECONDS_PER_GAME_MINUTE * 0.4);
    expect(r2.advancedMinutes).toBe(0);
    expect(r2.state.time.minutes).toBe(DAY_START_MIN + 1);

    const r3 = tickClock(r2.state, REAL_SECONDS_PER_GAME_MINUTE * 0.7);
    expect(r3.advancedMinutes).toBe(1);
    expect(r3.state.time.minutes).toBe(DAY_START_MIN + 2);
  });

  it('does not advance while paused', () => {
    const clock = pauseClock(createTimeClock(createGameTime()), true);
    const r = tickClock(clock, 10);
    expect(r.advancedMinutes).toBe(0);
    expect(r.state.time.minutes).toBe(DAY_START_MIN);
  });

  it('respects the debug-only time scale (clamped)', () => {
    const fast = setClockScale(createTimeClock(createGameTime()), 60);
    const r = tickClock(fast, REAL_SECONDS_PER_GAME_MINUTE);
    expect(r.advancedMinutes).toBe(60);
    const insane = setClockScale(createTimeClock(createGameTime()), 9999);
    expect(insane.scale).toBe(120);
    const negative = setClockScale(createTimeClock(createGameTime()), -1);
    expect(negative.scale).toBe(0);
  });

  it('reports collapse when time reaches 2 AM', () => {
    const late = setClockTime(createTimeClock(createGameTime()), {
      year: 1,
      season: 'spring',
      day: 1,
      minutes: DAY_END_MIN - 5,
    });
    const r = tickClock(late, REAL_SECONDS_PER_GAME_MINUTE * 30);
    expect(r.collapsed).toBe(true);
    expect(r.state.time.minutes).toBe(DAY_END_MIN);
  });

  it('clears carry on pause so unpausing does not double-tick', () => {
    let clock = createTimeClock(createGameTime());
    clock = tickClock(clock, REAL_SECONDS_PER_GAME_MINUTE * 0.5).state;
    expect(clock.carryRealSeconds).toBeGreaterThan(0);
    clock = pauseClock(clock, true);
    expect(clock.carryRealSeconds).toBe(0);
  });
});
