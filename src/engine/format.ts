import type { SaveData } from './saveModel';

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
