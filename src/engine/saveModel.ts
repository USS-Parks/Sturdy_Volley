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
    skills: z.record(z.string(), z.number()),
    flags: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])),
    mapState: z.record(z.string(), z.unknown()),
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
      'Farm:7,2': { kind: 'tree', itemId: 'driftwood', age: 0 },
      'Farm:8,3': { kind: 'tree', itemId: 'driftwood', age: 0 },
      'Farm:5,5': { kind: 'debris', itemId: 'driftwood', age: 0 },
    },
    relationships: {},
    skills: {},
    flags: {},
    mapState: {},
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
