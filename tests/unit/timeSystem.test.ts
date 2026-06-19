import { describe, it, expect } from 'vitest';
import {
  createGameTime,
  formatClock,
  absoluteDay,
  weekdayOf,
  advanceTime,
  startNextDay,
  festivalOn,
  birthdaysOn,
  buildDaySummary,
  DAY_START_MIN,
  DAY_END_MIN,
  DAYS_PER_YEAR,
  type GameTime,
} from '../../src/engine/timeSystem';

describe('formatClock', () => {
  it('formats day and past-midnight hours', () => {
    expect(formatClock(6 * 60)).toBe('6:00 AM');
    expect(formatClock(12 * 60)).toBe('12:00 PM');
    expect(formatClock(13 * 60 + 30)).toBe('1:30 PM');
    expect(formatClock(24 * 60)).toBe('12:00 AM');
    expect(formatClock(25 * 60)).toBe('1:00 AM');
    expect(formatClock(DAY_END_MIN)).toBe('2:00 AM');
  });
});

describe('calendar', () => {
  it('starts at year 1, spring 1, 6 AM', () => {
    const t = createGameTime();
    expect(t).toEqual({ year: 1, season: 'spring', day: 1, minutes: DAY_START_MIN });
  });

  it('computes absolute day and weekday deterministically', () => {
    expect(absoluteDay({ year: 1, season: 'spring', day: 1 })).toBe(0);
    expect(absoluteDay({ year: 1, season: 'summer', day: 1 })).toBe(28);
    expect(absoluteDay({ year: 2, season: 'spring', day: 1 })).toBe(DAYS_PER_YEAR);
    expect(weekdayOf({ year: 1, season: 'spring', day: 1 })).toBe('Mon');
    expect(weekdayOf({ year: 1, season: 'spring', day: 8 })).toBe('Mon');
  });
});

describe('advanceTime', () => {
  it('advances within the day', () => {
    const r = advanceTime(createGameTime(), 90);
    expect(r.collapsed).toBe(false);
    expect(r.time.minutes).toBe(DAY_START_MIN + 90);
  });

  it('collapses at 2 AM and clamps', () => {
    const late: GameTime = { year: 1, season: 'spring', day: 1, minutes: DAY_END_MIN - 10 };
    const r = advanceTime(late, 60);
    expect(r.collapsed).toBe(true);
    expect(r.time.minutes).toBe(DAY_END_MIN);
  });
});

describe('startNextDay', () => {
  it('rolls to the next day at 6 AM', () => {
    const t = startNextDay({ year: 1, season: 'spring', day: 5, minutes: DAY_END_MIN });
    expect(t).toEqual({ year: 1, season: 'spring', day: 6, minutes: DAY_START_MIN });
  });

  it('wraps season after day 28', () => {
    const t = startNextDay({ year: 1, season: 'spring', day: 28, minutes: DAY_END_MIN });
    expect(t.season).toBe('summer');
    expect(t.day).toBe(1);
  });

  it('wraps year after winter 28', () => {
    const t = startNextDay({ year: 1, season: 'winter', day: 28, minutes: DAY_END_MIN });
    expect(t).toEqual({ year: 2, season: 'spring', day: 1, minutes: DAY_START_MIN });
  });
});

describe('event lookups', () => {
  const t: GameTime = { year: 1, season: 'fall', day: 16, minutes: DAY_START_MIN };

  it('finds a festival on the matching day', () => {
    const festivals = [
      { id: 'seed-blessing', season: 'spring', day: 13 },
      { id: 'harvest-fair', season: 'fall', day: 16 },
    ] as const;
    expect(festivalOn(t, festivals)?.id).toBe('harvest-fair');
    expect(festivalOn({ ...t, day: 17 }, festivals)).toBeNull();
  });

  it('finds birthdays on the matching day', () => {
    const npcs = [
      { id: 'mara', birthday: { season: 'fall' as const, day: 16 } },
      { id: 'jun', birthday: { season: 'spring' as const, day: 2 } },
      { id: 'no-bday' },
    ];
    expect(birthdaysOn(t, npcs).map((n) => n.id)).toEqual(['mara']);
  });
});

describe('buildDaySummary', () => {
  it('assembles label, totals, and notices', () => {
    const s = buildDaySummary({
      endingTime: { year: 1, season: 'spring', day: 1, minutes: DAY_END_MIN },
      income: 250,
      skillXp: { cultivation: 12 },
      relationshipChanges: 2,
      collapsed: true,
      tomorrowFestival: 'Seed Blessing',
      tomorrowBirthdays: ['Jun'],
    });
    expect(s.dayLabel).toContain('Year 1, spring 1');
    expect(s.income).toBe(250);
    expect(s.skillXp.cultivation).toBe(12);
    expect(s.notices).toContain('You collapsed and were carried home.');
    expect(s.notices).toContain('Tomorrow: Seed Blessing.');
    expect(s.notices).toContain("Jun's birthday is tomorrow.");
  });
});
