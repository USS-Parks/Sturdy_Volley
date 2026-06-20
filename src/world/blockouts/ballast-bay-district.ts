/**
 * Ballast Bay town district — dimensioned blockout (WEF-06c, master Prompt 039).
 *
 * The authoritative top-down + elevation blockout for the representative Ballast
 * Bay district (market lane + harbor approach + ≥1 elevation change), derived
 * from the metric kit (037) + atlas sheet (038), grounded in
 * `sv_map_013_ballast_bay_town_layout.png`, `sv_map_022_town_interiors_grid.png`,
 * and the mood of `sv_map_026_market_lane_rainy.png` + `sv_map_027_harbor_evening.png`
 * (harbor docks, lighthouse point, river-through-town, terraced market lane).
 * Source for the Prompt 047 graybox build.
 *
 * 160 × 128 m district = a 5 × 4 grid of 32 m chunks, with the harborfront →
 * market lane → upper-terrace elevation change the town district must prove.
 */
import { METRIC_KIT } from '../metric-kit';
import type { MapDocument } from '../map-schema';

const CHUNK = 32;

export const BALLAST_BAY_DISTRICT_BLOCKOUT: MapDocument = {
  schemaVersion: 1,
  coordinateFrame: { regionId: 'ballast-bay-town', label: 'Ballast Bay Town', origin: { x: 0, z: 0 }, forwardAxis: '+z', units: 'meters' },
  chunks: Array.from({ length: 4 }, (_, cz) => Array.from({ length: 5 }, (_, cx) => ({ cx, cz, size: CHUNK }))).flat(),
  elevation: [
    { name: 'harborfront', minY: 0, maxY: 0.5 },
    { name: 'market lane', minY: 0.5, maxY: 3.0 },
    { name: 'upper terraces', minY: 3.0, maxY: 6.0 },
  ],
  anchors: [
    { id: 'community-hall-door', kind: 'doorway', at: { x: 80, y: 0.5, z: 60 }, facing: Math.PI },
    { id: 'bakery-door', kind: 'doorway', at: { x: 60, y: 0.5, z: 48 }, facing: Math.PI },
    { id: 'fishmonger-door', kind: 'doorway', at: { x: 100, y: 0.5, z: 40 }, facing: Math.PI },
    { id: 'general-store-door', kind: 'doorway', at: { x: 72, y: 0.5, z: 72 }, facing: 0 },
    { id: 'market-well', kind: 'interaction', at: { x: 80, y: 0.5, z: 52 } },
    { id: 'harbor-dock', kind: 'dock', at: { x: 80, y: 0, z: 12 } },
    { id: 'beach-access', kind: 'water-entry', at: { x: 12, y: 0, z: 64 } },
    { id: 'terrace-stair-base', kind: 'elevation-link', at: { x: 110, y: 0.5, z: 70 } },
    { id: 'terrace-stair-top', kind: 'elevation-link', at: { x: 110, y: 3, z: 86 } },
    { id: 'town-gate-farm', kind: 'region-edge', at: { x: 6, y: 0.5, z: 64 }, facing: Math.PI / 2 },
    { id: 'town-gate-point', kind: 'region-edge', at: { x: 150, y: 0.5, z: 20 }, facing: -Math.PI / 2 },
    { id: 'town-gate-beach', kind: 'region-edge', at: { x: 12, y: 0, z: 100 }, facing: 0 },
  ],
  cameraVolumes: [
    {
      id: 'vol-market-lane',
      min: { x: 40, y: -0.5, z: 32 },
      max: { x: 130, y: 4, z: 96 },
      profileId: 'exterior:standard',
      fallbackProfileId: 'exterior:standard',
      blendBoundary: 0.6,
      priority: 10,
    },
    {
      id: 'vol-harborfront',
      min: { x: 40, y: -0.5, z: 0 },
      max: { x: 130, y: 3, z: 32 },
      profileId: 'exterior:near',
      blendBoundary: 0.6,
      priority: 12,
    },
  ],
  collision: [
    { id: 'col-community-hall', kind: 'box', anchorId: 'community-hall-door' },
    { id: 'col-bakery', kind: 'box', anchorId: 'bakery-door' },
    { id: 'col-fishmonger', kind: 'box', anchorId: 'fishmonger-door' },
    { id: 'col-general-store', kind: 'box', anchorId: 'general-store-door' },
    { id: 'col-terrace-wall', kind: 'proxy' },
    { id: 'col-harbor-edge', kind: 'proxy' },
  ],
  navigation: [
    { id: 'nav-lane', kind: 'patch', width: METRIC_KIT.road.value },
    { id: 'nav-harbor', kind: 'patch', width: METRIC_KIT.dock.value },
    { id: 'nav-terrace-stair', kind: 'link', width: METRIC_KIT.navCorridor.value, fromAnchorId: 'terrace-stair-base', toAnchorId: 'terrace-stair-top' },
  ],
  routes: [
    { id: 'route-market-road', kind: 'road', width: METRIC_KIT.road.value, points: [{ x: 12, z: 64 }, { x: 80, z: 56 }, { x: 150, z: 28 }] },
    { id: 'route-harbor-dock', kind: 'dock', width: METRIC_KIT.dock.value, points: [{ x: 80, z: 28 }, { x: 80, z: 8 }] },
    { id: 'route-store-path', kind: 'path', width: METRIC_KIT.path.value, points: [{ x: 80, z: 56 }, { x: 72, z: 72 } ] },
    { id: 'route-beach-path', kind: 'path', width: METRIC_KIT.path.value, points: [{ x: 12, z: 64 }, { x: 12, z: 100 }] },
  ],
  variants: [
    { anchorId: 'market-well', seasonAppearance: { winter: 'snow' } },
    { anchorId: 'harbor-dock', restorationMinStage: 1 },
  ],
  transitions: [
    { id: 'town-to-community-hall', fromRegion: 'ballast-bay-town', fromAnchor: { x: 80, z: 60 }, toRegion: 'community-hall-interior', toAnchor: { x: 0, z: 2 }, facing: 0, cameraContext: 'largeInterior' },
    { id: 'town-to-bakery', fromRegion: 'ballast-bay-town', fromAnchor: { x: 60, z: 48 }, toRegion: 'bakery-interior', toAnchor: { x: 0, z: 2 }, facing: 0, cameraContext: 'smallInterior' },
    { id: 'town-to-fishmonger', fromRegion: 'ballast-bay-town', fromAnchor: { x: 100, z: 40 }, toRegion: 'fishmonger-interior', toAnchor: { x: 0, z: 2 }, facing: 0, cameraContext: 'smallInterior' },
    { id: 'town-to-store', fromRegion: 'ballast-bay-town', fromAnchor: { x: 72, z: 72 }, toRegion: 'general-store-interior', toAnchor: { x: 0, z: 2 }, facing: 0, cameraContext: 'smallInterior' },
    { id: 'town-to-farm', fromRegion: 'ballast-bay-town', fromAnchor: { x: 6, z: 64 }, toRegion: 'breakpoint-farm', toAnchor: { x: 120, z: 64 }, facing: Math.PI / 2, cameraContext: 'farm' },
    { id: 'town-to-point', fromRegion: 'ballast-bay-town', fromAnchor: { x: 150, z: 20 }, toRegion: 'netlight-point', toAnchor: { x: 12, z: 80 }, facing: -Math.PI / 2, cameraContext: 'exterior' },
    { id: 'town-to-beach', fromRegion: 'ballast-bay-town', fromAnchor: { x: 12, z: 100 }, toRegion: 'driftwood-beach', toAnchor: { x: 80, z: 12 }, facing: 0, cameraContext: 'water' },
  ],
};
