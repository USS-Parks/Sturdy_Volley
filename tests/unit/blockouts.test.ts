import { describe, it, expect } from 'vitest';
import { validateMapDocument, type MapDocument } from '../../src/world/map-schema';
import { BREAKPOINT_FARM_BLOCKOUT } from '../../src/world/blockouts/breakpoint-farm';
import { BALLAST_BAY_DISTRICT_BLOCKOUT } from '../../src/world/blockouts/ballast-bay-district';
import { getWorldMapReport } from '../../src/world/sample-map';
import { METRIC_KIT, routeWidthOk } from '../../src/world/metric-kit';

const BLOCKOUTS: Array<[string, MapDocument, { region: string; chunks: number }]> = [
  ['breakpoint-farm', BREAKPOINT_FARM_BLOCKOUT, { region: 'breakpoint-farm', chunks: 16 }],
  ['ballast-bay-district', BALLAST_BAY_DISTRICT_BLOCKOUT, { region: 'ballast-bay-town', chunks: 20 }],
];

describe('dimensioned blockouts — validity + dimensions', () => {
  for (const [name, doc, meta] of BLOCKOUTS) {
    describe(name, () => {
      it('validates clean against the map schema', () => {
        const res = validateMapDocument(doc);
        expect(res.issues, JSON.stringify(res.issues)).toEqual([]);
        expect(res.ok).toBe(true);
      });

      it('owns the right region + a complete chunk grid', () => {
        expect(doc.coordinateFrame.regionId).toBe(meta.region);
        expect(doc.chunks.length).toBe(meta.chunks);
        // Uniform 32 m grid.
        expect(doc.chunks.every((c) => c.size === 32)).toBe(true);
      });

      it('stacks dimensioned, non-overlapping elevation bands', () => {
        expect(doc.elevation.length).toBeGreaterThanOrEqual(2);
        const sorted = [...doc.elevation].sort((a, b) => a.minY - b.minY);
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i].minY, `${sorted[i].name} sits above ${sorted[i - 1].name}`).toBeGreaterThanOrEqual(sorted[i - 1].maxY - 1e-9);
        }
      });

      it('every route clears its required bodies + traces to the metric kit', () => {
        for (const r of doc.routes) {
          expect(routeWidthOk(r.kind, r.width), `${r.id} clears ${r.kind} bodies`).toBe(true);
        }
        // Widths are the metric-kit values (traceability to Prompt 037).
        const widths = new Set(doc.routes.map((r) => r.width));
        const kitWidths = new Set([METRIC_KIT.road.value, METRIC_KIT.path.value, METRIC_KIT.desireLine.value, METRIC_KIT.bridge.value, METRIC_KIT.dock.value]);
        for (const w of widths) expect(kitWidths.has(w), `route width ${w} is a metric-kit width`).toBe(true);
      });

      it('every transition leaves this region (outgoing) with a valid camera context', () => {
        for (const t of doc.transitions) {
          expect(t.fromRegion).toBe(meta.region);
          expect(t.cameraContext.length).toBeGreaterThan(0);
        }
      });
    });
  }

  it('the Ballast Bay district proves a harbor → terrace elevation change', () => {
    const names = BALLAST_BAY_DISTRICT_BLOCKOUT.elevation.map((b) => b.name);
    expect(names).toContain('harborfront');
    expect(names).toContain('upper terraces');
    // A stair elevation-link bridges the bands.
    const stair = BALLAST_BAY_DISTRICT_BLOCKOUT.navigation.find((n) => n.kind === 'link');
    expect(stair?.fromAnchorId).toBe('terrace-stair-base');
    expect(stair?.toAnchorId).toBe('terrace-stair-top');
  });

  it('both blockouts appear, valid, in the world-map report', () => {
    const rows = getWorldMapReport();
    const farm = rows.find((r) => r.name.includes('breakpoint-farm (blockout)'));
    const town = rows.find((r) => r.name.includes('ballast-bay-district'));
    expect(farm?.ok, farm?.issues.join('; ')).toBe(true);
    expect(town?.ok, town?.issues.join('; ')).toBe(true);
  });
});
