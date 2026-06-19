import { z } from 'zod';
import { seasonSchema } from '../data/schemas';

/**
 * The save model. Versioned for future migrations (Prompt 041). Validated with
 * zod so corrupt or hand-edited saves fail with a readable message instead of
 * crashing mid-game.
 */
export const SAVE_VERSION = 1;

export const inventoryStackSchema = z
  .object({
    itemId: z.string(),
    qty: z.number().int().nonnegative(),
    quality: z.number().int().min(0).max(3).default(0),
  })
  .strict();
export type InventoryStack = z.infer<typeof inventoryStackSchema>;

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
        timeMinutes: z.number().int().min(0).max(24 * 60),
      })
      .strict(),
    location: z.object({ sceneKey: z.string().min(1) }).strict(),
    inventory: z.array(inventoryStackSchema),
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

export function createNewSave(opts: NewSaveOptions, now: number = Date.now()): SaveData {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    player: {
      name: opts.name.trim() || 'Coast Keeper',
      farmName: opts.farmName.trim() || 'Breakpoint Farm',
      farmType: opts.farmType ?? 'open-court',
    },
    calendar: { year: 1, season: 'spring', day: 1, timeMinutes: 6 * 60 },
    location: { sceneKey: 'Farm' },
    inventory: [],
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
