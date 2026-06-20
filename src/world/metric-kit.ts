/**
 * Map metric kit — the locked spatial grammar (WEF-06a, master Prompt 037).
 *
 * Pure data + helpers (no Babylon) consolidating every world dimension the atlas
 * (Prompt 038), the dimensioned blockouts (039), and the graybox maps (046–049)
 * read from. It is the single source of truth for route widths, structure
 * footprints, terrain thresholds, transition thresholds, camera clearance, and
 * landmark sightlines, and it reconciles three already-locked sources so nothing
 * drifts:
 *   - the motor (`DEFAULT_MOTOR_CONFIG`): capsule, slope limit, step offset,
 *     swim depth — so a route the kit calls walkable actually is;
 *   - the interior kit (`INTERIOR_METRICS`, Prompt 036): doorways, rooms, stairs,
 *     counters, beds, corridor width;
 *   - the art scale guide (`sv_style_007_camera_scale_guide.png`): 1.7–1.8 m
 *     human, 1 m farm cells, cottage/door proportions.
 *
 * Every element carries its dimension(s), a tolerance, and (where it constrains
 * the camera) a camera-clearance figure, so the doc `docs/world/METRIC_KIT.md`
 * and this module never diverge.
 */

import { DEFAULT_MOTOR_CONFIG } from '../engine/motor';
import { INTERIOR_METRICS } from './interior-kit';

/** Body footprint diameters (m) every route/opening must clear. */
export const BODY = {
  /** Player + NPC capsule diameter (2 × motor radius). */
  capsule: DEFAULT_MOTOR_CONFIG.capsuleRadius * 2,
  /** Small quadruped (pet / chicken / small forager) body width. */
  smallAnimal: 0.5,
  /** Large quadruped (cow / horse) body width — the widest navigator. */
  largeAnimal: 1.2,
} as const;

/** A dimensioned kit element: nominal value(s), tolerance, optional camera clearance. */
export interface MetricElement {
  /** Primary dimension (m) — width for routes, footprint min-span for areas, etc. */
  value: number;
  /** Acceptable ± tolerance (m) when realising the element in a blockout. */
  tolerance: number;
  /** Minimum overhead/lateral space (m) the camera needs over this element, if any. */
  cameraClearance?: number;
  /** A second dimension (m) where the element needs one (height / depth). */
  secondary?: number;
}

const el = (value: number, tolerance: number, extra: Partial<MetricElement> = {}): MetricElement => ({ value, tolerance, ...extra });

/**
 * The metric kit. Grouped by concern; every dimension in metres. Routes are
 * sized so the **largest** navigator (the 1.2 m large-animal body) plus camera
 * clearance fits — see `routeSupportsAll`.
 */
export const METRIC_KIT = {
  // --- Routes & open space ----------------------------------------------------
  /** Single desire-line footpath: one capsule + comfort, not large-animal width. */
  path: el(1.6, 0.2, { cameraClearance: 3 }),
  /** Main thoroughfare / cart track: large animal + a passing capsule. */
  road: el(3.0, 0.3, { cameraClearance: 4 }),
  /** Faint desire line worn across open ground — the narrowest legible route. */
  desireLine: el(1.2, 0.2),
  /** Gathering plaza / village common minimum clear span. */
  plaza: el(8.0, 1.0, { cameraClearance: 6 }),

  // --- Farm -------------------------------------------------------------------
  /** Logical farm cell (1 m², per docs/SCALE_AND_PERFORMANCE §1). */
  farmCell: el(1.0, 0.0),
  /** Walkable gap between crop rows so the player tends without trampling. */
  cropRowClearance: el(0.5, 0.1),
  /** Paddock gate clear width (an animal + the player drive through). */
  paddockGate: el(1.4, 0.1),
  /** Fence height + post spacing (height is `value`, spacing is `secondary`). */
  fence: el(1.1, 0.1, { secondary: 2.0 }),

  // --- Interior (reconciled to INTERIOR_METRICS, Prompt 036) ------------------
  doorway: el(INTERIOR_METRICS.doorway.width, 0.1, { secondary: INTERIOR_METRICS.doorway.height }),
  room: el(4.0, 0.5, { cameraClearance: INTERIOR_METRICS.wallHeight }),
  bed: el(2.0, 0.2, { secondary: 1.2 }),
  counter: el(INTERIOR_METRICS.counter.depth, 0.1, { secondary: INTERIOR_METRICS.counter.height }),
  navCorridor: el(INTERIOR_METRICS.navCorridorWidth, 0.1),

  // --- Structures -------------------------------------------------------------
  /** Building wall height band (min `value`, max `secondary`); roof peak in the doc. */
  building: el(3.0, 0.0, { secondary: 4.0, cameraClearance: 4 }),
  /** Dock / pier walk width over water. */
  dock: el(2.0, 0.2, { cameraClearance: 4 }),
  /** Footbridge clear walk width (+ railing implied). */
  bridge: el(1.8, 0.2, { cameraClearance: 4 }),

  // --- Vegetation -------------------------------------------------------------
  /** Mature tree trunk diameter (`value`) + canopy ground clearance (`secondary`). */
  tree: el(0.6, 0.2, { secondary: 2.2 }),
  /** Crop/plant interaction clearance around a tended plant. */
  cropClearance: el(0.8, 0.1),

  // --- Terrain ----------------------------------------------------------------
  /** Maximum walkable slope (degrees) — reconciled to the motor slope limit. */
  slopeMaxDeg: el(DEFAULT_MOTOR_CONFIG.slopeLimitDeg, 2),
  /** Single auto-stepped rise (m) — reconciled to the motor step offset. */
  stepMax: el(DEFAULT_MOTOR_CONFIG.stepOffset, 0.02),
  /** Stair tread run (`value`) + rise (`secondary`), per the interior kit. */
  stair: el(INTERIOR_METRICS.stair.run, 0.02, { secondary: INTERIOR_METRICS.stair.rise }),
  /** Cliff: the minimum drop height that reads as an impassable edge. */
  cliffMinHeight: el(2.0, 0.2),
  /** Shoreline wading band width along the water's edge. */
  shorelineBand: el(3.0, 0.5),
  /** Maximum water depth that is wade, not swim — reconciled to the motor. */
  wadeDepthMax: el(DEFAULT_MOTOR_CONFIG.swimDepth, 0.0),
  /** Cave corridor: clear walk width (`value`) + headroom (`secondary`). */
  caveCorridor: el(2.0, 0.2, { secondary: 2.6, cameraClearance: 2.6 }),
  /** Cave encounter room minimum clear span (navigation + a small fight). */
  encounterRoom: el(8.0, 1.0, { cameraClearance: 4 }),

  // --- Transitions & camera ---------------------------------------------------
  /** Transition threshold: trigger width (`value`) + depth (`secondary`). */
  transitionThreshold: el(1.4, 0.1, { secondary: 1.0 }),
  /** Minimum range (m) a region's sightline landmark stays legible from. */
  landmarkSightline: el(40.0, 5.0),
} as const;

export type MetricKey = keyof typeof METRIC_KIT;

/** Which body footprints a route of `width` (m) supports. */
export function routeSupports(width: number): { capsule: boolean; smallAnimal: boolean; largeAnimal: boolean } {
  const margin = 0.2; // comfort clearance on top of the raw body width
  return {
    capsule: width >= BODY.capsule + margin,
    smallAnimal: width >= BODY.smallAnimal + margin,
    largeAnimal: width >= BODY.largeAnimal + margin,
  };
}

/** Whether a route width supports every body type (capsule + both animals). */
export function routeSupportsAll(width: number): boolean {
  const s = routeSupports(width);
  return s.capsule && s.smallAnimal && s.largeAnimal;
}

/** Route kinds that must clear the large-animal (mount/livestock/cart) body. */
export const LARGE_BODY_ROUTE_KINDS: ReadonlySet<string> = new Set(['road', 'dock', 'bridge']);

/**
 * Whether a route of `kind` and `width` clears the bodies *relevant to that
 * kind* (§4.2 "every route supports … the relevant animal body"): every route
 * must clear the player/NPC capsule + a small animal; mount/cart routes
 * (road/dock/bridge) must additionally clear the large-animal body.
 */
export function routeWidthOk(kind: string, width: number): boolean {
  const s = routeSupports(width);
  if (!s.capsule || !s.smallAnimal) return false;
  if (LARGE_BODY_ROUTE_KINDS.has(kind)) return s.largeAnimal;
  return true;
}

/** Whether a slope (degrees) is walkable under the motor's slope limit. */
export function slopeWalkable(deg: number): boolean {
  return deg <= METRIC_KIT.slopeMaxDeg.value + 1e-9;
}

/** Medium for a water column of `depth` (m): dry / wade / swim. */
export function mediumForDepth(depth: number): 'dry' | 'wade' | 'swim' {
  if (depth <= 0) return 'dry';
  return depth > METRIC_KIT.wadeDepthMax.value ? 'swim' : 'wade';
}
