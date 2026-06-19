import type { Crop, Season } from '../data/schemas';

/**
 * Soil + crop planting layer (Prompt 008). Pure, deterministic. Plantings are
 * keyed by `"${sceneKey}:${col},${row}"` so they ride in the save without
 * coupling to the renderer-side FarmGrid.
 */
export interface Planting {
  cropId: string;
  daysGrown: number;
  watered: boolean;
  harvests: number; // number of times this planting has been harvested (regrow crops)
}

export function plantingKey(sceneKey: string, col: number, row: number): string {
  return `${sceneKey}:${col},${row}`;
}

export function newPlanting(cropId: string): Planting {
  return { cropId, daysGrown: 0, watered: false, harvests: 0 };
}

/** Days remaining until the next harvest (or 0 when ready). */
export function daysUntilHarvest(crop: Crop, planting: Planting): number {
  if (planting.harvests === 0) {
    return Math.max(0, crop.growthDays - planting.daysGrown);
  }
  if (crop.regrowDays === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, crop.regrowDays - planting.daysGrown);
}

export function isHarvestReady(crop: Crop, planting: Planting): boolean {
  return daysUntilHarvest(crop, planting) === 0;
}

export interface AdvanceCropsInput {
  plantings: Record<string, Planting>;
  cropsById: ReadonlyMap<string, Crop>;
  newSeason: Season;
  rained: boolean;
}

export interface AdvanceCropsResult {
  plantings: Record<string, Planting>;
  killed: number;
  grew: number;
  matured: number;
}

/**
 * Roll the day forward for every planting: rain waters everything; watered
 * crops advance one day; out-of-season crops die. Returns a fresh map so the
 * save model can be replaced in place.
 */
export function advanceCrops(input: AdvanceCropsInput): AdvanceCropsResult {
  const out: Record<string, Planting> = {};
  let killed = 0;
  let grew = 0;
  let matured = 0;
  for (const [key, planting] of Object.entries(input.plantings)) {
    const crop = input.cropsById.get(planting.cropId);
    if (!crop) {
      // Unknown crop — leave it untouched rather than silently dropping.
      out[key] = planting;
      continue;
    }
    if (!crop.seasons.includes(input.newSeason)) {
      killed += 1;
      continue; // crop dies overnight
    }
    const watered = input.rained || planting.watered;
    const wasReady = isHarvestReady(crop, planting);
    const next: Planting = {
      cropId: planting.cropId,
      daysGrown: watered ? planting.daysGrown + 1 : planting.daysGrown,
      watered: false, // resets each morning
      harvests: planting.harvests,
    };
    if (watered) grew += 1;
    if (!wasReady && isHarvestReady(crop, next)) matured += 1;
    out[key] = next;
  }
  return { plantings: out, killed, grew, matured };
}

/**
 * Deterministic quality roll using a small Mulberry32 seeded from the planting
 * + crop + a tick of the world. Bias common → silver → gold → iridium.
 */
export function rollQuality(
  cropId: string,
  daysGrown: number,
  watered: boolean,
  seedExtra = 0,
): 0 | 1 | 2 | 3 {
  let seed = seedExtra ^ daysGrown;
  for (let i = 0; i < cropId.length; i++) seed = (seed * 31 + cropId.charCodeAt(i)) | 0;
  seed = (seed ^ (watered ? 0x9e3779b9 : 0)) | 0;
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const roll = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  if (roll < 0.06) return 3;
  if (roll < 0.2) return 2;
  if (roll < 0.45) return 1;
  return 0;
}

export interface HarvestResult {
  /** Whether the crop was actually harvested (false when not ready or unknown). */
  harvested: boolean;
  /** The resulting planting state: null when the crop is consumed, fresh when it regrows. */
  next: Planting | null;
  produceItemId: string;
  quality: 0 | 1 | 2 | 3;
}

export function harvest(crop: Crop, planting: Planting, seedExtra = 0): HarvestResult {
  if (!isHarvestReady(crop, planting)) {
    return { harvested: false, next: planting, produceItemId: crop.produceItemId, quality: 0 };
  }
  const quality = rollQuality(planting.cropId, planting.daysGrown, planting.watered, seedExtra);
  if (crop.regrowDays === null) {
    return { harvested: true, next: null, produceItemId: crop.produceItemId, quality };
  }
  return {
    harvested: true,
    next: { cropId: planting.cropId, daysGrown: 0, watered: false, harvests: planting.harvests + 1 },
    produceItemId: crop.produceItemId,
    quality,
  };
}

export function buildCropIndex(crops: readonly Crop[]): ReadonlyMap<string, Crop> {
  return new Map(crops.map((c) => [c.id, c] as const));
}
