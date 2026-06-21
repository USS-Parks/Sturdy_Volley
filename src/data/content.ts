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
  projectSchema,
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
import projectsJson from './content/projects.json';
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
  projects: projectSchema,
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
  projects: projectsJson,
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

  // Quests (Prompt 054): validate objective/reward/giver/prerequisite references
  // so a typo in a quest definition fails the content gate instead of producing
  // an unwinnable quest at runtime.
  const recipeIds = new Set(content.recipes.map((r) => r.id));
  const questIds = new Set(content.quests.map((q) => q.id));
  const ITEM_TARGET_KINDS = new Set(['harvest', 'fish', 'forage', 'mine', 'craft', 'ship', 'have']);
  const NPC_TARGET_KINDS = new Set(['gift', 'talk', 'befriend']);
  const SCENE_TARGET_KINDS = new Set(['visit']);
  const SCENE_KEYS = new Set(['Farm', 'Town', 'Beach', 'Mine', 'Interior']);

  content.quests.forEach((quest, i) => {
    if (quest.giverNpcId !== null && !npcIds.has(quest.giverNpcId)) {
      issues.push({ collection: 'quests', path: `[${i}].giverNpcId`, message: `giverNpcId "${quest.giverNpcId}" does not match any NPC` });
    }
    quest.prerequisiteQuestIds.forEach((pid, j) => {
      if (!questIds.has(pid)) {
        issues.push({ collection: 'quests', path: `[${i}].prerequisiteQuestIds[${j}]`, message: `prerequisite "${pid}" does not match any quest` });
      }
    });
    quest.objectives.forEach((obj, j) => {
      if (obj.target === null) return;
      const path = `[${i}].objectives[${j}].target`;
      if (ITEM_TARGET_KINDS.has(obj.kind)) {
        requireItem('quests', path, obj.target, 'objective target');
      } else if (NPC_TARGET_KINDS.has(obj.kind) && !npcIds.has(obj.target)) {
        issues.push({ collection: 'quests', path, message: `objective target "${obj.target}" does not match any NPC` });
      } else if (SCENE_TARGET_KINDS.has(obj.kind) && !SCENE_KEYS.has(obj.target)) {
        issues.push({ collection: 'quests', path, message: `objective target "${obj.target}" is not a known scene` });
      }
    });
    quest.rewards.forEach((reward, j) => {
      const path = `[${i}].rewards[${j}]`;
      if (reward.kind === 'item') {
        requireItem('quests', `${path}.itemId`, reward.itemId, 'reward itemId');
      } else if (reward.kind === 'recipe' && !recipeIds.has(reward.recipeId)) {
        issues.push({ collection: 'quests', path: `${path}.recipeId`, message: `reward recipeId "${reward.recipeId}" does not match any recipe` });
      } else if (reward.kind === 'relationship' && !npcIds.has(reward.npcId)) {
        issues.push({ collection: 'quests', path: `${path}.npcId`, message: `reward npcId "${reward.npcId}" does not match any NPC` });
      }
    });
  });

  // Civic projects (Prompt 055): validate giver / phase-requirement / reward /
  // ceremony references so a typo fails the content gate, not a stuck project.
  content.projects.forEach((project, i) => {
    if (project.giverNpcId !== null && !npcIds.has(project.giverNpcId)) {
      issues.push({ collection: 'projects', path: `[${i}].giverNpcId`, message: `giverNpcId "${project.giverNpcId}" does not match any NPC` });
    }
    project.phases.forEach((phase, j) => {
      phase.requirements.forEach((req, k) => {
        const path = `[${i}].phases[${j}].requirements[${k}]`;
        if (req.kind === 'item') {
          requireItem('projects', `${path}.itemId`, req.itemId, 'requirement itemId');
        } else if (req.kind === 'relationship' && !npcIds.has(req.npcId)) {
          issues.push({ collection: 'projects', path: `${path}.npcId`, message: `requirement npcId "${req.npcId}" does not match any NPC` });
        }
      });
    });
    project.rewards.forEach((reward, j) => {
      const path = `[${i}].rewards[${j}]`;
      if (reward.kind === 'item') {
        requireItem('projects', `${path}.itemId`, reward.itemId, 'reward itemId');
      } else if (reward.kind === 'recipe' && !recipeIds.has(reward.recipeId)) {
        issues.push({ collection: 'projects', path: `${path}.recipeId`, message: `reward recipeId "${reward.recipeId}" does not match any recipe` });
      } else if (reward.kind === 'relationship' && !npcIds.has(reward.npcId)) {
        issues.push({ collection: 'projects', path: `${path}.npcId`, message: `reward npcId "${reward.npcId}" does not match any NPC` });
      }
    });
    project.ceremony.forEach((reaction, j) => {
      if (!npcIds.has(reaction.npcId)) {
        issues.push({ collection: 'projects', path: `[${i}].ceremony[${j}].npcId`, message: `ceremony npcId "${reaction.npcId}" does not match any NPC` });
      }
    });
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
