import type { GameContent, Item, Recipe } from '../data/schemas';
import type { Container, SaveData } from './saveModel';
import { addItem, countItem, removeItem } from './inventory';

/**
 * Crafting engine (Prompt 017). Pure. Each recipe has an ingredient list and
 * an output stack. `canCraft` checks the player's container; `craft` consumes
 * the ingredients and writes the output. Recipe-unlock state lives on the
 * save (`knownRecipeIds: string[]`); the engine doesn't filter — the UI shows
 * only known recipes.
 *
 * Crafted placeables (items tagged `decor`) skip the inventory and land on
 * the active map via `placeCrafted`. The placement list is stored on
 * `save.mapState[sceneKey].placements` so it survives sleep + reload.
 */
export interface CraftAttempt {
  recipe: Recipe;
  container: Container;
}

export interface CraftResult {
  accepted: boolean;
  reason?: 'missing-ingredients' | 'no-output-slot';
  container: Container;
}

export function ingredientShortage(
  recipe: Recipe,
  container: Container,
): Array<{ itemId: string; need: number; have: number }> {
  return recipe.ingredients
    .map((ing) => ({ itemId: ing.itemId, need: ing.qty, have: countItem(container, ing.itemId) }))
    .filter((g) => g.have < g.need);
}

export function canCraft(recipe: Recipe, container: Container): boolean {
  return ingredientShortage(recipe, container).length === 0;
}

export function craft(attempt: CraftAttempt): CraftResult {
  const { recipe, container } = attempt;
  if (!canCraft(recipe, container)) {
    return { accepted: false, reason: 'missing-ingredients', container };
  }
  let next = container;
  for (const ing of recipe.ingredients) {
    next = removeItem(next, ing.itemId, ing.qty).container;
  }
  const added = addItem(next, recipe.outputItemId, recipe.outputQty, 0);
  if (added.overflow > 0) {
    return { accepted: false, reason: 'no-output-slot', container };
  }
  return { accepted: true, container: added.container };
}

/** Initial recipe list available to every player on Day 1. */
export const STARTER_RECIPE_IDS: readonly string[] = [
  'goat-cheese',
  'garden-omelet',
  'salt-from-shells',
  'bell-pea-stew',
  'turnip-soup',
  'driftwood-plank',
  'shell-charm',
];

export function isKnown(recipeId: string, knownRecipeIds: readonly string[]): boolean {
  return knownRecipeIds.includes(recipeId);
}

/**
 * Where each non-starter recipe comes from. The four `source` kinds satisfy
 * the Prompt 017 acceptance line that recipes unlock through skills, NPCs,
 * shops, and quests. The renderer hands the matching trigger to
 * `unlockRecipes` when the player hits the unlock condition.
 */
export type RecipeUnlockSource =
  | { source: 'skill'; skillId: string; level: number }
  | { source: 'npc'; npcId: string; minHearts: number }
  | { source: 'shop'; shopId: string; price: number }
  | { source: 'quest'; questId: string };

/**
 * Skill thresholds are expressed in raw XP units (the same units the ledger
 * deposits). Skill levelling proper lands later — Prompt 017 only needs the
 * unlock condition to fire when the player has done the underlying work.
 */
export const RECIPE_UNLOCK_SOURCES: Record<string, RecipeUnlockSource> = {
  'pea-jam': { source: 'skill', skillId: 'cultivation', level: 10 },
  'sun-jam': { source: 'skill', skillId: 'cultivation', level: 30 },
  'preserved-radish': { source: 'shop', shopId: 'market-bakery', price: 250 },
  'radish-pickle': { source: 'shop', shopId: 'market-bakery', price: 200 },
  'driftwood-shelf': { source: 'skill', skillId: 'foraging', level: 10 },
  'shell-bracelet': { source: 'npc', npcId: 'mara', minHearts: 3 },
  'harborlime-tart': { source: 'npc', npcId: 'wren', minHearts: 2 },
  'sunmelon-juice': { source: 'shop', shopId: 'market-bakery', price: 180 },
  'root-stew': { source: 'quest', questId: 'help-with-supper' },
  'salted-driftwood': { source: 'quest', questId: 'fix-the-boardwalk' },
  'cheese-omelet': { source: 'npc', npcId: 'wren', minHearts: 4 },
  'pea-cheese-stew': { source: 'skill', skillId: 'crafting', level: 20 },
  'sea-salt-bulk': { source: 'skill', skillId: 'foraging', level: 40 },
};

/**
 * Inspect a save and return every unlock-source recipe whose condition is
 * now satisfied but isn't yet in `knownRecipeIds`. Quest recipes unlock
 * when `save.flags[`quest:${questId}:done`] === true`. Skill recipes match
 * on `save.skills[skillId] >= level`. NPC recipes match on
 * `save.relationships[npcId] >= minHearts * POINTS_PER_LEVEL` (100). Shop
 * recipes do *not* auto-unlock — buying them at the shop is the trigger.
 */
export interface UnlockEvalSave {
  knownRecipeIds: readonly string[];
  skills: Record<string, number>;
  relationships: Record<string, number>;
  flags: Record<string, boolean | number | string>;
}

const POINTS_PER_HEART = 100;

export function evaluateRecipeUnlocks(save: UnlockEvalSave): string[] {
  const newly: string[] = [];
  const known = new Set(save.knownRecipeIds);
  for (const [recipeId, src] of Object.entries(RECIPE_UNLOCK_SOURCES)) {
    if (known.has(recipeId)) continue;
    if (src.source === 'skill') {
      if ((save.skills[src.skillId] ?? 0) >= src.level) newly.push(recipeId);
    } else if (src.source === 'npc') {
      const pts = save.relationships[src.npcId] ?? 0;
      if (pts >= src.minHearts * POINTS_PER_HEART) newly.push(recipeId);
    } else if (src.source === 'quest') {
      if (save.flags[`quest:${src.questId}:done`] === true) newly.push(recipeId);
    }
  }
  return newly;
}

/** Add `add` ids to a known-recipes list, dropping duplicates + preserving order. */
export function unlockRecipes(
  known: readonly string[],
  add: readonly string[],
): string[] {
  const seen = new Set(known);
  const next = [...known];
  for (const id of add) {
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
}

/** Pull the bundled recipe collection out of validated content. */
export function loadRecipesFromContent(content: GameContent): readonly Recipe[] {
  return content.recipes;
}

export interface BuildCraftingRowsInput {
  knownRecipeIds: readonly string[];
  recipes: readonly Recipe[];
  itemsById: ReadonlyMap<string, Item>;
  container: Container;
}

export interface CraftingRow {
  id: string;
  name: string;
  type: 'cooking' | 'crafting';
  outputName: string;
  outputQty: number;
  ingredients: Array<{ itemId: string; itemName: string; need: number; have: number }>;
  canCraft: boolean;
}

/**
 * Project the bundled `Recipe[]` down to a renderer-friendly list, filtered
 * by the player's `knownRecipeIds`. Each row carries the resolved display
 * names for the output + each ingredient so the overlay doesn't have to do
 * its own catalog lookups.
 */
export function buildCraftingPanelRecipes(input: BuildCraftingRowsInput): CraftingRow[] {
  const rows: CraftingRow[] = [];
  const known = new Set(input.knownRecipeIds);
  for (const r of input.recipes) {
    if (!known.has(r.id)) continue;
    const outItem = input.itemsById.get(r.outputItemId);
    rows.push({
      id: r.id,
      name: r.name,
      type: r.type,
      outputName: outItem?.name ?? r.outputItemId,
      outputQty: r.outputQty,
      ingredients: r.ingredients.map((ing) => ({
        itemId: ing.itemId,
        itemName: input.itemsById.get(ing.itemId)?.name ?? ing.itemId,
        need: ing.qty,
        have: countItem(input.container, ing.itemId),
      })),
      canCraft: canCraft(r, input.container),
    });
  }
  return rows;
}

/**
 * Placement model. Placeables (items tagged `decor`) skip the inventory on
 * craft and land in `save.mapState[sceneKey].placements` at the chosen
 * anchor. The renderer reads that list every time the scene is built.
 */
export interface Placement {
  id: string;
  itemId: string;
  x: number;
  z: number;
}

export interface SceneMapState {
  placements: Placement[];
}

export function getSceneMapState(save: SaveData, sceneKey: string): SceneMapState {
  const raw = save.mapState[sceneKey];
  if (raw && typeof raw === 'object' && Array.isArray((raw as SceneMapState).placements)) {
    return raw as SceneMapState;
  }
  return { placements: [] };
}

export function listPlacements(save: SaveData, sceneKey: string): readonly Placement[] {
  return getSceneMapState(save, sceneKey).placements;
}

export function isPlaceable(itemId: string, itemsById: ReadonlyMap<string, Item>): boolean {
  const item = itemsById.get(itemId);
  return !!item && item.tags.includes('decor');
}

/**
 * Append a placement to the current scene's map state. Pure-ish: mutates the
 * save in place because callers already treat `save` as a live document, and
 * returns the new placement so the renderer can spawn a matching mesh.
 */
export function placeCrafted(
  save: SaveData,
  sceneKey: string,
  itemId: string,
  x: number,
  z: number,
): Placement {
  const state = getSceneMapState(save, sceneKey);
  const placement: Placement = {
    id: `${sceneKey}:placement-${state.placements.length + 1}-${Date.now().toString(36)}`,
    itemId,
    x,
    z,
  };
  const next: SceneMapState = { placements: [...state.placements, placement] };
  save.mapState[sceneKey] = next;
  return placement;
}
