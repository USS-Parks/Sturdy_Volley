import { z } from 'zod';
import { seasonSchema } from '../data/schemas';

/**
 * The save model. Versioned for future migrations (Prompt 041). Validated with
 * zod so corrupt or hand-edited saves fail with a readable message instead of
 * crashing mid-game.
 *
 * v2 (Prompt 007): inventory becomes a Container { slots, capacity } shared by
 * the player, chests, and the shipping bin. The hotbar is the first
 * hotbarSize slots of the player inventory.
 */
export const SAVE_VERSION = 3;

export const inventoryStackSchema = z
  .object({
    itemId: z.string(),
    qty: z.number().int().nonnegative(),
    quality: z.number().int().min(0).max(3).default(0),
  })
  .strict();
export type InventoryStack = z.infer<typeof inventoryStackSchema>;

export const plantingSchema = z
  .object({
    cropId: z.string(),
    daysGrown: z.number().int().nonnegative(),
    watered: z.boolean(),
    harvests: z.number().int().nonnegative(),
  })
  .strict();
export type Planting = z.infer<typeof plantingSchema>;

export const containerSchema = z
  .object({
    slots: z.array(inventoryStackSchema.nullable()),
    capacity: z.number().int().positive(),
  })
  .strict()
  .refine((c) => c.slots.length === c.capacity, {
    message: 'container slots length must equal capacity',
  });
export type Container = z.infer<typeof containerSchema>;

/**
 * Per-quest runtime progress (Prompt 054). `objectives` is a parallel counter
 * array aligned to the quest definition's objectives; the quest engine tolerates
 * a length mismatch (a definition that changed shape) by re-seeding the counters.
 * Added as a defaulted field, so v3 saves written before quests existed parse
 * cleanly to `{}` without a version bump (real migration lands in Prompt 067).
 */
export const questStateSchema = z
  .object({
    status: z.enum(['locked', 'available', 'active', 'complete', 'failed']),
    objectives: z.array(z.number().int().nonnegative()),
    startedDay: z.number().int().nonnegative().nullable().default(null),
    completedDay: z.number().int().nonnegative().nullable().default(null),
  })
  .strict();
export type QuestState = z.infer<typeof questStateSchema>;
export type QuestRecord = Record<string, QuestState>;

export const saveSchema = z
  .object({
    version: z.literal(SAVE_VERSION),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    player: z
      .object({
        name: z.string().min(1).max(40),
        farmName: z.string().min(1).max(40),
        farmType: z.string().min(1),
      })
      .strict(),
    calendar: z
      .object({
        year: z.number().int().positive(),
        season: seasonSchema,
        day: z.number().int().min(1).max(28),
        // Past-midnight hours up to 2:00 AM (26 * 60) are valid; the day collapses there.
        timeMinutes: z.number().int().min(0).max(26 * 60),
      })
      .strict(),
    location: z.object({ sceneKey: z.string().min(1) }).strict(),
    wallet: z.object({ gold: z.number().int().nonnegative() }).strict(),
    inventory: containerSchema,
    hotbarSize: z.number().int().positive(),
    chests: z.record(z.string(), containerSchema),
    shippingBin: containerSchema,
    tilledCells: z.array(z.string()),
    plantings: z.record(z.string(), plantingSchema),
    toolLevels: z.record(z.string(), z.number().int().min(0).max(3)),
    worldEntities: z.record(
      z.string(),
      z
        .object({
          kind: z.enum(['forage', 'tree', 'stump', 'grass', 'debris']),
          itemId: z.string().nullable(),
          age: z.number().int().nonnegative(),
          meta: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
        })
        .strict(),
    ),
    relationships: z.record(z.string(), z.number()),
    giftsThisWeek: z.record(z.string(), z.number().int().nonnegative()),
    knownRecipeIds: z.array(z.string()),
    skills: z.record(z.string(), z.number()),
    professions: z.record(z.string(), z.string()).default({}),
    mastery: z
      .object({
        totalMasteryXp: z.number().nonnegative(),
        ranks: z.record(z.string(), z.number().int().min(0).max(5)),
      })
      .strict()
      .default({ totalMasteryXp: 0, ranks: {} }),
    flags: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])),
    quests: z.record(z.string(), questStateSchema).default({}),
    mapState: z.record(z.string(), z.unknown()),
    machines: z
      .record(
        z.string(),
        z
          .object({
            id: z.string(),
            kind: z.enum(['brine-barrel', 'herb-dryer', 'cheese-drum', 'honey-spinner', 'oil-press']),
            sceneKey: z.string(),
            x: z.number(),
            z: z.number(),
            startMinutes: z.number().nullable(),
            recipeIndex: z.number().int().nonnegative().nullable(),
          })
          .strict(),
      )
      .default({}),
    fishingAssist: z.boolean().default(false),
    firstCatchSeen: z.record(z.string(), z.boolean()).default({}),
    reef: z
      .object({
        health: z.number().min(0).max(1),
        fragmentsDonated: z.number().int().nonnegative(),
        tier: z.number().int().min(0).max(4),
      })
      .strict()
      .default({ health: 0, fragmentsDonated: 0, tier: 0 }),
    mineProgress: z
      .object({
        deepestLevel: z.number().int().nonnegative(),
        currentLevel: z.number().int().nonnegative(),
        checkpoints: z.array(z.number().int().nonnegative()),
        /** Prompt 025: per-save lantern fuel (drains at lighting ≥ 3). */
        lanternFuel: z.number().nonnegative().default(600),
        /** Prompt 025: deterministic seed for room layout + boss roll. */
        seed: z.number().int().default(424242),
        /** Prompt 025: true once the boss has been defeated. */
        bossDefeated: z.boolean().default(false),
      })
      .strict()
      .default({ deepestLevel: 0, currentLevel: 0, checkpoints: [], lanternFuel: 600, seed: 424242, bossDefeated: false }),
    crabPots: z
      .record(
        z.string(),
        z
          .object({
            id: z.string(),
            sceneKey: z.string(),
            x: z.number(),
            z: z.number(),
            baited: z.boolean(),
            startedAt: z.number().nullable(),
            catchItemId: z.string().nullable(),
          })
          .strict(),
      )
      .default({}),
    pet: z
      .object({
        kind: z.enum(['tide-cat', 'bay-dog']),
        name: z.string().min(1),
        affection: z.number().int().min(0).max(1000),
        pettedToday: z.boolean(),
        bowlFilledToday: z.boolean(),
        collar: z.enum(['red', 'kelp', 'shell']).nullable(),
        x: z.number(),
        z: z.number(),
        targetX: z.number(),
        targetZ: z.number(),
        timeOnTarget: z.number().nonnegative(),
      })
      .strict()
      .nullable()
      .default(null),
    animals: z
      .record(
        z.string(),
        z
          .object({
            id: z.string(),
            kind: z.enum(['mooncalf-hen', 'bluff-goat']),
            name: z.string().min(1),
            habitat: z.enum(['coop', 'barn', 'pasture']),
            affection: z.number().int().min(0).max(1000),
            fedToday: z.boolean(),
            pettedToday: z.boolean(),
            daysSinceProduce: z.number().int().nonnegative(),
            daysSincePetted: z.number().int().nonnegative(),
            outside: z.boolean(),
          })
          .strict(),
      )
      .default({}),
  })
  .strict();
export type SaveData = z.infer<typeof saveSchema>;

export interface NewSaveOptions {
  name: string;
  farmName: string;
  farmType?: string;
}

export const DEFAULT_INVENTORY_CAPACITY = 24;
export const DEFAULT_HOTBAR_SIZE = 8;
export const DEFAULT_SHIPPING_BIN_CAPACITY = 16;
export const DEFAULT_STARTER_CHEST_CAPACITY = 24;

function emptyContainer(capacity: number): Container {
  return { slots: new Array(capacity).fill(null), capacity };
}

export function createNewSave(opts: NewSaveOptions, now: number = Date.now()): SaveData {
  const inventory = emptyContainer(DEFAULT_INVENTORY_CAPACITY);
  // A friendly handful of starter seeds in the first hotbar slot — gives the
  // first day of play something to do without forcing a shop visit.
  inventory.slots[0] = { itemId: 'bell-pea-seeds', qty: 5, quality: 0 };
  inventory.slots[1] = { itemId: 'hay', qty: 8, quality: 0 };
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    player: {
      name: opts.name.trim() || 'Coast Keeper',
      farmName: opts.farmName.trim() || 'Breakpoint Farm',
      farmType: opts.farmType ?? 'open-meadow',
    },
    calendar: { year: 1, season: 'spring', day: 1, timeMinutes: 6 * 60 },
    location: { sceneKey: 'Farm' },
    wallet: { gold: 500 },
    inventory,
    hotbarSize: DEFAULT_HOTBAR_SIZE,
    chests: {
      'farm-porch-chest': emptyContainer(DEFAULT_STARTER_CHEST_CAPACITY),
    },
    shippingBin: emptyContainer(DEFAULT_SHIPPING_BIN_CAPACITY),
    tilledCells: [],
    plantings: {},
    toolLevels: {
      hoe: 0,
      'watering-can': 0,
      axe: 0,
      pick: 0,
      sickle: 0,
      'fishing-rod': 0,
      'defender-blade': 0,
    },
    worldEntities: {
      // Trees on the bluff side — axe (hardness ≥ 2) chops to stump + driftwood.
      'Farm:tree-a': { kind: 'tree', itemId: 'driftwood', age: 0 },
      'Farm:tree-b': { kind: 'tree', itemId: 'driftwood', age: 0 },
      // Storm debris near the soil plot — any tool clears for driftwood.
      'Farm:debris-a': { kind: 'debris', itemId: 'driftwood', age: 0 },
      // First-day visible forage — gives the gather step something tangible.
      'Farm:forage-shell-a': { kind: 'forage', itemId: 'tide-shell', age: 0 },
      'Farm:forage-shell-b': { kind: 'forage', itemId: 'tide-shell', age: 0 },
      'Farm:forage-drift-a': { kind: 'forage', itemId: 'driftwood', age: 0 },
      // Driftwood Beach — visible tide-line shells + storm-drift sticks.
      'Beach:shell-a': { kind: 'forage', itemId: 'tide-shell', age: 0 },
      'Beach:shell-b': { kind: 'forage', itemId: 'tide-shell', age: 0 },
      'Beach:shell-c': { kind: 'forage', itemId: 'tide-shell', age: 0 },
      'Beach:drift-a': { kind: 'forage', itemId: 'driftwood', age: 0 },
      'Beach:drift-b': { kind: 'forage', itemId: 'driftwood', age: 0 },
    },
    relationships: {},
    giftsThisWeek: {},
    knownRecipeIds: [
      'goat-cheese',
      'garden-omelet',
      'salt-from-shells',
      'bell-pea-stew',
      'turnip-soup',
      'driftwood-plank',
      'shell-charm',
    ],
    skills: {},
    professions: {},
    mastery: { totalMasteryXp: 0, ranks: {} },
    flags: {},
    quests: {},
    mapState: {},
    machines: defaultFarmMachines(),
    animals: defaultFarmAnimals(),
    fishingAssist: false,
    firstCatchSeen: {},
    reef: { health: 0, fragmentsDonated: 0, tier: 0 },
    mineProgress: { deepestLevel: 0, currentLevel: 0, checkpoints: [0], lanternFuel: 600, seed: 424242, bossDefeated: false },
    crabPots: {},
    pet: {
      kind: 'tide-cat',
      name: 'Pixel',
      affection: 100,
      pettedToday: false,
      bowlFilledToday: true,
      collar: null,
      x: -8,
      z: -4,
      targetX: -8,
      targetZ: -4,
      timeOnTarget: 0,
    },
  };
}

/**
 * Default coop + barn occupants on Day 1. One named hen + one named goat
 * lets the player exercise the full feeding / petting / produce loop
 * without having to acquire animals first.
 */
function defaultFarmAnimals(): Record<string, import('./animals').AnimalInstance> {
  return {
    'Farm:hen:1': {
      id: 'Farm:hen:1',
      kind: 'mooncalf-hen',
      name: 'Pip',
      habitat: 'coop',
      affection: 150,
      fedToday: true,
      pettedToday: false,
      daysSinceProduce: 1,
      daysSincePetted: 0,
      outside: false,
    },
    'Farm:goat:1': {
      id: 'Farm:goat:1',
      kind: 'bluff-goat',
      name: 'Clover',
      habitat: 'barn',
      affection: 150,
      fedToday: true,
      pettedToday: false,
      daysSinceProduce: 1,
      daysSincePetted: 0,
      outside: false,
    },
  };
}

/**
 * Initial machine cluster on the Farm. The Prompt 018 acceptance set ships
 * five kinds; placing one of each near the farmhouse gives the player a
 * working machine pad on Day 1 without forcing them to craft and place
 * any first.
 */
function defaultFarmMachines(): Record<string, import('./machines').MachineState> {
  return {
    'Farm:brine-barrel:1': {
      id: 'Farm:brine-barrel:1',
      kind: 'brine-barrel',
      sceneKey: 'Farm',
      x: -4.5,
      z: -8.4,
      startMinutes: null,
      recipeIndex: null,
    },
    'Farm:herb-dryer:1': {
      id: 'Farm:herb-dryer:1',
      kind: 'herb-dryer',
      sceneKey: 'Farm',
      x: -2.5,
      z: -8.4,
      startMinutes: null,
      recipeIndex: null,
    },
    'Farm:cheese-drum:1': {
      id: 'Farm:cheese-drum:1',
      kind: 'cheese-drum',
      sceneKey: 'Farm',
      x: -0.5,
      z: -8.4,
      startMinutes: null,
      recipeIndex: null,
    },
    'Farm:honey-spinner:1': {
      id: 'Farm:honey-spinner:1',
      kind: 'honey-spinner',
      sceneKey: 'Farm',
      x: 1.5,
      z: -8.4,
      startMinutes: null,
      recipeIndex: null,
    },
    'Farm:oil-press:1': {
      id: 'Farm:oil-press:1',
      kind: 'oil-press',
      sceneKey: 'Farm',
      x: 3.5,
      z: -8.4,
      startMinutes: null,
      recipeIndex: null,
    },
  };
}

export function serializeSave(data: SaveData): string {
  return JSON.stringify(data, null, 2);
}

/** Parse + validate a save string. Throws Error with a readable message. */
export function parseSave(json: string): SaveData {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Save file is not valid JSON.');
  }
  const result = saveSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join('.') || '(root)';
    throw new Error(`Save file is invalid: ${path} ${first?.message ?? ''}`.trim());
  }
  return result.data;
}
