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
  resetDayLedger();
}

export function persistActiveSave(): void {
  if (active) writeSave(active);
}

/**
 * Transient per-day deltas, drained at bedtime / collapse into the day summary
 * and applied to the save. Not persisted directly — the world state in the save
 * is the canonical truth; the ledger only tracks what happened *today*.
 */
export interface DayLedger {
  income: number;
  skillXp: Record<string, number>;
  relationshipChanges: number;
}

let ledger: DayLedger = emptyLedger();

function emptyLedger(): DayLedger {
  return { income: 0, skillXp: {}, relationshipChanges: 0 };
}

export function getDayLedger(): DayLedger {
  return ledger;
}

export function recordIncome(amount: number): void {
  ledger.income += Math.max(0, Math.round(amount));
}

export function recordSkillXp(skillId: string, amount: number): void {
  if (amount <= 0) return;
  ledger.skillXp[skillId] = (ledger.skillXp[skillId] ?? 0) + amount;
}

export function recordRelationshipChange(delta: number): void {
  ledger.relationshipChanges += Math.abs(Math.trunc(delta));
}

export function resetDayLedger(): void {
  ledger = emptyLedger();
}
