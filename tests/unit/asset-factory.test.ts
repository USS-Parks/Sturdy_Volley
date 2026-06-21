import { describe, it, expect } from 'vitest';
import {
  createSwappable,
  canSwap,
  applySwap,
  revertSwap,
  activeMesh,
  semanticSnapshot,
  semanticUnchanged,
  type SemanticLayer,
} from '../../src/render/asset-factory';
import { validateAssetDescriptor } from '../../src/render/asset-contract';
import { ASSET_FIXTURES, FIXTURE_CHARACTER } from '../../src/render/asset-fixtures';

const SEMANTIC: SemanticLayer = { anchorIds: ['door', 'window'], collisionId: 'col-1', navId: 'nav-1' };
const mkEntity = () => createSwappable<string>({ id: 'e1', saveId: 'save-1', semantic: SEMANTIC, graybox: 'graybox-mesh' });

describe('asset factory — fixtures', () => {
  it('all five reference fixtures are contract-conformant', () => {
    expect(ASSET_FIXTURES).toHaveLength(5);
    for (const f of ASSET_FIXTURES) {
      const high = validateAssetDescriptor(f.manifest).filter((i) => i.severity === 'high');
      expect(high, `${f.key} should have no blocking issues: ${high.map((i) => i.code).join(',')}`).toEqual([]);
    }
  });
});

describe('asset factory — swap + revert', () => {
  it('swaps a conformant asset and preserves the semantic layer + save id', () => {
    const e = mkEntity();
    const before = semanticSnapshot(e);
    const r = applySwap(e, FIXTURE_CHARACTER, () => 'asset-mesh');
    expect(r.ok).toBe(true);
    expect(e.active).toBe('asset');
    expect(activeMesh(e)).toBe('asset-mesh');
    // The identity layer is untouched.
    expect(semanticUnchanged(before, semanticSnapshot(e))).toBe(true);
    expect(e.saveId).toBe('save-1');
  });

  it('reverts to the graybox fallback, identity still intact', () => {
    const e = mkEntity();
    const before = semanticSnapshot(e);
    applySwap(e, FIXTURE_CHARACTER, () => 'asset-mesh');
    revertSwap(e);
    expect(e.active).toBe('graybox');
    expect(activeMesh(e)).toBe('graybox-mesh');
    expect(semanticUnchanged(before, semanticSnapshot(e))).toBe(true);
  });

  it('refuses a non-conformant asset and keeps the graybox (asset-failure fallback)', () => {
    const e = mkEntity();
    let built = false;
    const bad = { ...FIXTURE_CHARACTER, triangleCount: 999999 };
    const r = applySwap(e, bad, () => { built = true; return 'asset-mesh'; });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'too-many-triangles')).toBe(true);
    expect(built, 'rejected asset never constructs geometry').toBe(false);
    expect(e.active).toBe('graybox');
    expect(activeMesh(e)).toBe('graybox-mesh');
  });

  it('canSwap mirrors the contract validator', () => {
    expect(canSwap(FIXTURE_CHARACTER).ok).toBe(true);
    expect(canSwap({ ...FIXTURE_CHARACTER, scale: 3 }).ok).toBe(false);
  });

  it('a low-severity-only issue (LODs) still swaps', () => {
    const e = mkEntity();
    const r = applySwap(e, { ...FIXTURE_CHARACTER, lodCount: 0 }, () => 'asset-mesh');
    expect(r.ok).toBe(true);
    expect(r.issues.some((i) => i.code === 'insufficient-lods')).toBe(true);
    expect(e.active).toBe('asset');
  });
});
