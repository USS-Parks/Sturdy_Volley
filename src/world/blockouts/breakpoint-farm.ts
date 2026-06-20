/**
 * Breakpoint Farm — dimensioned blockout (WEF-06c, master Prompt 039).
 *
 * The authoritative top-down + elevation blockout for Breakpoint Farm, derived
 * from the metric kit (Prompt 037) and the atlas sheet (038), grounded in the
 * top-down board `sv_map_012_breakpoint_farm_layout.png` + the morning mood of
 * `sv_env_041_breakpoint_morning.png` (redwood edge, creek, fenced pasture,
 * rounded timber farm buildings, orchard bluff over the ocean). This is the
 * source the Prompt 046 graybox build reads — its anchors, camera volumes,
 * routes, collision/navigation references, and transitions are fixed here.
 *
 * 128 × 128 m footprint = a 4 × 4 grid of 32 m chunks. Routes use metric-kit
 * widths so every route clears its required bodies. No central court/net
 * (§1.4 sports purge).
 */
import { METRIC_KIT } from '../metric-kit';
import type { MapDocument } from '../map-schema';

const CHUNK = 32;

export const BREAKPOINT_FARM_BLOCKOUT: MapDocument = {
  schemaVersion: 1,
  coordinateFrame: { regionId: 'breakpoint-farm', label: 'Breakpoint Farm', origin: { x: 0, z: 0 }, forwardAxis: '+z', units: 'meters' },
  chunks: Array.from({ length: 4 }, (_, cz) => Array.from({ length: 4 }, (_, cx) => ({ cx, cz, size: CHUNK }))).flat(),
  elevation: [
    { name: 'tide-fed lowland', minY: 0, maxY: 0.5 },
    { name: 'farmyard', minY: 0.5, maxY: 2.0 },
    { name: 'orchard bluff', minY: 2.0, maxY: 6.0 },
  ],
  anchors: [
    { id: 'farmhouse-door', kind: 'doorway', at: { x: 56, y: 0.5, z: 48 }, facing: Math.PI },
    { id: 'shed-door', kind: 'doorway', at: { x: 24, y: 0.5, z: 40 }, facing: Math.PI },
    { id: 'greenhouse-door', kind: 'doorway', at: { x: 40, y: 0.5, z: 84 }, facing: 0 },
    { id: 'farm-well', kind: 'interaction', at: { x: 64, y: 0.5, z: 60 } },
    { id: 'pasture-gate', kind: 'gate', at: { x: 96, y: 0.5, z: 40 } },
    { id: 'crop-field-center', kind: 'farm-plot', at: { x: 64, y: 0.5, z: 64 } },
    { id: 'pond-edge', kind: 'water-entry', at: { x: 24, y: 0, z: 96 } },
    { id: 'creek-ford', kind: 'water-entry', at: { x: 64, y: 0, z: 112 } },
    { id: 'orchard-bluff-view', kind: 'landmark', at: { x: 112, y: 2, z: 64 } },
    { id: 'farm-gate-town', kind: 'region-edge', at: { x: 124, y: 0.5, z: 64 }, facing: -Math.PI / 2 },
    { id: 'farm-gate-river', kind: 'region-edge', at: { x: 64, y: 0.5, z: 4 }, facing: 0 },
    { id: 'farm-gate-marsh', kind: 'region-edge', at: { x: 4, y: 0.5, z: 64 }, facing: Math.PI / 2 },
  ],
  cameraVolumes: [
    {
      id: 'vol-farmyard',
      min: { x: 8, y: -0.5, z: 24 },
      max: { x: 104, y: 4, z: 100 },
      profileId: 'farm:standard',
      fallbackProfileId: 'exterior:standard',
      blendBoundary: 0.6,
      priority: 10,
    },
    {
      id: 'vol-orchard-bluff',
      min: { x: 100, y: 1.5, z: 40 },
      max: { x: 128, y: 6, z: 92 },
      profileId: 'exterior:standard',
      blendBoundary: 0.6,
      priority: 12,
    },
  ],
  collision: [
    { id: 'col-farmhouse', kind: 'box', anchorId: 'farmhouse-door' },
    { id: 'col-shed', kind: 'box', anchorId: 'shed-door' },
    { id: 'col-greenhouse', kind: 'box', anchorId: 'greenhouse-door' },
    { id: 'col-orchard-cliff', kind: 'proxy' },
    { id: 'col-pasture-fence', kind: 'proxy' },
  ],
  navigation: [
    { id: 'nav-yard', kind: 'patch', width: METRIC_KIT.road.value },
    { id: 'nav-pasture', kind: 'patch', width: METRIC_KIT.paddockGate.value },
    { id: 'nav-creek-bridge-link', kind: 'link', width: METRIC_KIT.bridge.value, fromAnchorId: 'farm-well', toAnchorId: 'creek-ford' },
  ],
  routes: [
    { id: 'route-yard-road', kind: 'road', width: METRIC_KIT.road.value, points: [{ x: 56, z: 48 }, { x: 24, z: 40 }, { x: 96, z: 40 }] },
    { id: 'route-town-road', kind: 'road', width: METRIC_KIT.road.value, points: [{ x: 56, z: 48 }, { x: 124, z: 64 }] },
    { id: 'route-garden-path', kind: 'path', width: METRIC_KIT.path.value, points: [{ x: 64, z: 60 }, { x: 64, z: 64 }, { x: 40, z: 84 }] },
    { id: 'route-creek-trace', kind: 'desire-line', width: METRIC_KIT.desireLine.value, points: [{ x: 64, z: 60 }, { x: 64, z: 108 }] },
    { id: 'route-creek-bridge', kind: 'bridge', width: METRIC_KIT.bridge.value, points: [{ x: 64, z: 108 }, { x: 64, z: 116 }] },
  ],
  variants: [
    { anchorId: 'creek-ford', hideOnTide: 'high' },
    { anchorId: 'crop-field-center', seasonAppearance: { winter: 'snow' } },
  ],
  transitions: [
    { id: 'farm-to-farmhouse', fromRegion: 'breakpoint-farm', fromAnchor: { x: 56, z: 48 }, toRegion: 'farmhouse-interior', toAnchor: { x: 0, z: 2 }, facing: 0, cameraContext: 'smallInterior' },
    { id: 'farm-to-shed', fromRegion: 'breakpoint-farm', fromAnchor: { x: 24, z: 40 }, toRegion: 'shed-interior', toAnchor: { x: 0, z: 2 }, facing: 0, cameraContext: 'smallInterior' },
    { id: 'farm-to-greenhouse', fromRegion: 'breakpoint-farm', fromAnchor: { x: 40, z: 84 }, toRegion: 'greenhouse-interior', toAnchor: { x: 0, z: 2 }, facing: 0, cameraContext: 'smallInterior' },
    { id: 'farm-to-town', fromRegion: 'breakpoint-farm', fromAnchor: { x: 124, z: 64 }, toRegion: 'ballast-bay-town', toAnchor: { x: 6, z: 64 }, facing: -Math.PI / 2, cameraContext: 'exterior' },
    { id: 'farm-to-river', fromRegion: 'breakpoint-farm', fromAnchor: { x: 64, z: 4 }, toRegion: 'klam-ity-river', toAnchor: { x: 64, z: 90 }, facing: 0, cameraContext: 'exterior' },
    { id: 'farm-to-marsh', fromRegion: 'breakpoint-farm', fromAnchor: { x: 4, z: 64 }, toRegion: 'belltide-marsh', toAnchor: { x: 152, z: 64 }, facing: Math.PI / 2, cameraContext: 'exterior' },
  ],
};
