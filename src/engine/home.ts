import { z } from 'zod';
import type { SaveData } from './saveModel';
import type { Furniture, GameContent } from '../data/schemas';

/**
 * Home customization (Prompt 060). Three render-coupled cosmetic systems for the
 * farmhouse interior, plus the furniture-catalog projections that drive the
 * Decorate tab:
 *
 *  - **Surfaces** — wallpaper (walls) + flooring (floor). Free to swap (you
 *    already own the paint); the chosen finish recolours the live interior.
 *  - **Renovations** — one-time gold upgrades that each add a bespoke visible
 *    feature to the room (loft shelf, bay window, stone hearth).
 *  - **Furniture** — the placeable catalog (`furniture.json`), bought with gold
 *    and dropped on the floor via the placement engine in `crafting.ts`.
 *
 * Per-scene home state lives in a top-level `save.home[sceneKey]` record, kept
 * separate from `save.mapState[...].placements` so neither write clobbers the
 * other. Like the festivals/mail/buffs fields it is *defaulted*, so pre-Prompt-060
 * saves parse cleanly with no `SAVE_VERSION` bump (real migration is Prompt 067).
 */

export interface ColorSwatch {
  id: string;
  name: string;
  /** Diffuse RGB 0..1 (Babylon `Color3`). */
  rgb: readonly [number, number, number];
}

/** Wall finishes. The default matches the existing graybox wall colour (PALETTE.cliff). */
export const WALLPAPER_SWATCHES: readonly ColorSwatch[] = [
  { id: 'plaster-grey', name: 'Plaster Grey', rgb: [0.37, 0.34, 0.31] },
  { id: 'sage-wash', name: 'Sage Wash', rgb: [0.46, 0.52, 0.4] },
  { id: 'sky-wash', name: 'Sky Wash', rgb: [0.52, 0.62, 0.72] },
  { id: 'rose-wash', name: 'Rose Wash', rgb: [0.66, 0.46, 0.46] },
  { id: 'navy-panel', name: 'Navy Panel', rgb: [0.22, 0.27, 0.38] },
  { id: 'cedar-board', name: 'Cedar Board', rgb: [0.6, 0.42, 0.28] },
];

/** Floor finishes. The default matches the existing graybox floor colour (PALETTE.wood). */
export const FLOORING_SWATCHES: readonly ColorSwatch[] = [
  { id: 'cedar-plank', name: 'Cedar Plank', rgb: [0.71, 0.46, 0.29] },
  { id: 'slate-tile', name: 'Slate Tile', rgb: [0.4, 0.42, 0.46] },
  { id: 'sea-glass-tile', name: 'Sea-Glass Tile', rgb: [0.34, 0.55, 0.55] },
  { id: 'woven-rush', name: 'Woven Rush', rgb: [0.7, 0.62, 0.4] },
  { id: 'painted-checker', name: 'Painted Checker', rgb: [0.8, 0.78, 0.72] },
];

export const DEFAULT_WALLPAPER = WALLPAPER_SWATCHES[0]!.id;
export const DEFAULT_FLOORING = FLOORING_SWATCHES[0]!.id;

export type SurfaceKind = 'wallpaper' | 'flooring';

export function surfaceSwatches(kind: SurfaceKind): readonly ColorSwatch[] {
  return kind === 'wallpaper' ? WALLPAPER_SWATCHES : FLOORING_SWATCHES;
}

function swatchExists(kind: SurfaceKind, id: string): boolean {
  return surfaceSwatches(kind).some((s) => s.id === id);
}

export function surfaceSwatch(kind: SurfaceKind, id: string): ColorSwatch {
  const list = surfaceSwatches(kind);
  const fallback = kind === 'wallpaper' ? DEFAULT_WALLPAPER : DEFAULT_FLOORING;
  return list.find((s) => s.id === id) ?? list.find((s) => s.id === fallback)!;
}

/** A one-time gold upgrade. `effect` is the key the InteriorScene renders. */
export interface RenovationDef {
  id: string;
  name: string;
  description: string;
  price: number;
}

export const RENOVATIONS: readonly RenovationDef[] = [
  {
    id: 'loft-shelf',
    name: 'Loft Shelf',
    description: 'A long display shelf high on the west wall for curios and keepsakes.',
    price: 600,
  },
  {
    id: 'bay-window',
    name: 'Bay Window',
    description: 'A wide window seat that pours warm light across the south wall.',
    price: 900,
  },
  {
    id: 'stone-hearth',
    name: 'Stone Hearth',
    description: 'A broad stone surround and a bigger, brighter fire at the hearth.',
    price: 750,
  },
];

export function renovationDef(id: string): RenovationDef | undefined {
  return RENOVATIONS.find((r) => r.id === id);
}

export const homeSceneStateSchema = z
  .object({
    wallpaper: z.string().default(DEFAULT_WALLPAPER),
    flooring: z.string().default(DEFAULT_FLOORING),
    renovations: z.array(z.string()).default([]),
  })
  .strict();
export type HomeSceneState = z.infer<typeof homeSceneStateSchema>;

/** Read the per-scene home state, normalising unknown surface ids to the default. */
export function getHomeState(save: SaveData, sceneKey: string): HomeSceneState {
  const raw = (save.home ?? {})[sceneKey];
  const wallpaper = raw && swatchExists('wallpaper', raw.wallpaper) ? raw.wallpaper : DEFAULT_WALLPAPER;
  const flooring = raw && swatchExists('flooring', raw.flooring) ? raw.flooring : DEFAULT_FLOORING;
  const renovations = raw && Array.isArray(raw.renovations) ? [...raw.renovations] : [];
  return { wallpaper, flooring, renovations };
}

function writeHomeState(save: SaveData, sceneKey: string, next: HomeSceneState): void {
  if (!save.home) save.home = {};
  save.home[sceneKey] = next;
}

/** Switch a wall/floor finish (free cosmetic swap). Unknown id is a no-op. */
export function setSurface(save: SaveData, sceneKey: string, kind: SurfaceKind, id: string): boolean {
  if (!swatchExists(kind, id)) return false;
  const state = getHomeState(save, sceneKey);
  writeHomeState(save, sceneKey, { ...state, [kind]: id });
  return true;
}

export function hasRenovation(save: SaveData, sceneKey: string, id: string): boolean {
  return getHomeState(save, sceneKey).renovations.includes(id);
}

export interface RenovationResult {
  accepted: boolean;
  reason?: 'unknown' | 'already-built' | 'cant-afford';
}

/** Buy a renovation: deduct gold once, record it on the scene's home state. */
export function purchaseRenovation(save: SaveData, sceneKey: string, id: string): RenovationResult {
  const def = renovationDef(id);
  if (!def) return { accepted: false, reason: 'unknown' };
  const state = getHomeState(save, sceneKey);
  if (state.renovations.includes(id)) return { accepted: false, reason: 'already-built' };
  if (save.wallet.gold < def.price) return { accepted: false, reason: 'cant-afford' };
  save.wallet.gold -= def.price;
  writeHomeState(save, sceneKey, { ...state, renovations: [...state.renovations, id] });
  return { accepted: true };
}

/* Furniture catalog projections ------------------------------------------- */

export const FURNITURE_CATEGORY_LABELS: Record<Furniture['category'], string> = {
  seat: 'Seat',
  table: 'Table',
  shelf: 'Shelf',
  rug: 'Rug',
  lamp: 'Lamp',
  plant: 'Plant',
  banner: 'Banner',
  'trophy-shelf': 'Trophy Shelf',
  curio: 'Curio',
};

export function loadFurnitureFromContent(content: GameContent): readonly Furniture[] {
  return content.furniture;
}

export function furnitureById(content: GameContent): ReadonlyMap<string, Furniture> {
  return new Map(content.furniture.map((f) => [f.id, f] as const));
}

export interface DecorateRow {
  id: string;
  name: string;
  categoryLabel: string;
  price: number;
  affordable: boolean;
}

export function buildDecorateRows(furniture: readonly Furniture[], gold: number): DecorateRow[] {
  return furniture.map((f) => ({
    id: f.id,
    name: f.name,
    categoryLabel: FURNITURE_CATEGORY_LABELS[f.category],
    price: f.price,
    affordable: gold >= f.price,
  }));
}

export interface SurfaceRow {
  id: string;
  name: string;
  active: boolean;
}

export function buildSurfaceRows(kind: SurfaceKind, currentId: string): SurfaceRow[] {
  return surfaceSwatches(kind).map((s) => ({ id: s.id, name: s.name, active: s.id === currentId }));
}

export interface RenovationRow {
  id: string;
  name: string;
  description: string;
  price: number;
  owned: boolean;
  affordable: boolean;
}

export function buildRenovationRows(save: SaveData, sceneKey: string): RenovationRow[] {
  const state = getHomeState(save, sceneKey);
  return RENOVATIONS.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    price: r.price,
    owned: state.renovations.includes(r.id),
    affordable: save.wallet.gold >= r.price,
  }));
}

/* Trophy / curio milestones ----------------------------------------------- */

export interface TrophyMilestone {
  id: string;
  name: string;
  earned: (save: SaveData) => boolean;
}

/**
 * Read-only progress badges shown on a placed trophy/curio shelf. Derived from
 * concrete save state — placing the shelf never mutates anything; the shelf simply
 * reflects how far the player has come.
 */
export const TROPHY_MILESTONES: readonly TrophyMilestone[] = [
  {
    id: 'quester',
    name: 'First Quest Complete',
    earned: (s) => Object.values(s.quests).some((q) => q.status === 'complete'),
  },
  {
    id: 'restorer',
    name: 'Community Restorer',
    earned: (s) => Object.values(s.projects).some((p) => p.complete),
  },
  {
    id: 'festival-goer',
    name: 'Festival Goer',
    earned: (s) => Object.values(s.festivals).some((f) => f.attendedYear !== null),
  },
  {
    id: 'cook',
    name: 'Seasoned Cook',
    earned: (s) => s.knownRecipeIds.length >= 10,
  },
  {
    id: 'friend',
    name: 'Five Hearts',
    earned: (s) => Object.values(s.relationships).some((v) => v >= 500),
  },
  {
    id: 'spelunker',
    name: 'Cavern Delver',
    earned: (s) => s.mineProgress.deepestLevel >= 5,
  },
  {
    id: 'reef-keeper',
    name: 'Reef Keeper',
    earned: (s) => s.reef.tier >= 1,
  },
  {
    id: 'saver',
    name: 'Coin Saver',
    earned: (s) => s.wallet.gold >= 2000,
  },
];

export interface EarnedTrophy {
  id: string;
  name: string;
}

export function earnedTrophies(save: SaveData): EarnedTrophy[] {
  return TROPHY_MILESTONES.filter((m) => m.earned(save)).map((m) => ({ id: m.id, name: m.name }));
}
