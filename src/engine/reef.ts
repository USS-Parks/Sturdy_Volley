import type { Season } from '../data/schemas';

/**
 * Low-tide reef + snorkeling (Prompt 022). Pure. The reef is a small
 * area immediately offshore of Driftwood Beach that becomes walkable
 * (and snorkelable beyond the tide pools) during low + falling tides
 * in good weather. An `OxygenMeter` tracks the player's breath under
 * water; surfacing refills it. Reef restoration accumulates
 * across days as the player donates `coral-fragment`s to the coral
 * nursery, raising `health: 0..1.0` which the renderer uses to swap
 * dead-vs-vibrant materials on the reef meshes.
 */
export type ReefAccess = 'open' | 'closed' | 'wading';

export function reefAccess(
  tide: 'low' | 'rising' | 'high' | 'falling',
  weatherId: string | null,
): ReefAccess {
  if (weatherId === 'windstorm') return 'closed';
  if (tide === 'high' || tide === 'rising') return 'closed';
  if (tide === 'falling') return 'wading';
  return 'open';
}

export interface OxygenState {
  /** 0..max. */
  value: number;
  max: number;
  /** Hint for the renderer to show a "low oxygen" warning at <30%. */
  warning: boolean;
}

export const DEFAULT_OXYGEN_MAX = 60; // seconds

export function createOxygen(max: number = DEFAULT_OXYGEN_MAX): OxygenState {
  return { value: max, max, warning: false };
}

export interface OxygenTickInput {
  state: OxygenState;
  submerged: boolean;
  dt: number;
}

export function tickOxygen(input: OxygenTickInput): OxygenState {
  const drainRate = 1; // 1 second of oxygen per real second underwater
  const refillRate = 4; // surface gulps back fast
  const value = input.submerged
    ? Math.max(0, input.state.value - drainRate * input.dt)
    : Math.min(input.state.max, input.state.value + refillRate * input.dt);
  return { ...input.state, value, warning: value < input.state.max * 0.3 };
}

/* Reef restoration ------------------------------------------------ */

export interface ReefHealth {
  /** 0..1 — drives material swap. */
  health: number;
  /** Total coral-fragment donations to date. */
  fragmentsDonated: number;
  /** Stages cleared (each 0.25 health = one bigger restoration tier). */
  tier: 0 | 1 | 2 | 3 | 4;
}

export function createReef(): ReefHealth {
  return { health: 0, fragmentsDonated: 0, tier: 0 };
}

const FRAGMENTS_PER_TIER = 8;

export function donateFragments(reef: { fragmentsDonated: number; tier: number; health: number }, qty: number): ReefHealth {
  const fragmentsDonated = reef.fragmentsDonated + qty;
  const tier = Math.min(4, Math.floor(fragmentsDonated / FRAGMENTS_PER_TIER)) as ReefHealth['tier'];
  const health = Math.min(1, tier / 4);
  return { fragmentsDonated, tier, health };
}

/* Reef crops + sea life loot tables ------------------------------- */

export interface ReefForageEntry {
  itemId: string;
  weight: number;
  seasons?: readonly Season[];
}

export const REEF_CROPS: readonly ReefForageEntry[] = [
  { itemId: 'sea-lettuce', weight: 28 },
  { itemId: 'coral-fragment', weight: 18 },
  { itemId: 'tide-shell', weight: 22 },
  { itemId: 'pearl-shard', weight: 4 },
  { itemId: 'urchin', weight: 12 },
  { itemId: 'kelp-perch', weight: 8, seasons: ['spring', 'fall'] },
  { itemId: 'reef-snapper', weight: 8, seasons: ['summer', 'fall'] },
];

export function reefSeasonalRoll(season: Season, seed: number): string {
  const valid = REEF_CROPS.filter((e) => !e.seasons || e.seasons.includes(season));
  const total = valid.reduce((s, e) => s + e.weight, 0);
  const r = pseudoFloat(seed) * total;
  let acc = 0;
  for (const entry of valid) {
    acc += entry.weight;
    if (r <= acc) return entry.itemId;
  }
  return valid[valid.length - 1]!.itemId;
}

function pseudoFloat(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Harmless sea-life encounter pool — anemones, sea stars, etc. */
export const REEF_SEA_LIFE = [
  { id: 'sea-star', label: 'A bright orange sea star clings to a rock.' },
  { id: 'tide-anemone', label: 'A teal anemone waves gently in the surf.' },
  { id: 'hermit-crab', label: 'A hermit crab scuttles across your shadow.' },
  { id: 'reef-gobies', label: 'A trio of reef gobies darts past your mask.' },
] as const;
