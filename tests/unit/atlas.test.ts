import { describe, it, expect } from 'vitest';
import {
  ATLAS,
  STARTING_FARMS,
  WORLD_SPINE,
  getAtlasReport,
  validateAtlas,
  type RegionSheet,
} from '../../src/world/atlas';

/** The twelve §4.2 core regions. */
const EXPECTED_REGIONS = [
  'willa-crick',
  'klam-ity-river',
  'breakpoint-farm',
  'ballast-bay-town',
  'netlight-point',
  'driftwood-beach',
  'kelpglass-reefs',
  'belltide-marsh',
  'ironroot-quarry',
  'rainhall-caverns',
  'splitwind-ridge',
  'outer-islets',
];

const clone = (): RegionSheet[] => structuredClone(ATLAS);

describe('world atlas — coverage + structure', () => {
  it('covers every §4.2 core region', () => {
    expect(ATLAS.map((r) => r.id).sort()).toEqual([...EXPECTED_REGIONS].sort());
  });

  it('validates clean (symmetry, connectivity, spine, unique order)', () => {
    expect(validateAtlas()).toEqual([]);
  });

  it('every region sheet carries the §4.2 fields', () => {
    for (const r of ATLAS) {
      expect(r.purpose.length, `${r.id} purpose`).toBeGreaterThan(0);
      expect(r.footprint.width).toBeGreaterThan(0);
      expect(r.elevationBands.length, `${r.id} elevation bands`).toBeGreaterThan(0);
      expect(r.traversalVocabulary.length, `${r.id} traversal`).toBeGreaterThan(0);
      expect(r.sightlineLandmark.length, `${r.id} landmark`).toBeGreaterThan(0);
      expect(r.streamingCells).toBeGreaterThan(0);
    }
  });

  it('marks only the two inland-spine regions provisional (no dimensioned board yet)', () => {
    const provisional = ATLAS.filter((r) => r.provisional).map((r) => r.id).sort();
    expect(provisional).toEqual(['klam-ity-river', 'willa-crick']);
  });

  it('the spine is Willa Crick ↔ river ↔ Ballast Bay and is connected', () => {
    expect(WORLD_SPINE).toEqual(['willa-crick', 'klam-ity-river', 'ballast-bay-town']);
    // each spine link mirrored
    const byId = new Map(ATLAS.map((r) => [r.id, r]));
    expect(byId.get('willa-crick')!.adjacencies).toContain('klam-ity-river');
    expect(byId.get('klam-ity-river')!.adjacencies).toContain('willa-crick');
    expect(byId.get('klam-ity-river')!.adjacencies).toContain('ballast-bay-town');
  });

  it('starting farms attach to real communities, across both', () => {
    const communities = new Set(STARTING_FARMS.map((f) => f.community));
    expect(communities.has('willa-crick')).toBe(true);
    expect(communities.has('ballast-bay')).toBe(true);
    expect(STARTING_FARMS.length).toBe(8);
  });

  it('the atlas report is ok', () => {
    const rows = getAtlasReport();
    expect(rows[0].ok, rows[0].issues.join('; ')).toBe(true);
    expect(rows[0].count).toBe(12);
  });
});

describe('world atlas — validator catches structural breaks', () => {
  it('flags an asymmetric adjacency', () => {
    const a = clone();
    a.find((r) => r.id === 'willa-crick')!.adjacencies = ['klam-ity-river', 'splitwind-ridge', 'outer-islets'];
    const issues = validateAtlas(a);
    expect(issues.some((i) => i.code === 'asymmetric-adjacency')).toBe(true);
  });

  it('flags an unknown adjacency', () => {
    const a = clone();
    a[0].adjacencies = [...a[0].adjacencies, 'atlantis'];
    expect(validateAtlas(a).some((i) => i.code === 'unknown-adjacency')).toBe(true);
  });

  it('flags a disconnected region', () => {
    const a = clone();
    // Sever Outer Islets from the graph entirely.
    a.find((r) => r.id === 'kelpglass-reefs')!.adjacencies = ['driftwood-beach'];
    a.find((r) => r.id === 'outer-islets')!.adjacencies = [];
    expect(validateAtlas(a).some((i) => i.code === 'disconnected-graph')).toBe(true);
  });

  it('flags a broken spine', () => {
    const a = clone();
    a.find((r) => r.id === 'klam-ity-river')!.adjacencies = ['breakpoint-farm', 'ballast-bay-town'];
    a.find((r) => r.id === 'willa-crick')!.adjacencies = ['splitwind-ridge'];
    expect(validateAtlas(a).some((i) => i.code === 'broken-spine')).toBe(true);
  });

  it('flags a duplicate production order', () => {
    const a = clone();
    a[1].productionOrder = a[0].productionOrder;
    expect(validateAtlas(a).some((i) => i.code === 'duplicate-production-order')).toBe(true);
  });

  it('flags a starting farm attached to an absent community', () => {
    const a = clone();
    const farms = structuredClone(STARTING_FARMS);
    farms[0].community = 'nowhere' as never;
    expect(validateAtlas(a, farms).some((i) => i.code === 'unattached-starting-farm')).toBe(true);
  });
});
