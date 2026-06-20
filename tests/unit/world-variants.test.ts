import { describe, it, expect } from 'vitest';
import {
  DEFAULT_VARIANT_STATE,
  anchorIds,
  resolveAnchor,
  resolveChunkContent,
  type ChunkContentDef,
  type ContentAnchor,
  type VariantState,
} from '../../src/world/variants';
import type { Season } from '../../src/engine/timeSystem';

const tidePool: ContentAnchor = { id: 'a:tide', kind: 'tide-pool', at: { x: 0, z: 0 }, hideOnTide: 'high' };
const stall: ContentAnchor = { id: 'a:stall', kind: 'market-stall', at: { x: 1, z: 1 }, restorationMinStage: 2 };
const tree: ContentAnchor = {
  id: 'a:tree',
  kind: 'tree',
  at: { x: 2, z: 2 },
  seasonAppearance: { winter: 'snow', fall: 'autumn' },
  weatherAppearance: { storm: 'wind' },
};

const DEF: ChunkContentDef = { chunkId: 'willa-crick#0,0', anchors: [tidePool, stall, tree] };

const variant = (over: Partial<VariantState> = {}): VariantState => ({ ...DEFAULT_VARIANT_STATE, ...over });

describe('variant resolution — presence', () => {
  it('hides a tide pool at high tide, shows it at low tide', () => {
    expect(resolveAnchor(tidePool, variant({ tide: 'low' })).present).toBe(true);
    expect(resolveAnchor(tidePool, variant({ tide: 'high' })).present).toBe(false);
  });

  it('gates a restoration anchor on the rebuild stage', () => {
    expect(resolveAnchor(stall, variant({ restoration: 0 })).present).toBe(false);
    expect(resolveAnchor(stall, variant({ restoration: 1 })).present).toBe(false);
    expect(resolveAnchor(stall, variant({ restoration: 2 })).present).toBe(true);
    expect(resolveAnchor(stall, variant({ restoration: 5 })).present).toBe(true);
  });
});

describe('variant resolution — appearance', () => {
  it('selects a season appearance, falling back to base', () => {
    expect(resolveAnchor(tree, variant({ season: 'spring' })).appearance).toBe('base');
    expect(resolveAnchor(tree, variant({ season: 'winter' })).appearance).toBe('snow');
    expect(resolveAnchor(tree, variant({ season: 'fall' })).appearance).toBe('autumn');
  });

  it('lets weather override the season appearance', () => {
    const winterStorm = resolveAnchor(tree, variant({ season: 'winter', weather: 'storm' }));
    expect(winterStorm.appearance).toBe('wind');
    const winterClear = resolveAnchor(tree, variant({ season: 'winter', weather: 'clear' }));
    expect(winterClear.appearance).toBe('snow');
  });
});

describe('variant resolution — anchor-id invariance (the load-bearing rule)', () => {
  const states: VariantState[] = [];
  const seasons: Season[] = ['spring', 'summer', 'fall', 'winter'];
  for (const tide of ['low', 'high'] as const) {
    for (const season of seasons) {
      for (const restoration of [0, 2, 5]) {
        states.push(variant({ tide, season, restoration }));
      }
    }
  }

  it('declares the same anchor-id set under every variant state', () => {
    const ids = anchorIds(DEF);
    expect(ids).toEqual(['a:tide', 'a:stall', 'a:tree']);
    for (const s of states) {
      const resolved = resolveChunkContent(DEF, s);
      // Exactly one resolved entry per declared anchor, same ids, same order —
      // only `present`/`appearance` differ across variants.
      expect(resolved.map((r) => r.id)).toEqual(ids);
    }
  });

  it('changes presence across variants but never the anchor identity', () => {
    const low = resolveChunkContent(DEF, variant({ tide: 'low', restoration: 5 }));
    const high = resolveChunkContent(DEF, variant({ tide: 'high', restoration: 0 }));
    expect(low.map((r) => r.id)).toEqual(high.map((r) => r.id));
    expect(low.find((r) => r.id === 'a:tide')?.present).toBe(true);
    expect(high.find((r) => r.id === 'a:tide')?.present).toBe(false);
    expect(low.find((r) => r.id === 'a:stall')?.present).toBe(true);
    expect(high.find((r) => r.id === 'a:stall')?.present).toBe(false);
  });
});
