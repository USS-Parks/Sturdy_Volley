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
    affectsCourt: z.boolean().default(false),
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

export const questSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    category: z.enum([
      'story',
      'farming',
      'fishing',
      'crafting',
      'exploration',
      'social',
      'volleyball',
    ]),
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
  maps: GameMap[];
  dialogue: Dialogue[];
}
