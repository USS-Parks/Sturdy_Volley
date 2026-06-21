import { z } from 'zod';

/**
 * Player appearance / wardrobe (Prompt 060). Renderer-agnostic: appearance is a
 * small record of named *swatch ids* for three graybox body parts — the capsule
 * body, a knit beanie, and an accent band (the canonical protagonist's olive
 * shirt + red beanie + rust suspenders, §1.4). Each swatch resolves to an
 * RGB triple (0..1, matching Babylon `Color3`) in {@link resolveAppearanceColors};
 * the render layer (`src/render/player-appearance.ts`) turns those into materials.
 *
 * The full hero rig lands in Prompts 062–063 — until then the visible swap is the
 * graybox capsule's body colour plus the beanie/accent sub-meshes. Storing named
 * swatch ids (not raw colours) keeps the save small + forward-compatible: an
 * unknown id normalises back to the part default rather than corrupting the look.
 */

export const APPEARANCE_PARTS = ['body', 'beanie', 'accent'] as const;
export type AppearancePart = (typeof APPEARANCE_PARTS)[number];

export interface AppearanceSwatch {
  id: string;
  name: string;
  /** Diffuse RGB in 0..1, fed straight into a Babylon `Color3`. */
  rgb: readonly [number, number, number];
}

/**
 * The bounded swatch catalog. Kept in the engine (not the data-driven content
 * pipeline) because, like the camera profiles and the Theme-3 palette, these are
 * render-coupled cosmetic option lists rather than world content.
 */
export const APPEARANCE_SWATCHES: Record<AppearancePart, readonly AppearanceSwatch[]> = {
  body: [
    { id: 'harbor-blue', name: 'Harbor Blue', rgb: [0.18, 0.36, 0.54] },
    { id: 'olive-shirt', name: 'Olive Work-Shirt', rgb: [0.42, 0.45, 0.22] },
    { id: 'plum', name: 'Plum', rgb: [0.4, 0.24, 0.42] },
    { id: 'tide-teal', name: 'Tide Teal', rgb: [0.16, 0.45, 0.45] },
    { id: 'rust', name: 'Rust', rgb: [0.6, 0.3, 0.18] },
    { id: 'slate', name: 'Slate', rgb: [0.32, 0.36, 0.42] },
  ],
  beanie: [
    { id: 'red-knit', name: 'Red Knit', rgb: [0.7, 0.2, 0.18] },
    { id: 'forest', name: 'Forest', rgb: [0.2, 0.42, 0.26] },
    { id: 'mustard', name: 'Mustard', rgb: [0.78, 0.62, 0.2] },
    { id: 'cream', name: 'Cream', rgb: [0.85, 0.82, 0.7] },
    { id: 'berry', name: 'Berry', rgb: [0.5, 0.16, 0.3] },
  ],
  accent: [
    { id: 'rust-suspenders', name: 'Rust Suspenders', rgb: [0.6, 0.3, 0.18] },
    { id: 'sky', name: 'Sky', rgb: [0.5, 0.72, 0.85] },
    { id: 'gold', name: 'Gold', rgb: [0.8, 0.66, 0.2] },
    { id: 'sage', name: 'Sage', rgb: [0.5, 0.6, 0.4] },
    { id: 'shell', name: 'Shell', rgb: [0.9, 0.85, 0.78] },
  ],
};

export interface AppearanceState {
  body: string;
  beanie: string;
  accent: string;
}

/**
 * Canonical-protagonist default (§1.4): the body keeps the existing graybox
 * `PALETTE.player` harbor blue so scenes without a wardrobe stay visually
 * consistent, paired with the canonical red beanie + rust accent.
 */
export const DEFAULT_APPEARANCE: AppearanceState = {
  body: 'harbor-blue',
  beanie: 'red-knit',
  accent: 'rust-suspenders',
};

/** Strict zod schema; each field defaults so pre-Prompt-060 saves parse cleanly. */
export const appearanceStateSchema = z
  .object({
    body: z.string().default(DEFAULT_APPEARANCE.body),
    beanie: z.string().default(DEFAULT_APPEARANCE.beanie),
    accent: z.string().default(DEFAULT_APPEARANCE.accent),
  })
  .strict();

function swatchExists(part: AppearancePart, id: string): boolean {
  return APPEARANCE_SWATCHES[part].some((s) => s.id === id);
}

/** Resolve a swatch (falling back to the part default for an unknown id). */
export function swatchFor(part: AppearancePart, id: string): AppearanceSwatch {
  const list = APPEARANCE_SWATCHES[part];
  return list.find((s) => s.id === id) ?? list.find((s) => s.id === DEFAULT_APPEARANCE[part])!;
}

/** Coerce an appearance so every part names a real swatch. */
export function normalizeAppearance(a: AppearanceState): AppearanceState {
  return {
    body: swatchExists('body', a.body) ? a.body : DEFAULT_APPEARANCE.body,
    beanie: swatchExists('beanie', a.beanie) ? a.beanie : DEFAULT_APPEARANCE.beanie,
    accent: swatchExists('accent', a.accent) ? a.accent : DEFAULT_APPEARANCE.accent,
  };
}

/**
 * Return a new appearance with one part changed. An unknown part or swatch id is
 * a no-op (returns the input unchanged) so bad input can never corrupt the look.
 */
export function setAppearancePart(
  a: AppearanceState,
  part: AppearancePart,
  swatchId: string,
): AppearanceState {
  if (!APPEARANCE_PARTS.includes(part) || !swatchExists(part, swatchId)) return a;
  return { ...a, [part]: swatchId };
}

export interface ResolvedAppearanceColors {
  body: readonly [number, number, number];
  beanie: readonly [number, number, number];
  accent: readonly [number, number, number];
}

/** Resolve every part to an RGB triple for the render layer. */
export function resolveAppearanceColors(a: AppearanceState): ResolvedAppearanceColors {
  const n = normalizeAppearance(a);
  return {
    body: swatchFor('body', n.body).rgb,
    beanie: swatchFor('beanie', n.beanie).rgb,
    accent: swatchFor('accent', n.accent).rgb,
  };
}

export const APPEARANCE_PART_LABELS: Record<AppearancePart, string> = {
  body: 'Outfit',
  beanie: 'Beanie',
  accent: 'Accent',
};

export interface WardrobeSwatchRow {
  id: string;
  name: string;
  active: boolean;
}
export interface WardrobePartRow {
  part: AppearancePart;
  label: string;
  current: string;
  swatches: WardrobeSwatchRow[];
}

/** Project the catalog + current selection into renderer-friendly wardrobe rows. */
export function buildWardrobeParts(a: AppearanceState): WardrobePartRow[] {
  const n = normalizeAppearance(a);
  return APPEARANCE_PARTS.map((part) => ({
    part,
    label: APPEARANCE_PART_LABELS[part],
    current: n[part],
    swatches: APPEARANCE_SWATCHES[part].map((s) => ({
      id: s.id,
      name: s.name,
      active: s.id === n[part],
    })),
  }));
}
