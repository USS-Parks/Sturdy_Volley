/**
 * Mine depth + elevator + boss chamber (Prompt 025). Pure. Sits on
 * top of Prompt 023's `mine.ts`:
 *
 * - **Room kits** — small authored layout templates that the level
 *   loader stamps procedurally per level, deterministic from a seed.
 * - **Elevator** — a lift that fast-travels between recorded
 *   checkpoints. Pure state machine surfaced through `elevatorOptions`
 *   so the renderer can render a Stardew-style floor-selector list.
 * - **Lantern** — light-as-resource. Lanterns hold a finite supply
 *   that drains while the player is in dim levels (`lighting ≥ 3`).
 *   The renderer dims ambient when supply hits zero.
 * - **Boss chamber** — fixed L19 pattern. The boss telegraphs in a
 *   slow / mid / fast cadence. Pure `tickBossPattern` advances the
 *   pattern and emits a `'strike'` flag every cycle.
 */
export type RoomKitId = 'quarry-cell' | 'ironroot-gallery' | 'rainhall-corridor' | 'cold-iron-vault' | 'heartrock-chamber';

export interface RoomKit {
  id: RoomKitId;
  /** Render-side label. */
  name: string;
  /** Number of ore spawn anchors the kit exposes. */
  oreSlots: number;
  /** Hazard anchors. */
  hazardSlots: number;
  /** Creature spawn anchors. */
  creatureSlots: number;
}

export const ROOM_KITS: Record<RoomKitId, RoomKit> = {
  'quarry-cell': { id: 'quarry-cell', name: 'Quarry Cell', oreSlots: 6, hazardSlots: 1, creatureSlots: 0 },
  'ironroot-gallery': { id: 'ironroot-gallery', name: 'Ironroot Gallery', oreSlots: 7, hazardSlots: 2, creatureSlots: 1 },
  'rainhall-corridor': { id: 'rainhall-corridor', name: 'Rainhall Corridor', oreSlots: 5, hazardSlots: 3, creatureSlots: 2 },
  'cold-iron-vault': { id: 'cold-iron-vault', name: 'Cold Iron Vault', oreSlots: 4, hazardSlots: 2, creatureSlots: 3 },
  'heartrock-chamber': { id: 'heartrock-chamber', name: 'Heartrock Chamber', oreSlots: 0, hazardSlots: 4, creatureSlots: 0 },
};

function pseudoFloat(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Deterministic kit pick keyed off level + save seed. */
export function pickKitForLevel(levelIndex: number, saveSeed: number): RoomKit {
  if (levelIndex === 19) return ROOM_KITS['heartrock-chamber'];
  const candidates: RoomKitId[] = levelIndex < 10
    ? ['quarry-cell', 'ironroot-gallery']
    : ['rainhall-corridor', 'cold-iron-vault'];
  const idx = Math.floor(pseudoFloat(saveSeed * 13 + levelIndex * 7) * candidates.length);
  return ROOM_KITS[candidates[idx]!];
}

/* Elevator ------------------------------------------------------- */

export interface ElevatorOption {
  level: number;
  name: string;
  isCurrent: boolean;
}

export function elevatorOptions(args: {
  checkpoints: readonly number[];
  currentLevel: number;
  levelName: (level: number) => string;
}): ElevatorOption[] {
  return [...args.checkpoints]
    .sort((a, b) => a - b)
    .map((level) => ({
      level,
      name: args.levelName(level),
      isCurrent: level === args.currentLevel,
    }));
}

/* Lantern -------------------------------------------------------- */

export const DEFAULT_LANTERN_FUEL = 600; // seconds of in-mine usage

export interface LanternState {
  fuel: number;
  max: number;
}

export function createLantern(max: number = DEFAULT_LANTERN_FUEL): LanternState {
  return { fuel: max, max };
}

export interface LanternTickInput {
  state: LanternState;
  /** Lighting tier of the current level (0..4). */
  lighting: number;
  dt: number;
}

export function tickLantern(input: LanternTickInput): LanternState {
  if (input.lighting < 3) return input.state;
  const fuel = Math.max(0, input.state.fuel - input.dt);
  return { ...input.state, fuel };
}

export function refillLantern(state: LanternState, qty: number): LanternState {
  return { ...state, fuel: Math.min(state.max, state.fuel + qty) };
}

/* Boss pattern --------------------------------------------------- */

export interface BossPattern {
  /** 0..2 — slow/mid/fast cadence. */
  cadence: 0 | 1 | 2;
  /** Seconds remaining in the current step. */
  stepTime: number;
  /** Bookkeeping for the renderer's telegraph ring. */
  phase: 'idle' | 'windup' | 'strike' | 'recover';
  /** Boss HP. */
  hp: number;
  maxHp: number;
}

const BOSS_TIMINGS: Record<BossPattern['phase'], number[]> = {
  // Slow / mid / fast.
  idle: [2.0, 1.4, 0.9],
  windup: [1.2, 0.9, 0.6],
  strike: [0.4, 0.3, 0.22],
  recover: [1.0, 0.8, 0.6],
};

export function createBoss(maxHp: number = 90): BossPattern {
  return { cadence: 0, stepTime: BOSS_TIMINGS.idle[0]!, phase: 'idle', hp: maxHp, maxHp };
}

export interface BossTickResult {
  state: BossPattern;
  /** True on the tick a strike resolves. */
  striking: boolean;
}

export function tickBossPattern(boss: BossPattern, dt: number): BossTickResult {
  let { phase, stepTime, cadence } = boss;
  stepTime -= dt;
  let striking = false;
  if (stepTime <= 0) {
    if (phase === 'idle') {
      phase = 'windup';
      stepTime = BOSS_TIMINGS.windup[cadence]!;
    } else if (phase === 'windup') {
      phase = 'strike';
      stepTime = BOSS_TIMINGS.strike[cadence]!;
      striking = true;
    } else if (phase === 'strike') {
      phase = 'recover';
      stepTime = BOSS_TIMINGS.recover[cadence]!;
    } else {
      phase = 'idle';
      stepTime = BOSS_TIMINGS.idle[cadence]!;
      // Speed up at < 50% / < 25% HP.
      if (boss.hp <= boss.maxHp * 0.25) cadence = 2;
      else if (boss.hp <= boss.maxHp * 0.5) cadence = 1;
    }
  }
  return { state: { ...boss, phase, stepTime, cadence }, striking };
}

export function damageBoss(boss: BossPattern, dmg: number): BossPattern {
  return { ...boss, hp: Math.max(0, boss.hp - dmg) };
}

/* Deterministic ore-node positions from a seed --------------------*/

export interface RoomLayout {
  kit: RoomKit;
  oreAnchors: Array<{ x: number; z: number }>;
  hazardAnchors: Array<{ x: number; z: number }>;
  creatureAnchors: Array<{ x: number; z: number }>;
}

export function buildRoomLayout(level: number, saveSeed: number): RoomLayout {
  const kit = pickKitForLevel(level, saveSeed);
  const anchor = (slot: number, kind: number) => {
    const a = pseudoFloat(saveSeed + level * 31 + slot * 7 + kind) * 18 - 9;
    const b = pseudoFloat(saveSeed + level * 31 + slot * 13 + kind * 2) * 18 - 9;
    return { x: a, z: b };
  };
  return {
    kit,
    oreAnchors: Array.from({ length: kit.oreSlots }, (_, i) => anchor(i, 1)),
    hazardAnchors: Array.from({ length: kit.hazardSlots }, (_, i) => anchor(i, 2)),
    creatureAnchors: Array.from({ length: kit.creatureSlots }, (_, i) => anchor(i, 3)),
  };
}
