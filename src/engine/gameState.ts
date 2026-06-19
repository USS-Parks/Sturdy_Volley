import { writeSave } from './save';
import type { SaveData } from './saveModel';

/**
 * In-memory holder for the active save. Scenes read/mutate this during play;
 * persistence to localStorage is explicit via persistActiveSave() (or the
 * scenes' own writeSave on entry).
 */
let active: SaveData | null = null;

export function setActiveSave(save: SaveData): void {
  active = save;
}

export function getActiveSave(): SaveData | null {
  return active;
}

export function clearActiveSave(): void {
  active = null;
}

export function persistActiveSave(): void {
  if (active) writeSave(active);
}
