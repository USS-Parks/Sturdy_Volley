import type { BuffEffect, FoodBuff, Item } from '../data/schemas';
import type { ActiveBuff } from './saveModel';

/**
 * Food buffs (Prompt 059). Pure + deterministic. Eating an edible item restores
 * stamina immediately and may grant a timed `ActiveBuff` that boosts a gameplay
 * system (movement / skill-xp / fishing / mining / foraging / combat) or tops up
 * stamina regen. Active buffs live on the save (`save.activeBuffs`) with an
 * in-day expiry minute; they are pruned as time advances and cleared at sleep.
 */

export function isEdible(item: Item): boolean {
  return item.category === 'cooking' || (item.staminaRestore ?? 0) > 0 || item.buff != null;
}

export interface EatOutcome {
  staminaRestore: number;
  buff: FoodBuff | null;
}

/** What eating an item yields (the scene applies the stamina; the buff goes on the save). */
export function eatFood(item: Item): EatOutcome {
  return { staminaRestore: item.staminaRestore ?? 0, buff: item.buff ?? null };
}

/**
 * Add a buff, replacing any active buff of the same effect (re-eating refreshes
 * the timer rather than stacking). `nowMinutes` is the current in-day clock.
 */
export function applyBuff(active: readonly ActiveBuff[], buff: FoodBuff, nowMinutes: number): ActiveBuff[] {
  const kept = active.filter((b) => b.effect !== buff.effect);
  return [...kept, { effect: buff.effect, magnitude: buff.magnitude, expiresAtMinutes: nowMinutes + buff.durationMinutes }];
}

/** Drop any buff whose expiry has passed. */
export function tickBuffs(active: readonly ActiveBuff[], nowMinutes: number): ActiveBuff[] {
  return active.filter((b) => b.expiresAtMinutes > nowMinutes);
}

export interface BuffEffects {
  /** Multiplier on player move speed (1 = no buff). */
  movementMult: number;
  /** Multiplier on skill XP gained. */
  skillXpMult: number;
  /** Multiplier on fishing outcomes. */
  fishingMult: number;
  /** Multiplier on mining outcomes. */
  miningMult: number;
  /** Multiplier on foraging yield. */
  foragingMult: number;
  /** Multiplier on combat damage. */
  combatMult: number;
  /** Flat bonus to stamina regen (added to the controller recovery rate). */
  staminaRegenBonus: number;
}

export function noBuffEffects(): BuffEffects {
  return {
    movementMult: 1,
    skillXpMult: 1,
    fishingMult: 1,
    miningMult: 1,
    foragingMult: 1,
    combatMult: 1,
    staminaRegenBonus: 0,
  };
}

/** Aggregate the live buffs into a single effects bundle the consumers read. */
export function activeBuffEffects(active: readonly ActiveBuff[], nowMinutes: number): BuffEffects {
  const eff = noBuffEffects();
  for (const b of tickBuffs(active, nowMinutes)) {
    switch (b.effect) {
      case 'movement':
        eff.movementMult += b.magnitude;
        break;
      case 'skill-xp':
        eff.skillXpMult += b.magnitude;
        break;
      case 'fishing':
        eff.fishingMult += b.magnitude;
        break;
      case 'mining':
        eff.miningMult += b.magnitude;
        break;
      case 'foraging':
        eff.foragingMult += b.magnitude;
        break;
      case 'combat':
        eff.combatMult += b.magnitude;
        break;
      case 'stamina-regen':
        eff.staminaRegenBonus += b.magnitude;
        break;
    }
  }
  return eff;
}

const EFFECT_LABEL: Record<BuffEffect, string> = {
  'stamina-regen': 'Stamina regen',
  movement: 'Quick step',
  'skill-xp': 'Sharp focus',
  fishing: 'Steady hand',
  mining: 'Strong arm',
  foraging: "Forager's eye",
  combat: 'Battle vigor',
};

/** Human label for a food buff, e.g. "Quick step +20%" or "Stamina regen +2/min". */
export function describeBuff(buff: FoodBuff): string {
  const mag = buff.effect === 'stamina-regen' ? `+${buff.magnitude}/min` : `+${Math.round(buff.magnitude * 100)}%`;
  return `${EFFECT_LABEL[buff.effect]} ${mag}`;
}

export interface BuffRow {
  effect: BuffEffect;
  label: string;
  /** "+20%" or "+2/min". */
  magnitudeLabel: string;
  minutesLeft: number;
}

export function buffRows(active: readonly ActiveBuff[], nowMinutes: number): BuffRow[] {
  return tickBuffs(active, nowMinutes)
    .map((b) => ({
      effect: b.effect,
      label: EFFECT_LABEL[b.effect],
      magnitudeLabel: b.effect === 'stamina-regen' ? `+${b.magnitude}/min` : `+${Math.round(b.magnitude * 100)}%`,
      minutesLeft: Math.max(0, b.expiresAtMinutes - nowMinutes),
    }))
    .sort((a, b) => b.minutesLeft - a.minutesLeft);
}
