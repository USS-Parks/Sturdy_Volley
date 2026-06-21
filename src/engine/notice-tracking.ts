import { loadGameContent } from '../data/content';
import { getActiveSave } from './gameState';
import { forecastFor } from './weather';
import { tideStateAt } from './tide';
import { completedProjectFlags } from './civic';
import { buildNoticeBoard, nextUpcomingFestival, type NoticeBoard } from './news';
import { getGameTime } from './dayResolution';
import { absoluteDay, startNextDay, weekdayOf, type Season } from './timeSystem';

/**
 * Runtime glue that assembles the town notice board (Prompt 058) from the active
 * save + content, then hands the snapshot to the pure `buildNoticeBoard`. Keeps
 * the news engine free of save/clock/IO.
 */

/** Absolute day index of the next occurrence of a (season, day) on/after today. */
function nextOccurrenceAbs(todayAbs: number, year: number, season: Season, day: number): number {
  const thisYear = absoluteDay({ year, season, day });
  return thisYear >= todayAbs ? thisYear : absoluteDay({ year: year + 1, season, day });
}

export function buildActiveNoticeBoard(): NoticeBoard | null {
  const save = getActiveSave();
  if (!save) return null;
  const content = loadGameContent();
  const time = getGameTime(save);
  const tomorrow = startNextDay(time);
  const todayAbs = absoluteDay(time);

  const weatherToday = forecastFor(time, content.weather);
  const weatherTomorrow = forecastFor(tomorrow, content.weather);

  // Restoration progress.
  const completedFlags = new Set(completedProjectFlags(save.projects));
  const completedProjectNames = content.projects
    .filter((p) => completedFlags.has(`civic:${p.id}`))
    .map((p) => p.name);

  // Festivals: today's + the soonest upcoming within the lookahead window.
  const festivalToday = content.festivals.find((f) => f.season === time.season && f.day === time.day) ?? null;
  const upcomingFestival = nextUpcomingFestival(
    todayAbs,
    content.festivals.map((f) => ({ name: f.name, absoluteDay: nextOccurrenceAbs(todayAbs, time.year, f.season, f.day) })),
  );

  // Birthdays within a week.
  const npcName = new Map(content.npcs.map((n) => [n.id, n.name] as const));
  const birthdaysSoon = content.npcs
    .map((n) => ({ name: n.name, inDays: nextOccurrenceAbs(todayAbs, time.year, n.birthday.season, n.birthday.day) - todayAbs }))
    .filter((b) => b.inDays > 0 && b.inDays <= 7)
    .sort((a, b) => a.inDays - b.inDays);

  // Available help-wanted requests — the daily/weekly reasons to visit town.
  const availableRequests = content.quests
    .filter((q) => q.kind === 'request' && save.quests[q.id]?.status === 'available')
    .map((q) => ({ id: q.id, name: q.name, giver: q.giverNpcId ? npcName.get(q.giverNpcId) ?? q.giverNpcId : null }));

  return buildNoticeBoard({
    dateLabel: `Year ${time.year}, ${time.season} ${time.day} (${weekdayOf(time)})`,
    weatherTodayName: weatherToday?.name ?? null,
    weatherTomorrowName: weatherTomorrow?.name ?? null,
    tideTodayLabel: tideStateAt(time),
    tideTomorrowLabel: tideStateAt(tomorrow),
    completedProjectNames,
    restorationTotal: content.projects.length,
    festivalTodayName: festivalToday?.name ?? null,
    upcomingFestival,
    birthdaysSoon,
    lastShipmentGold: 0, // shipping progress notes live in the bedtime day-summary
    availableRequests,
  });
}
