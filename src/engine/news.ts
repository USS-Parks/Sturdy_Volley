/**
 * Town notice board + dynamic news (Prompt 058). Pure + deterministic: it turns a
 * snapshot of world state into the board's three sections — a weather/tide
 * forecast, daily/weekly "reasons to visit town" (help-wanted requests +
 * birthdays), and dynamic news that reacts to restoration progress, festivals,
 * and shipments. Nothing here reads the save, clock, DOM, or globals; the scene
 * supplies the snapshot.
 */

export interface NoticeRow {
  kind: 'forecast' | 'request' | 'birthday' | 'news';
  text: string;
  /** Source id for requests (quest id), for click-through later. */
  id?: string;
}

export interface NoticeBoardInput {
  /** Pre-formatted "Year 1, spring 7 (Mon)". */
  dateLabel: string;
  weatherTodayName: string | null;
  weatherTomorrowName: string | null;
  tideTodayLabel: string;
  tideTomorrowLabel: string;
  /** Names of restoration projects completed so far. */
  completedProjectNames: readonly string[];
  /** Total restoration projects in the town. */
  restorationTotal: number;
  /** Festival happening today, if any. */
  festivalTodayName: string | null;
  /** The next upcoming festival within the lookahead window. */
  upcomingFestival: { name: string; inDays: number } | null;
  /** NPC birthdays within the lookahead window. */
  birthdaysSoon: ReadonlyArray<{ name: string; inDays: number }>;
  /** Gold earned by the most recent overnight shipment (0 = none). */
  lastShipmentGold: number;
  /** Available help-wanted requests (the daily/weekly reasons to visit town). */
  availableRequests: ReadonlyArray<{ id: string; name: string; giver: string | null }>;
}

export interface NoticeBoard {
  forecast: NoticeRow[];
  requests: NoticeRow[];
  news: NoticeRow[];
  /** Headline counts for the panel subtitle. */
  summary: string;
}

function inDaysLabel(inDays: number): string {
  if (inDays <= 0) return 'today';
  if (inDays === 1) return 'tomorrow';
  return `in ${inDays} days`;
}

export function buildNoticeBoard(input: NoticeBoardInput): NoticeBoard {
  const forecast: NoticeRow[] = [];
  if (input.weatherTodayName) {
    forecast.push({ kind: 'forecast', text: `Today: ${input.weatherTodayName} · tide ${input.tideTodayLabel}.` });
  }
  if (input.weatherTomorrowName) {
    forecast.push({ kind: 'forecast', text: `Tomorrow: ${input.weatherTomorrowName} · tide ${input.tideTomorrowLabel}.` });
  }

  // Requests + birthdays are the "reasons to visit town" section.
  const requests: NoticeRow[] = [];
  for (const r of input.availableRequests) {
    requests.push({
      kind: 'request',
      id: r.id,
      text: r.giver ? `Help wanted: ${r.name} (${r.giver})` : `Help wanted: ${r.name}`,
    });
  }
  for (const b of input.birthdaysSoon) {
    requests.push({ kind: 'birthday', text: `${b.name}'s birthday is ${inDaysLabel(b.inDays)}.` });
  }

  // Dynamic news reacts to festivals, restoration, and shipments.
  const news: NoticeRow[] = [];
  if (input.festivalTodayName) {
    news.push({ kind: 'news', text: `Today is the ${input.festivalTodayName} — come down to the common!` });
  }
  if (input.upcomingFestival) {
    news.push({ kind: 'news', text: `Coming up: the ${input.upcomingFestival.name} ${inDaysLabel(input.upcomingFestival.inDays)}.` });
  }
  for (const name of input.completedProjectNames) {
    news.push({ kind: 'news', text: `Restored: ${name}.` });
  }
  const done = input.completedProjectNames.length;
  if (input.restorationTotal > 0 && done > 0) {
    news.push({
      kind: 'news',
      text:
        done >= input.restorationTotal
          ? `${done}/${input.restorationTotal} projects restored — Ballast Bay is whole again.`
          : `${done}/${input.restorationTotal} restoration projects done — the town is taking shape.`,
    });
  }
  if (input.lastShipmentGold > 0) {
    news.push({ kind: 'news', text: `Yesterday's shipments brought ${input.lastShipmentGold} g into the bay.` });
  }
  if (news.length === 0) {
    news.push({ kind: 'news', text: 'The bay is quiet. Restore a project or visit during a festival to make headlines.' });
  }

  const summary = `${requests.length} reason${requests.length === 1 ? '' : 's'} to visit · ${news.length} notice${news.length === 1 ? '' : 's'}`;
  return { forecast, requests, news, summary };
}

/**
 * Pick the next upcoming festival (and how many days out) within `lookahead`
 * days. Pure helper over (season,day) calendar events — the scene maps its
 * festival list through this. `absoluteDayOf` converts a (season,day) in the
 * current year to an absolute index for distance math.
 */
export function nextUpcomingFestival(
  todayAbsolute: number,
  festivals: ReadonlyArray<{ name: string; absoluteDay: number }>,
  lookahead = 14,
): { name: string; inDays: number } | null {
  let best: { name: string; inDays: number } | null = null;
  for (const f of festivals) {
    const inDays = f.absoluteDay - todayAbsolute;
    if (inDays > 0 && inDays <= lookahead && (!best || inDays < best.inDays)) {
      best = { name: f.name, inDays };
    }
  }
  return best;
}
