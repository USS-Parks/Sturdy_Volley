/**
 * Defensive combat foundation (Prompt 024). Pure. Light-melee combat
 * built around player swings vs creature telegraphs:
 *
 * - `swingHit` resolves a player swing against a creature: hit /
 *   miss / knockback impulse + damage.
 * - `applyHitToPlayer` rolls i-frames + damage when a creature lands
 *   a strike on the player.
 * - `tickTelegraph` advances a creature's wind-up → strike → recover
 *   loop so the renderer can show the warning ring.
 *
 * Prompt 026 builds AI movement + difficulty bands on top of this;
 * Prompt 025 adds the boss chamber.
 */
export type WeaponId = 'fists' | 'driftwood-club' | 'tide-blade' | 'storm-spear';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  damage: number;
  /** Knockback impulse in world units. */
  knockback: number;
  /** Cooldown seconds between swings. */
  cooldown: number;
}

export const WEAPON_DEFS: Record<WeaponId, WeaponDef> = {
  fists: { id: 'fists', name: 'Bare hands', damage: 2, knockback: 0.2, cooldown: 0.6 },
  'driftwood-club': { id: 'driftwood-club', name: 'Driftwood Club', damage: 6, knockback: 0.6, cooldown: 0.7 },
  'tide-blade': { id: 'tide-blade', name: 'Tide Blade', damage: 10, knockback: 0.4, cooldown: 0.45 },
  'storm-spear': { id: 'storm-spear', name: 'Storm Spear', damage: 14, knockback: 0.8, cooldown: 0.9 },
};

export interface CreatureSnapshot {
  id: string;
  hp: number;
  maxHp: number;
  /** Telegraph phase: idle → windup → strike → recover. */
  phase: 'idle' | 'windup' | 'strike' | 'recover';
  /** Seconds remaining in current phase. */
  phaseTime: number;
  /** Last position used for the renderer's knockback push. */
  x: number;
  z: number;
}

export interface SwingHitInput {
  weapon: WeaponDef;
  creature: CreatureSnapshot;
  /** Player position; the swing has a 1.6m reach. */
  playerX: number;
  playerZ: number;
  /** True when the swing connects (within reach + facing creature). */
  inRange?: boolean;
}

export interface SwingHitResult {
  hit: boolean;
  damage: number;
  /** Push impulse applied to the creature. */
  pushX: number;
  pushZ: number;
  /** Updated creature state. */
  creature: CreatureSnapshot;
  /** True when the creature was downed by this swing. */
  downed: boolean;
}

const SWING_REACH = 1.6;

export function swingHit(input: SwingHitInput): SwingHitResult {
  const { weapon, creature } = input;
  const dx = creature.x - input.playerX;
  const dz = creature.z - input.playerZ;
  const dist = Math.hypot(dx, dz);
  const inRange = input.inRange ?? dist <= SWING_REACH;
  if (!inRange) {
    return { hit: false, damage: 0, pushX: 0, pushZ: 0, creature, downed: false };
  }
  const damage = weapon.damage;
  const inv = 1 / Math.max(0.0001, dist);
  const pushX = dx * inv * weapon.knockback;
  const pushZ = dz * inv * weapon.knockback;
  const next: CreatureSnapshot = {
    ...creature,
    hp: Math.max(0, creature.hp - damage),
    x: creature.x + pushX,
    z: creature.z + pushZ,
    // Hitting during windup interrupts the strike — reset to recover.
    phase: creature.phase === 'windup' ? 'recover' : creature.phase,
    phaseTime: creature.phase === 'windup' ? 0.4 : creature.phaseTime,
  };
  return { hit: true, damage, pushX, pushZ, creature: next, downed: next.hp === 0 };
}

/* Telegraph FSM -------------------------------------------------- */

const TELEGRAPH_TIMINGS = {
  idle: 1.6,
  windup: 0.9, // visible warning ring on the renderer
  strike: 0.25,
  recover: 0.7,
};

export interface TelegraphTickResult {
  creature: CreatureSnapshot;
  /** True on the tick the strike resolves; the renderer applies hit detection. */
  striking: boolean;
}

export function tickTelegraph(creature: CreatureSnapshot, dt: number): TelegraphTickResult {
  let { phase, phaseTime } = creature;
  phaseTime -= dt;
  let striking = false;
  if (phaseTime <= 0) {
    if (phase === 'idle') {
      phase = 'windup';
      phaseTime = TELEGRAPH_TIMINGS.windup;
    } else if (phase === 'windup') {
      phase = 'strike';
      phaseTime = TELEGRAPH_TIMINGS.strike;
      striking = true;
    } else if (phase === 'strike') {
      phase = 'recover';
      phaseTime = TELEGRAPH_TIMINGS.recover;
    } else {
      phase = 'idle';
      phaseTime = TELEGRAPH_TIMINGS.idle;
    }
  }
  return { creature: { ...creature, phase, phaseTime }, striking };
}

/* Player invulnerability frames + damage ------------------------- */

export interface PlayerCombatState {
  hp: number;
  maxHp: number;
  /** Seconds of remaining i-frames. */
  iframes: number;
}

export function createPlayerCombat(maxHp: number = 60): PlayerCombatState {
  return { hp: maxHp, maxHp, iframes: 0 };
}

export const DEFAULT_IFRAME_SECS = 1.0;

export interface PlayerHitInput {
  state: PlayerCombatState;
  damage: number;
  dt: number;
}

export interface PlayerHitResult {
  state: PlayerCombatState;
  damaged: boolean;
  defeated: boolean;
}

export function applyHitToPlayer(input: PlayerHitInput): PlayerHitResult {
  // Drain ongoing iframes.
  const remainingIframes = Math.max(0, input.state.iframes - input.dt);
  if (input.state.iframes > 0) {
    return {
      state: { ...input.state, iframes: remainingIframes },
      damaged: false,
      defeated: false,
    };
  }
  const hp = Math.max(0, input.state.hp - input.damage);
  return {
    state: { ...input.state, hp, iframes: DEFAULT_IFRAME_SECS },
    damaged: true,
    defeated: hp === 0,
  };
}

export function tickIframes(state: PlayerCombatState, dt: number): PlayerCombatState {
  if (state.iframes <= 0) return state;
  return { ...state, iframes: Math.max(0, state.iframes - dt) };
}

/* Loot tables ---------------------------------------------------- */

export interface LootRow {
  itemId: string;
  weight: number;
}

export const CAVE_CRITTER_LOOT: readonly LootRow[] = [
  { itemId: 'gravel', weight: 50 },
  { itemId: 'iron-ore', weight: 20 },
  { itemId: 'salt-crystal', weight: 18 },
  { itemId: 'lampstone', weight: 8 },
  { itemId: 'silver-vein', weight: 4 },
];

function pseudoFloat(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function rollLoot(rows: readonly LootRow[], seed: number): string {
  const total = rows.reduce((s, r) => s + r.weight, 0);
  const r = pseudoFloat(seed) * total;
  let acc = 0;
  for (const row of rows) {
    acc += row.weight;
    if (r <= acc) return row.itemId;
  }
  return rows[rows.length - 1]!.itemId;
}
