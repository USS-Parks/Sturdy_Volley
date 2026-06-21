/**
 * Asset swap factory (WEF-11b, master Prompt 051). Pure + generic over the mesh
 * type `M` (so the swap-state logic is unit-testable with a mock mesh, and the
 * scene binds `M = Babylon Mesh`). The factory swaps a graybox's **render
 * geometry** for a validated production asset while the entity's **semantic
 * layer** — anchors, collision proxy, navigation reference, and save identity —
 * is never touched. The graybox is retained as a development + asset-failure
 * fallback, and every swap is reversible.
 *
 * An asset is swapped in only when it passes the Prompt 050 contract
 * (`validateAssetDescriptor`); a non-conformant manifest is refused and the
 * graybox stays — so finished art can never silently break collision, navigation,
 * anchors, scale, or save identity (§0.10).
 */
import { validateAssetDescriptor, type AssetDescriptor, type AssetIssue } from './asset-contract';

/** The identity layer a swap must preserve — separate from render geometry. */
export interface SemanticLayer {
  /** Stable interaction/transition anchor ids. */
  anchorIds: string[];
  /** Collision-proxy id (never the render mesh). */
  collisionId: string;
  /** Navigation reference id. */
  navId: string;
}

/** An entity whose visible mesh can swap graybox ↔ asset, keeping its identity. */
export interface SwappableEntity<M> {
  id: string;
  /** Stable save identifier — unchanged by any swap. */
  saveId: string;
  semantic: SemanticLayer;
  graybox: M;
  asset: M | null;
  active: 'graybox' | 'asset';
}

export interface SwapResult {
  ok: boolean;
  issues: AssetIssue[];
}

/** Whether a manifest is conformant enough to swap in (no HIGH issues). */
export function canSwap(manifest: AssetDescriptor): SwapResult {
  const issues = validateAssetDescriptor(manifest);
  return { ok: issues.every((i) => i.severity !== 'high'), issues };
}

export function createSwappable<M>(opts: {
  id: string;
  saveId: string;
  semantic: SemanticLayer;
  graybox: M;
}): SwappableEntity<M> {
  return { id: opts.id, saveId: opts.saveId, semantic: opts.semantic, graybox: opts.graybox, asset: null, active: 'graybox' };
}

/**
 * Swap the entity to a validated asset. `buildAsset` is only called when the
 * manifest is conformant (so a rejected asset never even constructs geometry).
 * The semantic layer + save id are left untouched; the graybox is retained.
 */
export function applySwap<M>(entity: SwappableEntity<M>, manifest: AssetDescriptor, buildAsset: () => M): SwapResult {
  const r = canSwap(manifest);
  if (r.ok) {
    entity.asset = buildAsset();
    entity.active = 'asset';
  }
  return r;
}

/** Revert to the graybox fallback (always succeeds). */
export function revertSwap<M>(entity: SwappableEntity<M>): void {
  entity.active = 'graybox';
}

/** The mesh that should currently render for the entity. */
export function activeMesh<M>(entity: SwappableEntity<M>): M {
  return entity.active === 'asset' && entity.asset ? entity.asset : entity.graybox;
}

/** Snapshot the preserved layer (for before/after equality assertions). */
export function semanticSnapshot<M>(entity: SwappableEntity<M>): { saveId: string; semantic: SemanticLayer } {
  return { saveId: entity.saveId, semantic: { anchorIds: [...entity.semantic.anchorIds], collisionId: entity.semantic.collisionId, navId: entity.semantic.navId } };
}

/** Whether two semantic snapshots are identical (a swap must never change them). */
export function semanticUnchanged(
  a: { saveId: string; semantic: SemanticLayer },
  b: { saveId: string; semantic: SemanticLayer },
): boolean {
  return (
    a.saveId === b.saveId &&
    a.semantic.collisionId === b.semantic.collisionId &&
    a.semantic.navId === b.semantic.navId &&
    a.semantic.anchorIds.length === b.semantic.anchorIds.length &&
    a.semantic.anchorIds.every((id, i) => id === b.semantic.anchorIds[i])
  );
}
