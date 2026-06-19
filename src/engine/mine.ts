/**
 * Mining + cave exploration (Prompt 023). Pure. Two named systems —
 * **Ironroot Quarry** (levels 0–9) and **Rainhall Caverns** (levels
 * 10–19) — share a single level table. Each level defines the ore
 * mix, hazard density, lighting tier, and whether a checkpoint
 * ladder is reachable from it. Pickaxe hardness gates which nodes
 * the player can break.
 *
 * The engine is renderer-agnostic; the MineScene builds graybox
 * geometry per level and routes click → `mineNode(...)` events.
 */
export type MineSystem = 'ironroot' | 'rainhall';
export type OreId =
  | 'gravel'
  | 'tin-vein'
  | 'iron-ore'
  | 'salt-crystal'
  | 'silver-vein'
  | 'lampstone'
  | 'cold-iron'
  | 'sun-amber';

export interface OreDef {
  id: OreId;
  name: string;
  /** Pickaxe level required (0..3). */
  hardness: number;
  sellPrice: number;
}

export const ORE_DEFS: Record<OreId, OreDef> = {
  gravel: { id: 'gravel', name: 'Gravel', hardness: 0, sellPrice: 4 },
  'tin-vein': { id: 'tin-vein', name: 'Tin Vein', hardness: 0, sellPrice: 22 },
  'iron-ore': { id: 'iron-ore', name: 'Iron Ore', hardness: 1, sellPrice: 60 },
  'salt-crystal': { id: 'salt-crystal', name: 'Salt Crystal', hardness: 0, sellPrice: 28 },
  'silver-vein': { id: 'silver-vein', name: 'Silver Vein', hardness: 2, sellPrice: 120 },
  lampstone: { id: 'lampstone', name: 'Lampstone', hardness: 1, sellPrice: 75 },
  'cold-iron': { id: 'cold-iron', name: 'Cold Iron', hardness: 2, sellPrice: 180 },
  'sun-amber': { id: 'sun-amber', name: 'Sun Amber', hardness: 3, sellPrice: 320 },
};

export interface MineLevelDef {
  index: number; // 0..19
  system: MineSystem;
  name: string;
  /** 0 (bright) .. 4 (pitch black) — informs ambient + fog density. */
  lighting: number;
  /** Average ore nodes per room. */
  oreDensity: number;
  /** Weighted ore mix for this level. */
  oreMix: ReadonlyArray<{ ore: OreId; weight: number }>;
  /** 0..1 hazard chance per tile (loose rock, pit, drip). */
  hazardDensity: number;
  /** True when this level has a checkpoint ladder back to the surface. */
  checkpoint: boolean;
  /** Light creature density (0..1). */
  creatureDensity: number;
  /** Stamina cost per swing on this level (deeper = more tiring). */
  swingStaminaCost: number;
}

function ironroot(index: number, name: string, opts: Partial<MineLevelDef> = {}): MineLevelDef {
  return {
    index,
    system: 'ironroot',
    name,
    lighting: opts.lighting ?? Math.min(2, Math.floor(index / 3)),
    oreDensity: opts.oreDensity ?? 6,
    oreMix: opts.oreMix ?? [
      { ore: 'gravel', weight: 40 },
      { ore: 'tin-vein', weight: 30 },
      { ore: 'iron-ore', weight: 18 },
      { ore: 'silver-vein', weight: 6 },
      { ore: 'salt-crystal', weight: 12 },
    ],
    hazardDensity: opts.hazardDensity ?? 0.1 + index * 0.015,
    checkpoint: opts.checkpoint ?? index % 3 === 0,
    creatureDensity: opts.creatureDensity ?? 0.1 + index * 0.02,
    swingStaminaCost: opts.swingStaminaCost ?? 2 + Math.floor(index / 4),
  };
}

function rainhall(index: number, name: string, opts: Partial<MineLevelDef> = {}): MineLevelDef {
  return {
    index,
    system: 'rainhall',
    name,
    lighting: opts.lighting ?? Math.min(4, 2 + Math.floor((index - 10) / 3)),
    oreDensity: opts.oreDensity ?? 5,
    oreMix: opts.oreMix ?? [
      { ore: 'iron-ore', weight: 22 },
      { ore: 'silver-vein', weight: 16 },
      { ore: 'lampstone', weight: 18 },
      { ore: 'cold-iron', weight: 12 },
      { ore: 'sun-amber', weight: 6 },
      { ore: 'gravel', weight: 26 },
    ],
    hazardDensity: opts.hazardDensity ?? 0.2 + (index - 10) * 0.02,
    checkpoint: opts.checkpoint ?? (index - 10) % 3 === 0,
    creatureDensity: opts.creatureDensity ?? 0.25 + (index - 10) * 0.025,
    swingStaminaCost: opts.swingStaminaCost ?? 3 + Math.floor((index - 10) / 3),
  };
}

export const MINE_LEVELS: readonly MineLevelDef[] = [
  ironroot(0, 'Quarry mouth'),
  ironroot(1, 'Hammer hall'),
  ironroot(2, 'Tin gallery'),
  ironroot(3, 'Salt seam', { checkpoint: true }),
  ironroot(4, 'Iron shoulder'),
  ironroot(5, 'Silver step'),
  ironroot(6, 'Echo bend', { checkpoint: true }),
  ironroot(7, 'Bridge of rust'),
  ironroot(8, 'Old siphon'),
  ironroot(9, 'Lampstone door', { checkpoint: true, lighting: 3 }),
  rainhall(10, 'Rainhall foyer'),
  rainhall(11, 'Drip chapel'),
  rainhall(12, 'Lampstone cathedral', { checkpoint: true }),
  rainhall(13, 'Bone passage'),
  rainhall(14, 'Cold iron vault'),
  rainhall(15, 'Mirror lake', { checkpoint: true }),
  rainhall(16, 'Glassgrass bend'),
  rainhall(17, 'Sun amber atrium'),
  rainhall(18, 'Rainhall throat'),
  rainhall(19, 'Heartrock', { checkpoint: true, lighting: 4 }),
];

export const TOTAL_MINE_LEVELS = MINE_LEVELS.length;

export function levelAt(index: number): MineLevelDef | null {
  return MINE_LEVELS[index] ?? null;
}

/* Mining ore nodes ------------------------------------------------ */

export interface OreNode {
  id: string;
  ore: OreId;
  /** Tile coordinates inside the current room. */
  x: number;
  z: number;
}

function pseudoFloat(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function rollOreNodes(level: MineLevelDef, seed: number): OreNode[] {
  const out: OreNode[] = [];
  for (let i = 0; i < level.oreDensity; i++) {
    const r = pseudoFloat(seed + i) * level.oreMix.reduce((s, m) => s + m.weight, 0);
    let acc = 0;
    let pick: OreId = 'gravel';
    for (const m of level.oreMix) {
      acc += m.weight;
      if (r <= acc) {
        pick = m.ore;
        break;
      }
    }
    out.push({
      id: `node-${level.index}-${i}`,
      ore: pick,
      x: Math.round(pseudoFloat(seed + i * 7) * 18) - 9,
      z: Math.round(pseudoFloat(seed + i * 11) * 18) - 9,
    });
  }
  return out;
}

export interface MineSwingInput {
  node: OreNode;
  pickaxeLevel: 0 | 1 | 2 | 3;
  staminaCost: number;
  currentStamina: number;
}

export interface MineSwingResult {
  /** True if the swing broke the node. */
  broke: boolean;
  /** Resolved drop when broken. */
  drop?: { itemId: string; qty: number; quality: number };
  /** Updated stamina after the swing (or unchanged if not swung). */
  stamina: number;
  /** Reason for refusal. */
  reason?: 'too-soft' | 'no-stamina';
}

export function mineNode(input: MineSwingInput): MineSwingResult {
  const def = ORE_DEFS[input.node.ore];
  if (input.pickaxeLevel < def.hardness) {
    return { broke: false, stamina: input.currentStamina, reason: 'too-soft' };
  }
  if (input.currentStamina < input.staminaCost) {
    return { broke: false, stamina: input.currentStamina, reason: 'no-stamina' };
  }
  return {
    broke: true,
    drop: { itemId: def.id, qty: 1, quality: 0 },
    stamina: input.currentStamina - input.staminaCost,
  };
}

/* Player health (light) ------------------------------------------ */

export const DEFAULT_MINE_HP_MAX = 60;

export interface MineHealthState {
  hp: number;
  max: number;
}

export function createMineHealth(max: number = DEFAULT_MINE_HP_MAX): MineHealthState {
  return { hp: max, max };
}

export function hurtPlayer(state: MineHealthState, damage: number): MineHealthState {
  return { ...state, hp: Math.max(0, state.hp - damage) };
}

export function healPlayer(state: MineHealthState, amount: number): MineHealthState {
  return { ...state, hp: Math.min(state.max, state.hp + amount) };
}

/* Checkpoints + progress ----------------------------------------- */

export interface MineProgress {
  deepestLevel: number;
  currentLevel: number;
  /** Levels with cleared checkpoints, sorted ascending. */
  checkpoints: number[];
}

export function createMineProgress(): MineProgress {
  return { deepestLevel: 0, currentLevel: 0, checkpoints: [] };
}

export function descend(progress: MineProgress): MineProgress {
  const next = Math.min(TOTAL_MINE_LEVELS - 1, progress.currentLevel + 1);
  return {
    ...progress,
    currentLevel: next,
    deepestLevel: Math.max(progress.deepestLevel, next),
  };
}

export function ascend(progress: MineProgress): MineProgress {
  return { ...progress, currentLevel: Math.max(0, progress.currentLevel - 1) };
}

export function jumpToCheckpoint(progress: MineProgress, level: number): MineProgress {
  if (!progress.checkpoints.includes(level)) return progress;
  return { ...progress, currentLevel: level };
}

export function recordCheckpoint(progress: MineProgress, level: number): MineProgress {
  if (progress.checkpoints.includes(level)) return progress;
  const checkpoints = [...progress.checkpoints, level].sort((a, b) => a - b);
  return { ...progress, checkpoints };
}
