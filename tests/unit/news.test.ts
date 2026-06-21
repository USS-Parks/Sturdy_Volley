import { describe, it, expect } from 'vitest';
import { buildNoticeBoard, nextUpcomingFestival, type NoticeBoardInput } from '../../src/engine/news';

const base: NoticeBoardInput = {
  dateLabel: 'Year 1, spring 7 (Mon)',
  weatherTodayName: 'Clear',
  weatherTomorrowName: 'Rain',
  tideTodayLabel: 'low',
  tideTomorrowLabel: 'high',
  completedProjectNames: [],
  restorationTotal: 3,
  festivalTodayName: null,
  upcomingFestival: null,
  birthdaysSoon: [],
  lastShipmentGold: 0,
  availableRequests: [],
};

describe('buildNoticeBoard', () => {
  it('always renders a forecast for today + tomorrow', () => {
    const board = buildNoticeBoard(base);
    expect(board.forecast).toHaveLength(2);
    expect(board.forecast[0]!.text).toContain('Clear');
    expect(board.forecast[0]!.text).toContain('low');
    expect(board.forecast[1]!.text).toContain('Rain');
  });

  it('surfaces help-wanted requests + birthdays as reasons to visit', () => {
    const board = buildNoticeBoard({
      ...base,
      availableRequests: [{ id: 'mullet-market', name: 'Mullet Market', giver: 'Jun Park' }],
      birthdaysSoon: [{ name: 'Mara Vale', inDays: 2 }],
    });
    expect(board.requests.some((r) => r.kind === 'request' && r.text.includes('Mullet Market'))).toBe(true);
    expect(board.requests.some((r) => r.kind === 'birthday' && r.text.includes('Mara Vale'))).toBe(true);
  });

  it('reacts to festivals, restoration progress, and milestones', () => {
    const board = buildNoticeBoard({
      ...base,
      festivalTodayName: 'Seed Blessing',
      upcomingFestival: { name: 'Glowtide Night', inDays: 5 },
      completedProjectNames: ['The Netlight Beacon', 'Market Lane Canopies'],
    });
    expect(board.news.some((n) => n.text.includes('Seed Blessing'))).toBe(true);
    expect(board.news.some((n) => n.text.includes('Glowtide Night'))).toBe(true);
    expect(board.news.some((n) => n.text.includes('Restored: The Netlight Beacon'))).toBe(true);
    expect(board.news.some((n) => n.text.includes('2/3'))).toBe(true);
  });

  it('announces the town is whole at full restoration', () => {
    const board = buildNoticeBoard({ ...base, completedProjectNames: ['A', 'B', 'C'], restorationTotal: 3 });
    expect(board.news.some((n) => n.text.includes('whole again'))).toBe(true);
  });

  it('falls back to a quiet-bay notice when nothing is happening', () => {
    const board = buildNoticeBoard(base);
    expect(board.news).toHaveLength(1);
    expect(board.news[0]!.text).toContain('quiet');
  });

  it('reports a shipment when one landed', () => {
    const board = buildNoticeBoard({ ...base, lastShipmentGold: 240 });
    expect(board.news.some((n) => n.text.includes('240 g'))).toBe(true);
  });
});

describe('nextUpcomingFestival', () => {
  const fests = [
    { name: 'Seed Blessing', absoluteDay: 12 },
    { name: 'Glowtide Night', absoluteDay: 45 },
    { name: 'Past Fair', absoluteDay: 3 },
  ];

  it('picks the soonest festival strictly ahead within the lookahead window', () => {
    expect(nextUpcomingFestival(7, fests, 14)).toEqual({ name: 'Seed Blessing', inDays: 5 });
  });

  it('ignores festivals beyond the lookahead and ones already passed', () => {
    expect(nextUpcomingFestival(20, fests, 14)).toBeNull(); // Seed passed, Glowtide is 25 days out
    expect(nextUpcomingFestival(20, fests, 30)).toEqual({ name: 'Glowtide Night', inDays: 25 });
  });
});
