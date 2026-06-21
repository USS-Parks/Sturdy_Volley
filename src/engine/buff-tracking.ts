import { loadGameContent } from '../data/content';
import { getActiveSave, persistActiveSave } from './gameState';
import { countItem, removeItem } from './inventory';
import {
  activeBuffEffects,
  applyBuff,
  buffRows,
  eatFood,
  isEdible,
  noBuffEffects,
  tickBuffs,
  type BuffEffects,
  type BuffRow,
} from './buffs';

/**
 * Runtime glue between the scenes and the pure buff engine (`buffs.ts`). Reads /
 * mutates the active save (inventory + `activeBuffs`) and persists. Stamina lives
 * on the scene's controller state, so `eatActiveFood` returns the restore amount
 * for the caller to apply rather than touching it here.
 */

export interface EatActiveResult {
  eaten: boolean;
  reason?: 'no-save' | 'unknown-item' | 'not-edible' | 'none-held';
  staminaRestore: number;
  buffLabel: string | null;
  itemName: string;
}

/** Eat one of `itemId` from the active inventory: removes it, applies its buff, persists. */
export function eatActiveFood(itemId: string): EatActiveResult {
  const save = getActiveSave();
  if (!save) return { eaten: false, reason: 'no-save', staminaRestore: 0, buffLabel: null, itemName: itemId };
  const item = loadGameContent().items.find((i) => i.id === itemId);
  if (!item) return { eaten: false, reason: 'unknown-item', staminaRestore: 0, buffLabel: null, itemName: itemId };
  if (!isEdible(item)) return { eaten: false, reason: 'not-edible', staminaRestore: 0, buffLabel: null, itemName: item.name };
  if (countItem(save.inventory, itemId) <= 0) return { eaten: false, reason: 'none-held', staminaRestore: 0, buffLabel: null, itemName: item.name };

  save.inventory = removeItem(save.inventory, itemId, 1).container;
  const outcome = eatFood(item);
  let buffLabel: string | null = null;
  if (outcome.buff) {
    save.activeBuffs = applyBuff(save.activeBuffs, outcome.buff, save.calendar.timeMinutes);
    buffLabel = buffRows(save.activeBuffs, save.calendar.timeMinutes).find((r) => r.effect === outcome.buff!.effect)?.label ?? null;
  }
  persistActiveSave();
  return { eaten: true, staminaRestore: outcome.staminaRestore, buffLabel, itemName: item.name };
}

/** Aggregated live buff effects on the active save (1× / 0 when none). */
export function activeBuffEffectsNow(): BuffEffects {
  const save = getActiveSave();
  if (!save) return noBuffEffects();
  return activeBuffEffects(save.activeBuffs, save.calendar.timeMinutes);
}

/** Live buff rows for the HUD / buff panel. */
export function activeBuffRows(): BuffRow[] {
  const save = getActiveSave();
  if (!save) return [];
  return buffRows(save.activeBuffs, save.calendar.timeMinutes);
}

/** Prune expired buffs on the active save; persists only when something lapsed. */
export function pruneActiveBuffs(): void {
  const save = getActiveSave();
  if (!save || save.activeBuffs.length === 0) return;
  const next = tickBuffs(save.activeBuffs, save.calendar.timeMinutes);
  if (next.length !== save.activeBuffs.length) {
    save.activeBuffs = next;
    persistActiveSave();
  }
}
