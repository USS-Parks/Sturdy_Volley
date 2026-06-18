/**
 * Save-presence check used by the title screen. The full save model
 * (player, day, season, inventory, relationships, flags, …) and
 * export/import land in Prompt 003.
 */
export const SAVE_KEY = 'sturdy-volley:save:v1';

export function hasSaveGame(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}
