import { describe, it, expect } from 'vitest';
import { tidesFor, nextTide, tideStateAt, isLowTide } from '../../src/engine/tide';
import { createGameTime, startNextDay, type GameTime } from '../../src/engine/timeSystem';

describe('tide schedule', () => {
  it('returns four events per day sorted by time', () => {
    const events = tidesFor(createGameTime());
    expect(events).toHaveLength(4);
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.minutes).toBeGreaterThan(events[i - 1]!.minutes);
    }
  });

  it('alternates low/high across the day', () => {
    const states = tidesFor(createGameTime()).map((e) => e.state);
    expect(new Set(states)).toEqual(new Set(['low', 'high']));
    // Two highs and two lows per cycle.
    expect(states.filter((s) => s === 'low')).toHaveLength(2);
    expect(states.filter((s) => s === 'high')).toHaveLength(2);
  });

  it('drifts forward across days', () => {
    const day1 = tidesFor(createGameTime());
    const day8: GameTime = { year: 1, season: 'spring', day: 8, minutes: 6 * 60 };
    const day8Events = tidesFor(day8);
    expect(day8Events[0]!.minutes).not.toBe(day1[0]!.minutes);
  });

  it('nextTide returns an event at or after the current minute', () => {
    const time: GameTime = { year: 1, season: 'spring', day: 1, minutes: 8 * 60 };
    const evt = nextTide(time);
    expect(evt).toBeDefined();
  });

  it('isLowTide is true during the falling/low window', () => {
    let time: GameTime = createGameTime();
    let lowCount = 0;
    for (let m = 6 * 60; m < 24 * 60; m += 30) {
      if (isLowTide({ ...time, minutes: m })) lowCount++;
    }
    expect(lowCount).toBeGreaterThan(0);
    time = startNextDay(time);
    expect(['low', 'rising', 'high', 'falling']).toContain(tideStateAt(time));
  });
});
