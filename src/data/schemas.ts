import { z } from 'zod';

/**
 * Zod schemas for all data-driven content. Schemas are `.strict()` so unknown
 * keys (typos) become validation errors, and IDs are constrained to a stable,
 * human-readable kebab-case form. TypeScript types are inferred from the
 * schemas so data and code never drift.
 */

export const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const idSchema = z
  .string()
  .regex(KEBAB_CASE, 'id must be kebab-case (lowercase letters, digits, dashes)');

export const seasonSchema = z.enum(['spring', 'summer', 'fall', 'winter']);
export type Season = z.infer<typeof seasonSchema>;

export const itemCategorySchema = z.enum([
  'crop',
  'seed',
  'forage',
  'fish',
  'mineral',
  'artisan',
  'cooking',
  'animal',
  'gear',
  'material',
  'misc',
]);
export type ItemCategory = z.infer<typeof itemCategorySchema>;

export const itemSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    category: itemCategorySchema,
    sellPrice: z.number().int().nonnegative(),
    stackable: z.boolean(),
    tags: z.array(z.string()).default([]),
  })
  .strict();
export type Item = z.infer<typeof itemSchema>;

export const cropSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    seedItemId: idSchema,
    produceItemId: idSchema,
    seasons: z.array(seasonSchema).min(1),
    growthDays: z.number().int().positive(),
    regrowDays: z.number().int().positive().nullable().default(null),
  })
  .strict();
export type Crop = z.infer<typeof cropSchema>;

export const animalSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    species: z.string().min(1),
    habitat: z.enum(['coop', 'barn', 'pasture']),
    produceItemId: idSchema,
    daysToMature: z.number().int().positive(),
  })
  .strict();
export type Animal = z.infer<typeof animalSchema>;

export const recipeSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    type: z.enum(['cooking', 'crafting']),
    outputItemId: idSchema,
    outputQty: z.number().int().positive(),
    ingredients: z
      .array(z.object({ itemId: idSchema, qty: z.number().int().positive() }).strict())
      .min(1),
  })
  .strict();
export type Recipe = z.infer<typeof recipeSchema>;

export const npcSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    role: z.string().min(1),
    description: z.string().min(1),
    birthday: z
      .object({ season: seasonSchema, day: z.number().int().min(1).max(28) })
      .strict(),
    lovedGiftItemIds: z.array(idSchema).default([]),
    romanceable: z.boolean().default(false),
  })
  .strict();
export type Npc = z.infer<typeof npcSchema>;

export const skillSchema = z
  .object({ id: idSchema, name: z.string().min(1), description: z.string().min(1) })
  .strict();
export type Skill = z.infer<typeof skillSchema>;

export const weatherSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    affectsTravel: z.boolean().default(false),
  })
  .strict();
export type Weather = z.infer<typeof weatherSchema>;

export const festivalSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    season: seasonSchema,
    day: z.number().int().min(1).max(28),
    description: z.string().min(1),
  })
  .strict();
export type Festival = z.infer<typeof festivalSchema>;

/**
 * Quest taxonomy (Prompt 054).
 *
 * `category` is the *activity arc* a quest belongs to (the journal groups by it);
 * `kind` is its *delivery* (a main-story beat, a daily help-wanted request, or a
 * special order). The two are independent — a story quest can live in the farming
 * arc, a request can live in the fishing arc.
 */
export const questCategorySchema = z.enum([
  'story',
  'farming',
  'fishing',
  'crafting',
  'mining',
  'foraging',
  'exploration',
  'social',
  'combat',
]);
export type QuestCategory = z.infer<typeof questCategorySchema>;

export const questKindSchema = z.enum(['story', 'request', 'order']);
export type QuestKind = z.infer<typeof questKindSchema>;

/**
 * Objective kinds. Most are *event* objectives that accumulate as the player
 * acts (harvest/fish/forage/mine/craft/ship/gift/talk/visit). Two are *standing*
 * objectives re-evaluated from world state on each reconcile: `befriend` (a
 * relationship level for an NPC) and `have` (a quantity held in the bag).
 */
export const questObjectiveKindSchema = z.enum([
  'harvest',
  'fish',
  'forage',
  'mine',
  'craft',
  'ship',
  'gift',
  'talk',
  'visit',
  'befriend',
  'have',
]);
export type QuestObjectiveKind = z.infer<typeof questObjectiveKindSchema>;

export const questObjectiveSchema = z
  .object({
    kind: questObjectiveKindSchema,
    /** itemId / npcId / sceneKey depending on kind; null = "any". */
    target: z.string().min(1).nullable().default(null),
    count: z.number().int().positive().default(1),
    label: z.string().min(1),
  })
  .strict();
export type QuestObjective = z.infer<typeof questObjectiveSchema>;

export const questRewardSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('gold'), amount: z.number().int().positive() }).strict(),
  z
    .object({
      kind: z.literal('item'),
      itemId: idSchema,
      qty: z.number().int().positive(),
      quality: z.number().int().min(0).max(3).default(0),
    })
    .strict(),
  z.object({ kind: z.literal('recipe'), recipeId: idSchema }).strict(),
  z.object({ kind: z.literal('relationship'), npcId: idSchema, delta: z.number().int() }).strict(),
  z
    .object({
      kind: z.literal('flag'),
      flag: z.string().min(1),
      value: z.union([z.boolean(), z.number(), z.string()]),
    })
    .strict(),
]);
export type QuestReward = z.infer<typeof questRewardSchema>;

export const questSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    category: questCategorySchema,
    kind: questKindSchema.default('request'),
    /** NPC who hands out / receives the quest, if any. */
    giverNpcId: idSchema.nullable().default(null),
    objectives: z.array(questObjectiveSchema).min(1),
    rewards: z.array(questRewardSchema).default([]),
    /**
     * Optional countdown in in-game days. Timers NEVER fail story quests — the
     * engine ignores `limitDays` for `category === 'story'` / `kind === 'story'`
     * so a missed deadline can never break a story path (Prompt 054 acceptance).
     */
    limitDays: z.number().int().positive().nullable().default(null),
    prerequisiteQuestIds: z.array(idSchema).default([]),
    /** Story/tutorial quests activate themselves once prerequisites clear; requests wait to be accepted. */
    autoActivate: z.boolean().default(false),
    cancellable: z.boolean().default(false),
  })
  .strict();
export type Quest = z.infer<typeof questSchema>;

export const shopSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    npcId: idSchema.nullable().default(null),
    stockItemIds: z.array(idSchema).default([]),
  })
  .strict();
export type Shop = z.infer<typeof shopSchema>;

/**
 * Community restoration projects (Prompt 055). A civic project is delivered in
 * ordered phases; each phase requires the player to contribute items, money,
 * and/or hold a relationship level (a gate). Completing every phase finishes the
 * project, grants rewards, runs an opening ceremony (NPC reaction lines), and
 * sets `civic:<id>` complete so scenes can visibly alter the map + NPC schedules.
 */
export const contributionRequirementSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('item'), itemId: idSchema, qty: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal('gold'), amount: z.number().int().positive() }).strict(),
  // A gate, not a consumed contribution: the player must hold this relationship level.
  z.object({ kind: z.literal('relationship'), npcId: idSchema, level: z.number().int().positive() }).strict(),
]);
export type ContributionRequirement = z.infer<typeof contributionRequirementSchema>;

export const projectPhaseSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    requirements: z.array(contributionRequirementSchema).min(1),
  })
  .strict();
export type ProjectPhase = z.infer<typeof projectPhaseSchema>;

export const ceremonyReactionSchema = z
  .object({ npcId: idSchema, line: z.string().min(1) })
  .strict();
export type CeremonyReaction = z.infer<typeof ceremonyReactionSchema>;

export const projectSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    /** Scene whose map the completion visibly alters (e.g. "Town"). */
    region: z.string().min(1).default('Town'),
    giverNpcId: idSchema.nullable().default(null),
    phases: z.array(projectPhaseSchema).min(1),
    rewards: z.array(questRewardSchema).default([]),
    /** One-line blurb of what finishing the project opens up. */
    unlocks: z.string().min(1),
    /** Opening-ceremony reaction lines, played when the project completes. */
    ceremony: z.array(ceremonyReactionSchema).default([]),
  })
  .strict();
export type CivicProject = z.infer<typeof projectSchema>;

export const mapSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    region: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();
export type GameMap = z.infer<typeof mapSchema>;

export const dialogueSchema = z
  .object({
    id: idSchema,
    npcId: idSchema,
    lines: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type Dialogue = z.infer<typeof dialogueSchema>;

export interface GameContent {
  items: Item[];
  crops: Crop[];
  animals: Animal[];
  recipes: Recipe[];
  npcs: Npc[];
  skills: Skill[];
  weather: Weather[];
  festivals: Festival[];
  quests: Quest[];
  shops: Shop[];
  projects: CivicProject[];
  maps: GameMap[];
  dialogue: Dialogue[];
}
