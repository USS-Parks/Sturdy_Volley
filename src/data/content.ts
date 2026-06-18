import { z } from 'zod';
import {
  itemSchema,
  cropSchema,
  animalSchema,
  recipeSchema,
  npcSchema,
  skillSchema,
  weatherSchema,
  festivalSchema,
  questSchema,
  shopSchema,
  mapSchema,
  dialogueSchema,
  type GameContent,
} from './schemas';

import itemsJson from './content/items.json';
import cropsJson from './content/crops.json';
import animalsJson from './content/animals.json';
import recipesJson from './content/recipes.json';
import npcsJson from './content/npcs.json';
import skillsJson from './content/skills.json';
import weatherJson from './content/weather.json';
import festivalsJson from './content/festivals.json';
import questsJson from './content/quests.json';
import shopsJson from './content/shops.json';
import mapsJson from './content/maps.json';
import dialogueJson from './content/dialogue.json';

const SCHEMAS = {
  items: itemSchema,
  crops: cropSchema,
  animals: animalSchema,
  recipes: recipeSchema,
  npcs: npcSchema,
  skills: skillSchema,
  weather: weatherSchema,
  festivals: festivalSchema,
  quests: questSchema,
  shops: shopSchema,
  maps: mapSchema,
  dialogue: dialogueSchema,
} as const;

export type CollectionName = keyof typeof SCHEMAS;
export type RawContent = Record<CollectionName, unknown[]>;

export interface ValidationIssue {
  collection: CollectionName;
  path: string;
  message: string;
}

export interface ValidationResult {
  content: GameContent | null;
  issues: ValidationIssue[];
}

export interface CollectionSummary {
  name: CollectionName;
  count: number;
  ok: boolean;
  issues: string[];
}

const BUNDLED = {
  items: itemsJson,
  crops: cropsJson,
  animals: animalsJson,
  recipes: recipesJson,
  npcs: npcsJson,
  skills: skillsJson,
  weather: weatherJson,
  festivals: festivalsJson,
  quests: questsJson,
  shops: shopsJson,
  maps: mapsJson,
  dialogue: dialogueJson,
} as unknown as RawContent;

export class ContentValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(
      `Content validation failed with ${issues.length} issue(s):\n` +
        issues.map((i) => `  • ${i.collection} ${i.path}: ${i.message}`).join('\n'),
    );
    this.name = 'ContentValidationError';
  }
}

/**
 * Validate raw content against the schemas, then check cross-collection
 * references (e.g. a crop's seed item actually exists). Returns the typed
 * content when valid, or a list of human-readable issues.
 */
export function validateContent(raw: RawContent): ValidationResult {
  const issues: ValidationIssue[] = [];
  const parsed: Partial<Record<CollectionName, unknown[]>> = {};

  for (const name of Object.keys(SCHEMAS) as CollectionName[]) {
    const schema = SCHEMAS[name];
    const rows = Array.isArray(raw[name]) ? raw[name] : [];
    const result = z.array(schema).safeParse(rows);

    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({ collection: name, path: issue.path.join('.') || '(root)', message: issue.message });
      }
      continue;
    }

    parsed[name] = result.data as unknown[];

    const seen = new Set<string>();
    (result.data as Array<{ id: string }>).forEach((row, index) => {
      if (seen.has(row.id)) {
        issues.push({ collection: name, path: `[${index}].id`, message: `duplicate id "${row.id}"` });
      }
      seen.add(row.id);
    });
  }

  // Referential integrity only runs when every collection parsed cleanly, so
  // reference errors aren't drowned out by upstream shape errors.
  if (issues.length === 0) {
    const content = parsed as unknown as GameContent;
    checkReferences(content, issues);
    if (issues.length === 0) return { content, issues };
  }

  return { content: null, issues };
}

function checkReferences(content: GameContent, issues: ValidationIssue[]): void {
  const itemIds = new Set(content.items.map((i) => i.id));
  const npcIds = new Set(content.npcs.map((n) => n.id));

  const requireItem = (
    collection: CollectionName,
    path: string,
    id: string,
    label: string,
  ): void => {
    if (!itemIds.has(id)) {
      issues.push({ collection, path, message: `${label} "${id}" does not match any item` });
    }
  };

  content.crops.forEach((crop, i) => {
    requireItem('crops', `[${i}].seedItemId`, crop.seedItemId, 'seedItemId');
    requireItem('crops', `[${i}].produceItemId`, crop.produceItemId, 'produceItemId');
  });

  content.animals.forEach((animal, i) => {
    requireItem('animals', `[${i}].produceItemId`, animal.produceItemId, 'produceItemId');
  });

  content.recipes.forEach((recipe, i) => {
    requireItem('recipes', `[${i}].outputItemId`, recipe.outputItemId, 'outputItemId');
    recipe.ingredients.forEach((ing, j) => {
      requireItem('recipes', `[${i}].ingredients[${j}].itemId`, ing.itemId, 'ingredient itemId');
    });
  });

  content.npcs.forEach((npc, i) => {
    npc.lovedGiftItemIds.forEach((id, j) => {
      requireItem('npcs', `[${i}].lovedGiftItemIds[${j}]`, id, 'lovedGiftItemId');
    });
  });

  content.shops.forEach((shop, i) => {
    if (shop.npcId !== null && !npcIds.has(shop.npcId)) {
      issues.push({ collection: 'shops', path: `[${i}].npcId`, message: `npcId "${shop.npcId}" does not match any NPC` });
    }
    shop.stockItemIds.forEach((id, j) => {
      requireItem('shops', `[${i}].stockItemIds[${j}]`, id, 'stock itemId');
    });
  });

  content.dialogue.forEach((d, i) => {
    if (!npcIds.has(d.npcId)) {
      issues.push({ collection: 'dialogue', path: `[${i}].npcId`, message: `npcId "${d.npcId}" does not match any NPC` });
    }
  });
}

let cached: GameContent | null = null;

/** Load + validate the bundled content. Throws ContentValidationError if invalid. */
export function loadGameContent(): GameContent {
  if (cached) return cached;
  const { content, issues } = validateContent(BUNDLED);
  if (!content) throw new ContentValidationError(issues);
  cached = content;
  return content;
}

/** Per-collection pass/fail summary for the dev validation screen. */
export function getContentReport(raw: RawContent = BUNDLED): CollectionSummary[] {
  const { issues } = validateContent(raw);
  return (Object.keys(SCHEMAS) as CollectionName[]).map((name) => {
    const colIssues = issues
      .filter((i) => i.collection === name)
      .map((i) => `${i.path}: ${i.message}`);
    const count = Array.isArray(raw[name]) ? raw[name].length : 0;
    return { name, count, ok: colIssues.length === 0, issues: colIssues };
  });
}
