import type { SaveData } from './saveModel';
import {
  startNextDay,
  buildDaySummary,
  birthdaysOn,
  festivalOn,
  type GameTime,
  type DaySummary,
} from './timeSystem';
import type { Crop, Festival, Item, Npc, Weather } from '../data/schemas';
import type { DayLedger } from './gameState';
import { buildItemCatalog, containerSellValue } from './itemCatalog';
import { advanceCrops, buildCropIndex } from './soil';
import { advanceWorld, type RegionForageTable } from './forage';
import { absoluteDay } from './timeSystem';
import { evaluateRecipeUnlocks, unlockRecipes } from './crafting';
import { resolveAnimalsDay } from './animals';

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
  crops: readonly Crop[];
  forageTables?: readonly RegionForageTable[];
  todayWeatherId?: string | null;
  /** Prompt 019: full Weather object for animal shelter checks. */
  todayWeather?: Weather | null;
  penalty?: CollapsePenalty;
}

export interface ResolveDayResult {
  summary: DaySummary;
  nextTime: GameTime;
  collapse: CollapseOutcome | null;
  shipmentEarnings: number;
  cropsGrew: number;
  cropsMatured: number;
  cropsKilled: number;
  forageSpawned: number;
}

/**
 * Pure day-resolution: drain the shipping bin into income, apply ledger income,
 * apply collapse penalty (if any), roll the calendar, and assemble the bedtime
 * summary. Mutates the save in-place; callers are responsible for persisting it.
 */
export function resolveDay(input: ResolveDayInput): ResolveDayResult {
  const { save, ledger, collapsed, festivals, npcs, items, crops } = input;
  const catalog = buildItemCatalog(items, npcs);
  const shipmentEarnings = containerSellValue(save.shippingBin, catalog);
  save.shippingBin = { slots: new Array(save.shippingBin.capacity).fill(null), capacity: save.shippingBin.capacity };

  const totalIncome = ledger.income + shipmentEarnings;
  save.wallet.gold += totalIncome;

  // Prompt 017: flush today's skill XP into the persistent skill totals so
  // unlock thresholds can advance from real play.
  for (const [skillId, xp] of Object.entries(ledger.skillXp)) {
    save.skills[skillId] = (save.skills[skillId] ?? 0) + xp;
  }

  const collapse = collapsed ? applyCollapsePenalty(save, input.penalty) : null;

  const endingTime = getGameTime(save);
  const nextTime = startNextDay(endingTime);
  applyGameTime(save, nextTime);

  const rained = input.todayWeatherId === 'rain';
  const cropResult = advanceCrops({
    plantings: save.plantings,
    cropsById: buildCropIndex(crops),
    newSeason: nextTime.season,
    rained,
  });
  save.plantings = cropResult.plantings;

  const worldResult = advanceWorld({
    entities: save.worldEntities,
    newSeason: nextTime.season,
    tables: input.forageTables ?? [],
    seed: absoluteDay(nextTime),
  });
  save.worldEntities = worldResult.entities;

  // RF-13: reset weekly gift counters at the start of a new week (Monday).
  if (absoluteDay(nextTime) % 7 === 0) {
    save.giftsThisWeek = {};
  }

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
  if (cropResult.killed > 0) {
    summary.notices.push(
      `${cropResult.killed} crop${cropResult.killed === 1 ? '' : 's'} wilted overnight.`,
    );
  }
  if (cropResult.matured > 0) {
    summary.notices.push(
      `${cropResult.matured} crop${cropResult.matured === 1 ? ' is' : 's are'} ready to harvest.`,
    );
  }

  if (worldResult.spawned > 0) {
    summary.notices.push(
      `${worldResult.spawned} forage item${worldResult.spawned === 1 ? '' : 's'} appeared in the wild.`,
    );
  }

  // Prompt 019: animals tick at day end. Sheltered = true by default
  // (every Prompt 019 animal has a building). Products land in the
  // shipping bin so they sell with the morning shipment.
  const todayWeather = input.todayWeather ?? null;
  const animalsResult = resolveAnimalsDay({
    save,
    weather: todayWeather,
    shelteredById: {},
    bin: save.shippingBin,
  });
  save.shippingBin = animalsResult.bin;
  if (animalsResult.produced.length > 0) {
    summary.notices.push(
      `${animalsResult.produced.length} animal product${animalsResult.produced.length === 1 ? '' : 's'} collected.`,
    );
  }
  const sadCount = animalsResult.moodCounts.lonely + animalsResult.moodCounts.cold;
  if (sadCount > 0) {
    summary.notices.push(
      `${sadCount} animal${sadCount === 1 ? '' : 's'} unhappy today — pet and feed them.`,
    );
  }

  // Prompt 017: re-check recipe unlock conditions at day end. Skills /
  // friendship may have advanced today; surface any newly known recipes.
  const newRecipes = evaluateRecipeUnlocks({
    knownRecipeIds: save.knownRecipeIds,
    skills: save.skills,
    relationships: save.relationships,
    flags: Object.fromEntries(
      Object.entries(save.flags).filter(([, v]) => typeof v !== 'object'),
    ) as Record<string, boolean | number | string>,
  });
  if (newRecipes.length > 0) {
    save.knownRecipeIds = unlockRecipes(save.knownRecipeIds, newRecipes);
    summary.notices.push(
      `${newRecipes.length} new recipe${newRecipes.length === 1 ? '' : 's'} unlocked.`,
    );
  }

  return {
    summary,
    nextTime,
    collapse,
    shipmentEarnings,
    cropsGrew: cropResult.grew,
    cropsMatured: cropResult.matured,
    cropsKilled: cropResult.killed,
    forageSpawned: worldResult.spawned,
  };
}

// Re-export Weather here for callers that need it co-located with resolveDay.
export type { Weather };
