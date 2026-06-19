import { absoluteDay, type GameTime } from './timeSystem';
import type { Weather } from '../data/schemas';

/**
 * Per-day weather forecast. Deterministic from the absolute day index and the
 * available weather pool. Spring/Fall lean toward rain; Summer toward sunny
 * with rare windstorms; Winter toward fog/snowy ambience (using whatever ids
 * the content pack provides). The seed is shared with the tide schedule so
 * "stormy weather happens at low tide" can be authored later without RNG.
 */
const SUN_RAIN_FOG_WIND: Array<readonly [string, number]> = [
  ['sunny', 5],
  ['rain', 3],
  ['sea-fog', 1],
  ['windstorm', 1],
];

const SEASON_WEIGHTS: Record<string, Array<readonly [string, number]>> = {
  spring: [
    ['sunny', 4],
    ['rain', 4],
    ['sea-fog', 1],
    ['windstorm', 1],
  ],
  summer: [
    ['sunny', 7],
    ['rain', 1],
    ['sea-fog', 1],
    ['windstorm', 1],
  ],
  fall: [
    ['sunny', 3],
    ['rain', 4],
    ['sea-fog', 2],
    ['windstorm', 2],
  ],
  winter: [
    ['sunny', 3],
    ['rain', 1],
    ['sea-fog', 4],
    ['windstorm', 3],
  ],
};

function rngFromSeed(seed: number): number {
  // Mulberry32 — deterministic, dependency-free, plenty for daily weather.
  let t = (seed | 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function pickWeighted(
  weights: Array<readonly [string, number]>,
  pool: readonly Weather[],
  roll: number,
): Weather {
  const ids = new Set(pool.map((w) => w.id));
  const valid = weights.filter(([id]) => ids.has(id));
  const list = valid.length > 0 ? valid : SUN_RAIN_FOG_WIND.filter(([id]) => ids.has(id));
  if (list.length === 0) return pool[0]!;
  const total = list.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = roll * total;
  for (const [id, weight] of list) {
    cursor -= weight;
    if (cursor <= 0) {
      return pool.find((w) => w.id === id) ?? pool[0]!;
    }
  }
  return pool.find((w) => w.id === list[list.length - 1]![0]) ?? pool[0]!;
}

/** Deterministic weather for the given day. Returns null if the pool is empty. */
export function forecastFor(time: GameTime, pool: readonly Weather[]): Weather | null {
  if (pool.length === 0) return null;
  const weights = SEASON_WEIGHTS[time.season] ?? SUN_RAIN_FOG_WIND;
  const roll = rngFromSeed(absoluteDay(time) * 9176 + time.season.length * 31);
  return pickWeighted(weights, pool, roll);
}
