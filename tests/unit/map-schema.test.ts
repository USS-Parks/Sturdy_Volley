import { describe, it, expect } from 'vitest';
import { validateMapDocument, type MapDocument } from '../../src/world/map-schema';
import { BREAKPOINT_FARM_SAMPLE, getWorldMapReport } from '../../src/world/sample-map';

/** Deep clone the valid sample so each mutation test starts clean. */
const clone = (): MapDocument => structuredClone(BREAKPOINT_FARM_SAMPLE);

describe('map schema — the valid reference sample', () => {
  it('validates the Breakpoint Farm sample clean', () => {
    const res = validateMapDocument(BREAKPOINT_FARM_SAMPLE);
    expect(res.issues, JSON.stringify(res.issues)).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.data).not.toBeNull();
  });

  it('the world-map report marks every authored map ok', () => {
    const rows = getWorldMapReport();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const r of rows) expect(r.ok, `${r.name}: ${r.issues.join('; ')}`).toBe(true);
    expect(rows[0].name).toContain('map:');
    expect(rows[0].count).toBeGreaterThan(0);
  });
});

describe('map schema — schema-level rejections', () => {
  it('rejects a wrong schema version', () => {
    const m = clone();
    (m as { schemaVersion: number }).schemaVersion = 2;
    const res = validateMapDocument(m);
    expect(res.ok).toBe(false);
    expect(res.issues.every((i) => i.code === 'schema')).toBe(true);
  });

  it('rejects a non-kebab anchor id', () => {
    const m = clone();
    m.anchors[0].id = 'Farmhouse_Door';
    const res = validateMapDocument(m);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === 'schema')).toBe(true);
  });

  it('rejects unknown keys (strict)', () => {
    const m = clone() as MapDocument & { bogus?: boolean };
    m.bogus = true;
    const res = validateMapDocument(m);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === 'schema')).toBe(true);
  });

  it('rejects a route with fewer than two points', () => {
    const m = clone();
    m.routes[0].points = [{ x: 0, z: 0 }];
    expect(validateMapDocument(m).ok).toBe(false);
  });
});

describe('map schema — semantic cross-checks', () => {
  it('flags duplicate anchor ids', () => {
    const m = clone();
    m.anchors[1].id = m.anchors[0].id;
    const res = validateMapDocument(m);
    expect(res.issues.some((i) => i.code === 'duplicate-anchor-id')).toBe(true);
  });

  it('flags a route too narrow for its required bodies', () => {
    const m = clone();
    m.routes[0].width = 1.0; // a road that cannot clear a large animal
    const res = validateMapDocument(m);
    expect(res.issues.some((i) => i.code === 'route-too-narrow')).toBe(true);
  });

  it('flags a camera volume whose profile context is unknown', () => {
    const m = clone();
    m.cameraVolumes[0].profileId = 'bogus:standard';
    const res = validateMapDocument(m);
    expect(res.issues.some((i) => i.code === 'unknown-camera-context')).toBe(true);
  });

  it('flags a transition whose camera context is unknown', () => {
    const m = clone();
    m.transitions[0].cameraContext = 'nope';
    const res = validateMapDocument(m);
    expect(res.issues.some((i) => i.code === 'unknown-camera-context')).toBe(true);
  });

  it('flags a transition whose fromRegion is not this map', () => {
    const m = clone();
    m.transitions[0].fromRegion = 'some-other-region';
    const res = validateMapDocument(m);
    expect(res.issues.some((i) => i.code === 'transition-region-mismatch')).toBe(true);
  });

  it('flags a dangling navigation anchor reference', () => {
    const m = clone();
    m.navigation[1].fromAnchorId = 'ghost-anchor';
    const res = validateMapDocument(m);
    expect(res.issues.some((i) => i.code === 'dangling-anchor-ref')).toBe(true);
  });

  it('flags a variant rule referencing an unknown anchor', () => {
    const m = clone();
    m.variants[0].anchorId = 'ghost-anchor';
    const res = validateMapDocument(m);
    expect(res.issues.some((i) => i.code === 'dangling-anchor-ref')).toBe(true);
  });

  it('flags mixed chunk sizes (the region grid must be uniform)', () => {
    const m = clone();
    m.chunks[1].size = 24;
    const res = validateMapDocument(m);
    expect(res.issues.some((i) => i.code === 'inconsistent-chunk-size')).toBe(true);
  });

  it('rejects an inverted elevation band (maxY ≤ minY) at the schema level', () => {
    const m = clone();
    m.elevation = [{ name: 'bad', minY: 2, maxY: 1 }];
    const res = validateMapDocument(m);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === 'schema')).toBe(true);
  });

  it('flags overlapping elevation bands', () => {
    const m = clone();
    m.elevation = [
      { name: 'low', minY: 0, maxY: 2 },
      { name: 'mid', minY: 1, maxY: 3 },
    ];
    const res = validateMapDocument(m);
    expect(res.issues.some((i) => i.code === 'elevation-band-overlap')).toBe(true);
  });
});
