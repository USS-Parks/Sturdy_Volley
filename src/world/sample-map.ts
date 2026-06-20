/**
 * Reference sample map (WEF-06a, master Prompt 037).
 *
 * A small but complete, schema-valid `MapDocument` that exercises every field of
 * the map schema — coordinate frame, chunks, anchors, a camera volume,
 * collision + navigation references, routes (sized from the metric kit), a
 * content variant, and an outgoing transition. It is the authoring template the
 * Prompt 038 atlas + 039 blockouts + 046–049 graybox maps follow, and the live
 * fixture the "Dev · Validate data" report + the unit tests validate, so the
 * schema + validator are exercised in the running game and in the gate (not dead
 * code). It uses the locked metric-kit widths so a real route never under-clears
 * a navigator.
 */
import { METRIC_KIT } from './metric-kit';
import { validateMapDocument, type MapDocument } from './map-schema';

/** A Breakpoint-Farm-flavoured reference slice (region `breakpoint-farm`). */
export const BREAKPOINT_FARM_SAMPLE: MapDocument = {
  schemaVersion: 1,
  coordinateFrame: {
    regionId: 'breakpoint-farm',
    label: 'Breakpoint Farm',
    origin: { x: 0, z: 0 },
    forwardAxis: '+z',
    units: 'meters',
  },
  chunks: [
    { cx: 0, cz: 0, size: 32 },
    { cx: 1, cz: 0, size: 32 },
    { cx: 0, cz: 1, size: 32 },
    { cx: 1, cz: 1, size: 32 },
  ],
  anchors: [
    { id: 'farmhouse-door', kind: 'doorway', at: { x: 8, y: 0, z: 6 }, facing: Math.PI },
    { id: 'barn-door', kind: 'doorway', at: { x: 22, y: 0, z: 10 }, facing: Math.PI },
    { id: 'well', kind: 'interaction', at: { x: 14, y: 0, z: 14 } },
    { id: 'pasture-gate', kind: 'gate', at: { x: 26, y: 0, z: 18 } },
    { id: 'creek-ford', kind: 'water-entry', at: { x: 4, y: 0, z: 30 } },
  ],
  cameraVolumes: [
    {
      id: 'vol-farmyard',
      min: { x: 0, y: -0.5, z: 0 },
      max: { x: 32, y: 4, z: 24 },
      profileId: 'farm:standard',
      fallbackProfileId: 'exterior:standard',
      blendBoundary: 0.6,
      priority: 10,
    },
  ],
  collision: [
    { id: 'col-farmhouse', kind: 'box', anchorId: 'farmhouse-door' },
    { id: 'col-barn', kind: 'box', anchorId: 'barn-door' },
    { id: 'col-terrain', kind: 'proxy' },
  ],
  navigation: [
    { id: 'nav-yard', kind: 'patch', width: METRIC_KIT.road.value },
    { id: 'nav-ford-link', kind: 'link', width: METRIC_KIT.path.value, fromAnchorId: 'well', toAnchorId: 'creek-ford' },
  ],
  routes: [
    { id: 'route-yard-road', kind: 'road', width: METRIC_KIT.road.value, points: [{ x: 8, z: 6 }, { x: 22, z: 10 }, { x: 26, z: 18 }] },
    { id: 'route-well-path', kind: 'path', width: METRIC_KIT.path.value, points: [{ x: 14, z: 14 }, { x: 8, z: 6 }] },
    { id: 'route-ford-trace', kind: 'desire-line', width: METRIC_KIT.desireLine.value, points: [{ x: 14, z: 14 }, { x: 4, z: 30 }] },
    { id: 'route-creek-bridge', kind: 'bridge', width: METRIC_KIT.bridge.value, points: [{ x: 4, z: 28 }, { x: 4, z: 32 }] },
  ],
  variants: [
    { anchorId: 'creek-ford', hideOnTide: 'high' },
    { anchorId: 'well', seasonAppearance: { winter: 'snow' } },
  ],
  transitions: [
    {
      id: 'farmyard-to-farmhouse',
      fromRegion: 'breakpoint-farm',
      fromAnchor: { x: 8, z: 6 },
      toRegion: 'farmhouse-interior',
      toAnchor: { x: 0, z: 2 },
      facing: 0,
      cameraContext: 'smallInterior',
    },
  ],
};

/** Every authored reference map (Prompts 038/039 append their region maps here). */
export const AUTHORED_MAPS: ReadonlyArray<{ name: string; doc: MapDocument }> = [
  { name: 'breakpoint-farm (sample)', doc: BREAKPOINT_FARM_SAMPLE },
];

/** Validation summary for one authored map, in the data-report shape. */
export interface MapReportRow {
  name: string;
  count: number;
  ok: boolean;
  issues: string[];
}

/** Validate every authored map — surfaced in the "Dev · Validate data" report. */
export function getWorldMapReport(maps: ReadonlyArray<{ name: string; doc: MapDocument }> = AUTHORED_MAPS): MapReportRow[] {
  return maps.map(({ name, doc }) => {
    const res = validateMapDocument(doc);
    const count = doc.chunks.length + doc.anchors.length + doc.cameraVolumes.length + doc.routes.length + doc.transitions.length;
    return { name: `map: ${name}`, count, ok: res.ok, issues: res.issues.map((i) => `${i.code}: ${i.message}`) };
  });
}
