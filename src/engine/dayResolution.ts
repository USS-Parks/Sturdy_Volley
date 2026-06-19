import type { SaveData } from './saveModel';
import {
  startNextDay,
  buildDaySummary,
  birthdaysOn,
  festivalOn,
  type GameTime,
  type DaySummary,
} from './timeSystem';
import type { Festival, Item, Npc } from '../data/schemas';
import type { DayLedger } from './gameState';
import { buildItemCatalog, containerSellValue } from './itemCatalog';

/** Sync from the save's flat `calendar` into the timeSystem's `GameTime`. */
export function getGameTime(save: SaveData): GameTime {
  return {
    year: save.calendar.year,
    season: save.calendar.season,
    day: save.calendar.day,
    minutes: save.calendar.timeMinutes,
  };
}

export function applyGameTime(save: SaveData, time: GameTime): void {
  save.calendar.year = time.year;
  save.calendar.season = time.season;
  save.calendar.day = time.day;
  save.calendar.timeMinutes = time.minutes;
}

/**
 * Tunable penalty for collapsing past 2 AM. Fractions are floors — losing 0
 * gold when the wallet is empty is correct, not a soft floor.
 */
export interface CollapsePenalty {
  goldFraction: number; // 0..1
  energyFloor: number; // 0..100 — stamina the player wakes up with
}

export const DEFAULT_COLLAPSE_PENALTY: CollapsePenalty = {
  goldFraction: 0.1,
  energyFloor: 50,
};

export interface CollapseOutcome {
  goldLost: number;
  wakeStamina: number;
}

export function applyCollapsePenalty(
  save: SaveData,
  penalty: CollapsePenalty = DEFAULT_COLLAPSE_PENALTY,
): CollapseOutcome {
  const goldLost = Math.min(save.wallet.gold, Math.floor(save.wallet.gold * penalty.goldFraction));
  save.wallet.gold -= goldLost;
  return { goldLost, wakeStamina: penalty.energyFloor };
}

export interface ResolveDayInput {
  save: SaveData;
  ledger: DayLedger;
  collapsed: boolean;
  festivals: readonly Festival[];
  npcs: readonly Npc[];
  items: readonly Item[];
  penalty?: CollapsePenalty;
}

export interface ResolveDayResult {
  summary: DaySummary;
  nextTime: GameTime;
  collapse: CollapseOutcome | null;
  shipmentEarnings: number;
}

/**
 * Pure day-resolution: drain the shipping bin into income, apply ledger income,
 * apply collapse penalty (if any), roll the calendar, and assemble the bedtime
 * summary. Mutates the save in-place; callers are responsible for persisting it.
 */
export function resolveDay(input: ResolveDayInput): ResolveDayResult {
  const { save, ledger, collapsed, festivals, npcs, items } = input;
  const catalog = buildItemCatalog(items, npcs);
  const shipmentEarnings = containerSellValue(save.shippingBin, catalog);
  save.shippingBin = { slots: new Array(save.shippingBin.capacity).fill(null), capacity: save.shippingBin.capacity };

  const totalIncome = ledger.income + shipmentEarnings;
  save.wallet.gold += totalIncome;

  const collapse = collapsed ? applyCollapsePenalty(save, input.penalty) : null;

  const endingTime = getGameTime(save);
  const nextTime = startNextDay(endingTime);
  applyGameTime(save, nextTime);

  const tomorrowFestival = festivalOn(nextTime, festivals);
  const tomorrowBirthdays = birthdaysOn(nextTime, npcs).map((n) => n.name);

  const summary = buildDaySummary({
    endingTime,
    income: totalIncome,
    skillXp: ledger.skillXp,
    relationshipChanges: ledger.relationshipChanges,
    collapsed,
    tomorrowFestival: tomorrowFestival?.name ?? null,
    tomorrowBirthdays,
  });
  if (shipmentEarnings > 0) {
    summary.notices.unshift(`Yesterday's shipment earned ${shipmentEarnings} g.`);
  }

  return { summary, nextTime, collapse, shipmentEarnings };
}
