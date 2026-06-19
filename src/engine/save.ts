import { saveSchema, serializeSave, type SaveData } from './saveModel';

/**
 * localStorage-backed save store. The full save model lives in `saveModel.ts`;
 * this module is just persistence (read/write/delete/presence).
 */
export const SAVE_KEY = 'sturdy-volley:save:v1';

export function hasSaveGame(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const result = saveSchema.safeParse(JSON.parse(raw));
    if (!result.success) {
      if (import.meta.env.DEV) console.warn('[Sturdy Volley] stored save is invalid; ignoring it.');
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): void {
  data.updatedAt = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, serializeSave(data));
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[Sturdy Volley] failed to write save:', err);
  }
}

export function deleteSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
