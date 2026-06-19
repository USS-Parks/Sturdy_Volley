import type { Season } from '../data/schemas';

/**
 * Forage + debris + tree regrowth (Prompt 010). Pure. The world spawns
 * seasonal forage in valid map regions overnight, trees regrow on a deterministic
 * timer, and chopped stumps come back after a few days. Renderer reads the
 * resulting `WorldEntity` map; gameplay mutates via the helpers.
 */
export type EntityKind = 'forage' | 'tree' | 'stump' | 'grass' | 'debris';

export interface WorldEntity {
  kind: EntityKind;
  /** What item the player gets when they collect / chop / break this. */
  itemId: string | null;
  /** Days since spawn (or since last state change for stumps). */
  age: number;
  /** Optional metadata: region key, quality bias, etc. */
  meta?: Record<string, number | string>;
}

export type EntityMap = Record<string, WorldEntity>;

export const TREE_REGROW_DAYS = 5;
export const FORAGE_SPAWN_CHANCE = 0.35;
export const GRASS_SPREAD_CHANCE = 0.2;

export interface RegionForageTable {
  region: string;
  /** Seasonal forage item pool. */
  items: Partial<Record<Season, readonly string[]>>;
  /** Map cell keys (e.g. "Beach:4,3") that are valid spawn slots. */
  cellKeys: readonly string[];
}

export interface AdvanceWorldInput {
  entities: EntityMap;
  newSeason: Season;
  tables: readonly RegionForageTable[];
  /** Random seed; pass a per-day deterministic value for reproducibility. */
  seed: number;
}

export interface AdvanceWorldResult {
  entities: EntityMap;
  spawned: number;
  regrew: number;
  grassSpread: number;
}

function rng(seed: number): () => number {
  // Mulberry32 — same shape used in soil.ts / weather.ts.
  let state = (seed | 0) ^ 0xa3c59ac3;
  return () => {
    let t = (state + 0x6d2b79f5) | 0;
    state = t;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One day's worth of world mutation: spawn forage in empty valid cells, regrow
 * trees from stumps after `TREE_REGROW_DAYS`, spread grass to adjacent empty
 * cells (capped by `GRASS_SPREAD_CHANCE` per cell).
 */
export function advanceWorld(input: AdvanceWorldInput): AdvanceWorldResult {
  const out: EntityMap = { ...input.entities };
  const rand = rng(input.seed);
  let spawned = 0;
  let regrew = 0;
  let grassSpread = 0;

  // 1. Regrow stumps into trees once they hit TREE_REGROW_DAYS.
  for (const [key, e] of Object.entries(out)) {
    if (e.kind === 'stump' && e.age + 1 >= TREE_REGROW_DAYS) {
      out[key] = { kind: 'tree', itemId: 'driftwood', age: 0 };
      regrew += 1;
    } else {
      out[key] = { ...e, age: e.age + 1 };
    }
  }

  // 2. Spawn seasonal forage in empty cells, weighted by FORAGE_SPAWN_CHANCE.
  for (const table of input.tables) {
    const pool = table.items[input.newSeason] ?? [];
    if (pool.length === 0) continue;
    for (const cellKey of table.cellKeys) {
      if (out[cellKey]) continue; // occupied
      if (rand() < FORAGE_SPAWN_CHANCE) {
        const pick = pool[Math.floor(rand() * pool.length)] ?? pool[0]!;
        out[cellKey] = { kind: 'forage', itemId: pick, age: 0, meta: { region: table.region } };
        spawned += 1;
      }
    }
  }

  // 3. Spread grass: every grass cell has a small chance to seed a neighbor.
  for (const [key, e] of Object.entries(out)) {
    if (e.kind !== 'grass') continue;
    if (rand() >= GRASS_SPREAD_CHANCE) continue;
    const neighbor = pickNeighbor(key, rand);
    if (!neighbor) continue;
    if (out[neighbor]) continue;
    out[neighbor] = { kind: 'grass', itemId: 'driftwood', age: 0 };
    grassSpread += 1;
  }

  return { entities: out, spawned, regrew, grassSpread };
}

function pickNeighbor(key: string, rand: () => number): string | null {
  const [scene, coord] = key.split(':');
  if (!scene || !coord) return null;
  const [c, r] = coord.split(',').map(Number);
  if (!Number.isFinite(c) || !Number.isFinite(r)) return null;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  const pick = dirs[Math.floor(rand() * dirs.length)] ?? dirs[0];
  return `${scene}:${(c as number) + pick[0]},${(r as number) + pick[1]}`;
}

/** Collect / chop / break an entity. Returns the resulting state and reward. */
export interface CollectResult {
  next: WorldEntity | null;
  reward: { itemId: string; qty: number } | null;
}

export function collect(entity: WorldEntity, toolHardness: number = 1): CollectResult {
  switch (entity.kind) {
    case 'forage':
    case 'grass':
      return {
        next: null,
        reward: entity.itemId ? { itemId: entity.itemId, qty: 1 } : null,
      };
    case 'debris':
      if (toolHardness < 1) return { next: entity, reward: null };
      return {
        next: null,
        reward: entity.itemId ? { itemId: entity.itemId, qty: 1 } : null,
      };
    case 'tree':
      if (toolHardness < 2) return { next: entity, reward: null };
      return {
        next: { kind: 'stump', itemId: 'driftwood', age: 0 },
        reward: { itemId: entity.itemId ?? 'driftwood', qty: 3 },
      };
    case 'stump':
      if (toolHardness < 1) return { next: entity, reward: null };
      return { next: null, reward: { itemId: 'driftwood', qty: 1 } };
  }
}

/** Quality bias: foraging skill nudges higher quality rolls. */
export function forageQualityRoll(seed: number, foragingSkill: number): 0 | 1 | 2 | 3 {
  let t = (seed + foragingSkill * 17 + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const roll = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  const bias = Math.min(0.3, foragingSkill * 0.02); // up to +30% gold-and-up at skill 15
  if (roll + bias > 0.94) return 3;
  if (roll + bias > 0.8) return 2;
  if (roll + bias > 0.55) return 1;
  return 0;
}
