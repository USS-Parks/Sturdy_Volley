import { describe, it, expect } from 'vitest';
import { foodBuffSchema, itemSchema, type FoodBuff, type Item } from '../../src/data/schemas';
import { loadGameContent } from '../../src/data/content';
import type { ActiveBuff } from '../../src/engine/saveModel';
import {
  activeBuffEffects,
  applyBuff,
  buffRows,
  describeBuff,
  eatFood,
  isEdible,
  noBuffEffects,
  tickBuffs,
} from '../../src/engine/buffs';

function item(partial: Record<string, unknown>): Item {
  return itemSchema.parse(partial);
}
function buff(partial: Record<string, unknown>): FoodBuff {
  return foodBuffSchema.parse(partial);
}

const STEW = item({
  id: 'stew', name: 'Stew', description: 'warm', category: 'cooking', sellPrice: 10, stackable: true,
  staminaRestore: 35, buff: { effect: 'stamina-regen', magnitude: 2, durationMinutes: 180 },
});
const JUICE = item({
  id: 'juice', name: 'Juice', description: 'cold', category: 'cooking', sellPrice: 10, stackable: true,
  staminaRestore: 15, buff: { effect: 'movement', magnitude: 0.2, durationMinutes: 120 },
});
const ROCK = item({ id: 'rock', name: 'Rock', description: 'hard', category: 'mineral', sellPrice: 5, stackable: true });

describe('edibility + eating', () => {
  it('cooking items, nourishing items, and buff items are edible; plain materials are not', () => {
    expect(isEdible(STEW)).toBe(true);
    expect(isEdible(JUICE)).toBe(true);
    expect(isEdible(ROCK)).toBe(false);
    expect(isEdible(item({ id: 'apple', name: 'Apple', description: 'a', category: 'forage', sellPrice: 3, stackable: true, staminaRestore: 5 }))).toBe(true);
  });

  it('eatFood reports the stamina restore + buff', () => {
    const out = eatFood(STEW);
    expect(out.staminaRestore).toBe(35);
    expect(out.buff?.effect).toBe('stamina-regen');
    expect(eatFood(ROCK)).toEqual({ staminaRestore: 0, buff: null });
  });
});

describe('applying + expiring buffs', () => {
  it('applies a buff with an absolute expiry', () => {
    const active = applyBuff([], STEW.buff!, 600);
    expect(active).toEqual([{ effect: 'stamina-regen', magnitude: 2, expiresAtMinutes: 780 }]);
  });

  it('re-applying the same effect refreshes (no stacking); a different effect coexists', () => {
    let active: ActiveBuff[] = applyBuff([], JUICE.buff!, 600); // movement, expires 720
    active = applyBuff(active, buff({ effect: 'movement', magnitude: 0.2, durationMinutes: 60 }), 650); // refresh → 710
    expect(active).toHaveLength(1);
    expect(active[0]!.expiresAtMinutes).toBe(710);
    active = applyBuff(active, STEW.buff!, 650); // stamina-regen coexists
    expect(active).toHaveLength(2);
  });

  it('tickBuffs drops only the lapsed buffs', () => {
    const active: ActiveBuff[] = [
      { effect: 'movement', magnitude: 0.2, expiresAtMinutes: 700 },
      { effect: 'mining', magnitude: 0.25, expiresAtMinutes: 900 },
    ];
    expect(tickBuffs(active, 800).map((b) => b.effect)).toEqual(['mining']);
    expect(tickBuffs(active, 950)).toHaveLength(0);
  });
});

describe('aggregate effects', () => {
  it('with no buffs, everything is neutral', () => {
    expect(activeBuffEffects([], 600)).toEqual(noBuffEffects());
  });

  it('sums multipliers + stamina-regen, ignoring expired buffs', () => {
    const active: ActiveBuff[] = [
      { effect: 'movement', magnitude: 0.2, expiresAtMinutes: 800 },
      { effect: 'foraging', magnitude: 0.25, expiresAtMinutes: 800 },
      { effect: 'stamina-regen', magnitude: 3, expiresAtMinutes: 800 },
      { effect: 'combat', magnitude: 0.5, expiresAtMinutes: 500 }, // expired
    ];
    const eff = activeBuffEffects(active, 700);
    expect(eff.movementMult).toBeCloseTo(1.2);
    expect(eff.foragingMult).toBeCloseTo(1.25);
    expect(eff.staminaRegenBonus).toBe(3);
    expect(eff.combatMult).toBe(1); // expired, not applied
  });

  it('buffRows + describeBuff produce readable labels', () => {
    const rows = buffRows([{ effect: 'movement', magnitude: 0.2, expiresAtMinutes: 720 }], 600);
    expect(rows[0]!.label).toBe('Quick step');
    expect(rows[0]!.magnitudeLabel).toBe('+20%');
    expect(rows[0]!.minutesLeft).toBe(120);
    expect(describeBuff({ effect: 'stamina-regen', magnitude: 2, durationMinutes: 60 })).toBe('Stamina regen +2/min');
    expect(describeBuff({ effect: 'mining', magnitude: 0.25, durationMinutes: 60 })).toBe('Strong arm +25%');
  });
});

describe('content acceptance — cooking + buffs (Prompt 059)', () => {
  const content = loadGameContent();

  it('ships at least 25 recipes', () => {
    expect(content.recipes.length).toBeGreaterThanOrEqual(25);
  });

  it('cooking recipes produce edible, buff-granting dishes', () => {
    const itemsById = new Map(content.items.map((i) => [i.id, i] as const));
    const cooking = content.recipes.filter((r) => r.type === 'cooking');
    expect(cooking.length).toBeGreaterThanOrEqual(10);
    const buffed = cooking.map((r) => itemsById.get(r.outputItemId)).filter((i) => i?.buff);
    expect(buffed.length).toBeGreaterThanOrEqual(8);
  });

  it('buffs cover stamina, movement, skill, and gathering/combat categories', () => {
    const effects = new Set(content.items.filter((i) => i.buff).map((i) => i.buff!.effect));
    for (const e of ['stamina-regen', 'movement', 'skill-xp', 'fishing', 'mining', 'foraging', 'combat'] as const) {
      expect(effects.has(e), `a food grants ${e}`).toBe(true);
    }
  });

  it('every cooking recipe ingredient + output resolves to a real item (locked by the content gate)', () => {
    const ids = new Set(content.items.map((i) => i.id));
    for (const r of content.recipes) {
      expect(ids.has(r.outputItemId), `${r.id} output`).toBe(true);
      for (const ing of r.ingredients) expect(ids.has(ing.itemId), `${r.id} ingredient ${ing.itemId}`).toBe(true);
    }
  });

  it('NPC meal preferences include cooked dishes (relationships integrate with cooking)', () => {
    const cookedIds = new Set(
      content.recipes.filter((r) => r.type === 'cooking').map((r) => r.outputItemId),
    );
    const npcsLovingMeals = content.npcs.filter((n) => n.lovedGiftItemIds.some((id) => cookedIds.has(id)));
    expect(npcsLovingMeals.length).toBeGreaterThanOrEqual(3);
  });
});
