/**
 * Chunk content variants (WEF-04, master Prompt 035).
 *
 * Pure resolution of how a chunk's content changes with tide / season / weather
 * / restoration — **without** changing any stable anchor. The load-bearing
 * invariant (acceptance criterion + §3.1): the set of `anchorId`s a chunk
 * declares is constant across every variant state; only each anchor's
 * `present` flag and `appearance` key vary. Saves and cross-region transitions
 * reference anchor ids, so a low-tide reef and a high-tide reef are the same
 * persisted chunk with the same anchors — the tide just hides the crab and
 * submerges the piling.
 *
 * No Babylon import — the scene reads the resolved presence/appearance and
 * shows/hides the matching graybox mesh.
 */

import type { Season } from '../engine/timeSystem';
import type { Vec2 } from './topology';

export type Tide = 'low' | 'high';
export type WeatherKind = 'clear' | 'rain' | 'storm' | 'snow' | 'fog';

/** The environmental state that drives content variants. */
export interface VariantState {
  tide: Tide;
  season: Season;
  weather: WeatherKind;
  /** Town/region restoration progress, 0 (storm-worn) … N (rebuilt). */
  restoration: number;
}

export const DEFAULT_VARIANT_STATE: VariantState = {
  tide: 'low',
  season: 'spring',
  weather: 'clear',
  restoration: 0,
};

/**
 * One stable anchor within a chunk. The `id` and `kind` never change; the
 * optional rules below only flip `present` / pick an `appearance`.
 */
export interface ContentAnchor {
  /** Stable id — the save + transition identity. Unique within its chunk. */
  id: string;
  /** Semantic family (prop, dock, crab, stall, tree, …) — used for graybox. */
  kind: string;
  /** World-space position (XZ). */
  at: Vec2;
  /** Hide this anchor at the named tide (e.g. crab hidden at high tide). */
  hideOnTide?: Tide;
  /** Anchor appears only once restoration reaches this stage (town rebuild). */
  restorationMinStage?: number;
  /** Appearance key per season (snow-dusted, autumn, …); falls back to 'base'. */
  seasonAppearance?: Partial<Record<Season, string>>;
  /** Appearance key per weather; takes precedence over season when matched. */
  weatherAppearance?: Partial<Record<WeatherKind, string>>;
}

/** A chunk's authored content: its stable anchor set. */
export interface ChunkContentDef {
  /** Persistence id of the owning chunk (topology.chunkId). */
  chunkId: string;
  anchors: ContentAnchor[];
}

/** The resolved state of one anchor under a {@link VariantState}. */
export interface ResolvedAnchor {
  id: string;
  kind: string;
  at: Vec2;
  present: boolean;
  appearance: string;
}

/** Resolve a single anchor against a variant state. */
export function resolveAnchor(anchor: ContentAnchor, variant: VariantState): ResolvedAnchor {
  let present = true;
  if (anchor.hideOnTide && anchor.hideOnTide === variant.tide) present = false;
  if (anchor.restorationMinStage !== undefined && variant.restoration < anchor.restorationMinStage) present = false;

  let appearance = 'base';
  if (anchor.seasonAppearance && anchor.seasonAppearance[variant.season]) {
    appearance = anchor.seasonAppearance[variant.season] as string;
  }
  // Weather wins over season when it specifies an appearance.
  if (anchor.weatherAppearance && anchor.weatherAppearance[variant.weather]) {
    appearance = anchor.weatherAppearance[variant.weather] as string;
  }

  return { id: anchor.id, kind: anchor.kind, at: anchor.at, present, appearance };
}

/**
 * Resolve a chunk's full content. The returned array has exactly one entry per
 * declared anchor in declaration order — the anchor-id set is invariant across
 * every variant state, by construction. Only `present`/`appearance` differ.
 */
export function resolveChunkContent(def: ChunkContentDef, variant: VariantState): ResolvedAnchor[] {
  return def.anchors.map((a) => resolveAnchor(a, variant));
}

/** The stable anchor-id set of a chunk — never affected by the variant state. */
export function anchorIds(def: ChunkContentDef): string[] {
  return def.anchors.map((a) => a.id);
}
