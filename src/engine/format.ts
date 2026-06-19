import type { SaveData } from './saveModel';
import { weekdayOf } from './timeSystem';
import type { Weather } from '../data/schemas';
import type { TideState } from './tide';

/** Render in-game minutes-since-midnight as a 12-hour clock string. */
export function formatClock(totalMinutes: number): string {
  const dayMinutes = 24 * 60;
  const m = ((totalMinutes % dayMinutes) + dayMinutes) % dayMinutes;
  const hours24 = Math.floor(m / 60);
  const minutes = m % 60;
  const meridiem = hours24 < 12 ? 'AM' : 'PM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${meridiem}`;
}

export function capitalize(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

/** One-line status string for the in-game HUD / scene cards. */
export function formatSaveStatus(save: SaveData): string {
  const c = save.calendar;
  return `${save.player.name} · Year ${c.year}, ${capitalize(c.season)} ${c.day} · ${formatClock(c.timeMinutes)}`;
}

const TIDE_LABEL: Record<TideState, string> = {
  low: 'low tide',
  rising: 'rising tide',
  high: 'high tide',
  falling: 'falling tide',
};

/** Extended HUD line that adds weekday, weather, and tide context. */
export function formatWorldStatus(
  save: SaveData,
  ctx: { weather?: Weather | null; tide?: TideState | null; gold?: number } = {},
): string {
  const c = save.calendar;
  const weekday = weekdayOf({ year: c.year, season: c.season, day: c.day });
  const parts = [
    save.player.name,
    `Year ${c.year}, ${capitalize(c.season)} ${c.day} (${weekday})`,
    formatClock(c.timeMinutes),
  ];
  if (typeof ctx.gold === 'number') parts.push(`${ctx.gold} g`);
  if (ctx.weather) parts.push(ctx.weather.name);
  if (ctx.tide) parts.push(TIDE_LABEL[ctx.tide]);
  return parts.join(' · ');
}
