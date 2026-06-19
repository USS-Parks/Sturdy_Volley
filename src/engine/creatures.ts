/**
 * Cave creatures, AI roles, and difficulty (Prompt 026). Pure.
 * Original Sturdy-Coast cave fauna — non-gory, mostly skitterers,
 * sluggish stone-grubs, and watchful gallery moths — with four AI
 * roles (patrol / chase / retreat / swarm) and a per-depth + per-
 * combat-skill difficulty curve.
 *
 * Difficulty scaling:
 *   damage = baseDamage * (1 + depth * 0.08) * difficultyMod
 *   hp     = baseHp     * (1 + depth * 0.10) * difficultyMod
 *   speed  = baseSpeed  * (1 + depth * 0.04)
 *
 * difficultyMod is 1 by default, 0.7 when assistMode is on, and is
 * dampened a touch by the player's combat skill so high-Combat
 * players see slightly easier creatures (the engine surfaces the
 * dial as `combatSkill ∈ 0..1`).
 */
export type CreatureKindId = 'cave-skitter' | 'stone-grub' | 'gallery-moth' | 'shale-roller';

export type AiRole = 'patrol' | 'chase' | 'retreat' | 'swarm';

export interface CreatureKindDef {
  id: CreatureKindId;
  name: string;
  description: string;
  baseHp: number;
  baseDamage: number;
  baseSpeed: number; // world units / second
  role: AiRole;
  /** Loot table id (kept simple for Prompt 026 — see `creatureLoot` below). */
  loot: 'minerals' | 'fragments' | 'silk';
}

export const CREATURE_KINDS: Record<CreatureKindId, CreatureKindDef> = {
  'cave-skitter': {
    id: 'cave-skitter',
    name: 'Cave Skitter',
    description: 'A six-legged scuttler that swarms in narrow halls.',
    baseHp: 8,
    baseDamage: 4,
    baseSpeed: 1.6,
    role: 'swarm',
    loot: 'fragments',
  },
  'stone-grub': {
    id: 'stone-grub',
    name: 'Stone Grub',
    description: 'A slow, armored grub that chews tunnels.',
    baseHp: 18,
    baseDamage: 6,
    baseSpeed: 0.5,
    role: 'patrol',
    loot: 'minerals',
  },
  'gallery-moth': {
    id: 'gallery-moth',
    name: 'Gallery Moth',
    description: 'A pale fluttering moth that retreats when struck.',
    baseHp: 6,
    baseDamage: 3,
    baseSpeed: 2.2,
    role: 'retreat',
    loot: 'silk',
  },
  'shale-roller': {
    id: 'shale-roller',
    name: 'Shale Roller',
    description: 'A rolling stone creature that chases the lantern light.',
    baseHp: 14,
    baseDamage: 7,
    baseSpeed: 1.2,
    role: 'chase',
    loot: 'minerals',
  },
};

export interface DifficultyInput {
  depth: number; // 0..19
  combatSkill: number; // 0..1
  assist: boolean;
}

export interface ScaledStats {
  hp: number;
  damage: number;
  speed: number;
}

export function scaleStats(kind: CreatureKindDef, input: DifficultyInput): ScaledStats {
  const mod = input.assist ? 0.7 : 1 - input.combatSkill * 0.15;
  const hp = Math.round(kind.baseHp * (1 + input.depth * 0.1) * mod);
  const damage = Math.round(kind.baseDamage * (1 + input.depth * 0.08) * mod);
  const speed = kind.baseSpeed * (1 + input.depth * 0.04);
  return { hp: Math.max(1, hp), damage: Math.max(1, damage), speed };
}

/* AI step --------------------------------------------------------- */

export interface AiState {
  /** Live position. */
  x: number;
  z: number;
  /** Direction the creature is currently moving. */
  vx: number;
  vz: number;
  /** Role-keyed sub-state. */
  patrolAnchor?: { x: number; z: number };
  patrolDirection?: 1 | -1;
  /** Set when the creature last took a hit so retreats know which way to flee. */
  lastHitFromX?: number;
  lastHitFromZ?: number;
}

export interface AiStepInput {
  state: AiState;
  role: AiRole;
  speed: number;
  /** Player position used for chase + retreat. */
  playerX: number;
  playerZ: number;
  /** dt seconds. */
  dt: number;
  /** Seed for the wander noise. */
  seed: number;
  /** Distance under which 'swarm' creatures cluster on the player. */
  swarmAggro?: number;
}

function pseudoFloat(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** A small, deterministic AI step. Pure — renderer just paints what comes back. */
export function stepAi(input: AiStepInput): AiState {
  let { x, z, vx, vz, patrolAnchor, patrolDirection } = input.state;
  const dx = input.playerX - x;
  const dz = input.playerZ - z;
  const dist = Math.hypot(dx, dz);
  const inv = 1 / Math.max(0.0001, dist);

  if (input.role === 'patrol') {
    // Pick a stable patrol anchor on first tick.
    if (!patrolAnchor) patrolAnchor = { x, z };
    if (!patrolDirection) patrolDirection = 1;
    const sweepRadius = 3;
    // Move along z-axis sinusoidally around the anchor.
    const t = pseudoFloat(input.seed) * Math.PI * 2;
    vx = Math.cos(t) * 0.3;
    vz = Math.sin(t) * 0.3;
    x = patrolAnchor.x + Math.cos(t) * sweepRadius;
    z = patrolAnchor.z + Math.sin(t) * sweepRadius;
  } else if (input.role === 'chase') {
    if (dist < 0.4) {
      vx = 0;
      vz = 0;
    } else {
      vx = dx * inv;
      vz = dz * inv;
      x += vx * input.speed * input.dt;
      z += vz * input.speed * input.dt;
    }
  } else if (input.role === 'retreat') {
    // Move away from the player when within 4m.
    if (dist < 4) {
      vx = -dx * inv;
      vz = -dz * inv;
      x += vx * input.speed * input.dt;
      z += vz * input.speed * input.dt;
    } else {
      // Idle drift.
      const t = pseudoFloat(input.seed);
      vx = (t - 0.5) * 0.4;
      vz = (pseudoFloat(input.seed + 1) - 0.5) * 0.4;
    }
  } else {
    // swarm: cluster on player if within aggro range, otherwise loose drift.
    const aggro = input.swarmAggro ?? 5;
    if (dist < aggro && dist > 0.4) {
      vx = dx * inv;
      vz = dz * inv;
      x += vx * input.speed * 0.85 * input.dt;
      z += vz * input.speed * 0.85 * input.dt;
    } else {
      const t = pseudoFloat(input.seed);
      vx = (t - 0.5) * 0.4;
      vz = (pseudoFloat(input.seed + 17) - 0.5) * 0.4;
      x += vx * input.speed * 0.4 * input.dt;
      z += vz * input.speed * 0.4 * input.dt;
    }
  }
  return { ...input.state, x, z, vx, vz, patrolAnchor, patrolDirection };
}

/* Per-kind loot tables ------------------------------------------- */

export const LOOT_TABLES = {
  minerals: [
    { itemId: 'iron-ore', weight: 30 },
    { itemId: 'gravel', weight: 50 },
    { itemId: 'silver-vein', weight: 15 },
    { itemId: 'sun-amber', weight: 5 },
  ],
  fragments: [
    { itemId: 'coral-fragment', weight: 30 },
    { itemId: 'gravel', weight: 50 },
    { itemId: 'pearl-shard', weight: 20 },
  ],
  silk: [
    { itemId: 'gravel', weight: 60 },
    { itemId: 'sea-lettuce', weight: 25 },
    { itemId: 'lampstone', weight: 15 },
  ],
} as const;

export function rollCreatureLoot(kind: CreatureKindDef, seed: number): string {
  const table = LOOT_TABLES[kind.loot];
  const total = table.reduce((s, r) => s + r.weight, 0);
  const r = pseudoFloat(seed) * total;
  let acc = 0;
  for (const row of table) {
    acc += row.weight;
    if (r <= acc) return row.itemId;
  }
  return table[table.length - 1]!.itemId;
}

/** Pick the creature kinds appropriate for a depth band. */
export function kindsForDepth(depth: number): CreatureKindId[] {
  if (depth <= 4) return ['cave-skitter', 'stone-grub'];
  if (depth <= 9) return ['cave-skitter', 'stone-grub', 'gallery-moth'];
  if (depth <= 14) return ['stone-grub', 'gallery-moth', 'shale-roller'];
  return ['shale-roller', 'gallery-moth'];
}
