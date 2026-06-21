import { describe, it, expect } from 'vitest';
import {
  canCraft,
  craft,
  ingredientShortage,
  isKnown,
  STARTER_RECIPE_IDS,
  RECIPE_UNLOCK_SOURCES,
  unlockRecipes,
  loadRecipesFromContent,
  buildCraftingPanelRecipes,
  isPlaceable,
  placeCrafted,
  listPlacements,
  removePlacement,
  rotatePlacement,
  movePlacement,
  evaluateRecipeUnlocks,
} from '../../src/engine/crafting';
import { addItem, createContainer } from '../../src/engine/inventory';
import type { Recipe } from '../../src/data/schemas';
import { loadGameContent } from '../../src/data/content';
import { createNewSave, parseSave, serializeSave } from '../../src/engine/saveModel';

const GOAT_CHEESE: Recipe = {
  id: 'goat-cheese',
  name: 'Goat Cheese',
  type: 'crafting',
  outputItemId: 'goat-cheese',
  outputQty: 1,
  ingredients: [{ itemId: 'bluff-goat-milk', qty: 1 }],
};

const BELL_PEA_STEW: Recipe = {
  id: 'bell-pea-stew',
  name: 'Bell Pea Stew',
  type: 'cooking',
  outputItemId: 'bell-pea-stew',
  outputQty: 1,
  ingredients: [
    { itemId: 'bell-peas', qty: 2 },
    { itemId: 'salt', qty: 1 },
  ],
};

describe('crafting engine', () => {
  it('ingredientShortage reports what the player still needs', () => {
    const empty = createContainer(8);
    const short = ingredientShortage(BELL_PEA_STEW, empty);
    expect(short).toHaveLength(2);
    expect(short.find((s) => s.itemId === 'bell-peas')).toEqual({
      itemId: 'bell-peas',
      need: 2,
      have: 0,
    });

    const stocked = addItem(empty, 'bell-peas', 2).container;
    const stillShort = ingredientShortage(BELL_PEA_STEW, stocked);
    expect(stillShort).toEqual([{ itemId: 'salt', need: 1, have: 0 }]);
  });

  it('canCraft becomes true only when every ingredient is present', () => {
    let c = createContainer(8);
    expect(canCraft(BELL_PEA_STEW, c)).toBe(false);
    c = addItem(c, 'bell-peas', 2).container;
    c = addItem(c, 'salt', 1).container;
    expect(canCraft(BELL_PEA_STEW, c)).toBe(true);
  });

  it('craft consumes ingredients and adds the output', () => {
    let c = createContainer(8);
    c = addItem(c, 'bluff-goat-milk', 1).container;
    const result = craft({ recipe: GOAT_CHEESE, container: c });
    expect(result.accepted).toBe(true);
    expect(result.container.slots.some((s) => s?.itemId === 'goat-cheese' && s.qty === 1)).toBe(true);
    expect(result.container.slots.some((s) => s?.itemId === 'bluff-goat-milk')).toBe(false);
  });

  it('craft refuses + does not mutate when ingredients are short', () => {
    const c = createContainer(8);
    const before = JSON.parse(JSON.stringify(c));
    const result = craft({ recipe: GOAT_CHEESE, container: c });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('missing-ingredients');
    expect(result.container).toEqual(before);
  });

  it('craft refuses + rolls back when the output has no slot', () => {
    // Capacity 1 container, the one slot already full of an unrelated item.
    let tiny = createContainer(1);
    tiny = addItem(tiny, 'driftwood', 99).container;
    // Bypass the ingredient gate by faking a "free" recipe.
    const free: Recipe = {
      id: 'free',
      name: 'Free',
      type: 'crafting',
      outputItemId: 'goat-cheese',
      outputQty: 1,
      ingredients: [{ itemId: 'driftwood', qty: 1 }],
    };
    const result = craft({ recipe: free, container: tiny });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('no-output-slot');
    // Roll-back: original driftwood stack is intact.
    expect(result.container.slots[0]).toEqual({ itemId: 'driftwood', qty: 99, quality: 0 });
  });

  it('isKnown reflects the save\'s knownRecipeIds list', () => {
    expect(isKnown('goat-cheese', STARTER_RECIPE_IDS)).toBe(true);
    expect(isKnown('shell-bracelet', STARTER_RECIPE_IDS)).toBe(false);
  });
});

describe('recipe unlocks (Prompt 017)', () => {
  it('exposes at least four unlock sources (skills, NPCs, shops, quests)', () => {
    const sources = new Set(Object.values(RECIPE_UNLOCK_SOURCES).map((u) => u.source));
    expect(sources.has('skill')).toBe(true);
    expect(sources.has('npc')).toBe(true);
    expect(sources.has('shop')).toBe(true);
    expect(sources.has('quest')).toBe(true);
  });

  it('unlockRecipes adds unseen ids and preserves order without duplicates', () => {
    const before = ['goat-cheese'];
    const after = unlockRecipes(before, ['pea-jam', 'goat-cheese', 'pea-jam']);
    expect(after).toEqual(['goat-cheese', 'pea-jam']);
  });

  it('loadRecipesFromContent returns the bundled recipes (≥ 20)', () => {
    const recipes = loadRecipesFromContent(loadGameContent());
    expect(recipes.length).toBeGreaterThanOrEqual(20);
    // Every starter id resolves to a real recipe.
    for (const id of STARTER_RECIPE_IDS) {
      expect(recipes.find((r) => r.id === id), `missing ${id}`).toBeTruthy();
    }
  });

  it('evaluateRecipeUnlocks fires per source kind (skill / NPC / quest)', () => {
    const base = {
      knownRecipeIds: [] as string[],
      skills: {} as Record<string, number>,
      relationships: {} as Record<string, number>,
      flags: {} as Record<string, boolean | number | string>,
    };
    // No conditions met yet.
    expect(evaluateRecipeUnlocks(base)).toEqual([]);

    // Skill: foraging XP reaches the driftwood-shelf threshold.
    expect(
      evaluateRecipeUnlocks({ ...base, skills: { foraging: 10 } }),
    ).toContain('driftwood-shelf');

    // NPC: Mara at 3 hearts unlocks the shell bracelet.
    expect(
      evaluateRecipeUnlocks({ ...base, relationships: { mara: 300 } }),
    ).toContain('shell-bracelet');

    // Quest: the boardwalk repair quest unlocks salted driftwood.
    expect(
      evaluateRecipeUnlocks({ ...base, flags: { 'quest:fix-the-boardwalk:done': true } }),
    ).toContain('salted-driftwood');

    // Already known → not re-emitted.
    expect(
      evaluateRecipeUnlocks({
        ...base,
        knownRecipeIds: ['driftwood-shelf'],
        skills: { foraging: 99 },
      }),
    ).not.toContain('driftwood-shelf');

    // Shop-source recipes do NOT auto-unlock — purchase is the trigger.
    expect(
      evaluateRecipeUnlocks({ ...base, skills: { cultivation: 999 }, relationships: { mara: 9999 } }),
    ).not.toContain('preserved-radish');
  });
});

describe('buildCraftingPanelRecipes (Prompt 017)', () => {
  it('filters by known ids, marks canCraft per row, and labels by item name', () => {
    const content = loadGameContent();
    const recipes = loadRecipesFromContent(content);
    const itemsById = new Map(content.items.map((i) => [i.id, i] as const));
    let c = createContainer(8);
    c = addItem(c, 'tide-shell', 2).container;
    const rows = buildCraftingPanelRecipes({
      knownRecipeIds: ['salt-from-shells', 'shell-charm', 'shell-bracelet'],
      recipes,
      itemsById,
      container: c,
    });
    expect(rows.map((r) => r.id)).toEqual(['salt-from-shells', 'shell-charm', 'shell-bracelet']);
    const salt = rows.find((r) => r.id === 'salt-from-shells')!;
    expect(salt.canCraft).toBe(true);
    expect(salt.outputName).toBe('Sea Salt');
    expect(salt.ingredients[0]!.itemName).toBe('Tide Shell');
    expect(salt.ingredients[0]!.have).toBe(2);
    // shell-bracelet needs 3 shells; we only have 2.
    expect(rows.find((r) => r.id === 'shell-bracelet')!.canCraft).toBe(false);
  });
});

describe('placement (Prompt 017)', () => {
  it('isPlaceable picks out items tagged decor', () => {
    const content = loadGameContent();
    const byId = new Map(content.items.map((i) => [i.id, i] as const));
    expect(isPlaceable('driftwood-shelf', byId)).toBe(true);
    expect(isPlaceable('goat-cheese', byId)).toBe(false);
  });

  it('placeCrafted persists across a save round-trip', () => {
    const save = createNewSave({ name: 'Pat', farmName: 'Tide' }, 0);
    placeCrafted(save, 'Interior', 'driftwood-shelf', -4, -3);
    expect(listPlacements(save, 'Interior')).toHaveLength(1);
    // Mimic a save reload: serialize → parse with the schema.
    const round = parseSave(serializeSave(save));
    expect(listPlacements(round, 'Interior')).toEqual(listPlacements(save, 'Interior'));
  });

  it('placeCrafted records a rotation and it survives a round-trip (Prompt 060)', () => {
    const save = createNewSave({ name: 'Pat', farmName: 'Tide' }, 0);
    placeCrafted(save, 'Interior', 'rush-stool', 1, 2, Math.PI / 2);
    const round = parseSave(serializeSave(save));
    expect(listPlacements(round, 'Interior')[0]!.rot).toBeCloseTo(Math.PI / 2);
  });

  it('removePlacement / movePlacement / rotatePlacement edit a placement (Prompt 060)', () => {
    const save = createNewSave({ name: 'Pat', farmName: 'Tide' }, 0);
    const a = placeCrafted(save, 'Interior', 'rush-stool', 0, 0);
    const b = placeCrafted(save, 'Interior', 'round-tea-table', 1, 1);
    expect(movePlacement(save, 'Interior', a.id, 3, 4)).toBe(true);
    expect(rotatePlacement(save, 'Interior', a.id, 1.5)).toBe(true);
    const moved = listPlacements(save, 'Interior').find((p) => p.id === a.id)!;
    expect([moved.x, moved.z, moved.rot]).toEqual([3, 4, 1.5]);
    expect(removePlacement(save, 'Interior', b.id)).toBe(true);
    expect(listPlacements(save, 'Interior').map((p) => p.id)).toEqual([a.id]);
    // Editing an unknown id is a safe no-op.
    expect(removePlacement(save, 'Interior', 'nope')).toBe(false);
    expect(movePlacement(save, 'Interior', 'nope', 0, 0)).toBe(false);
  });
});
