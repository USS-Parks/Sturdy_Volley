/**
 * Interior construction kit — metric modules (WEF-05, master Prompt 036).
 *
 * Pure data + validation — no Babylon import — so the spatial grammar of every
 * interior (farmhouse rooms, shops, homes, public halls, cavern-like enclosures)
 * is unit-testable and shared by the graybox builder (src/render/interior-builder.ts)
 * and the proving ground. Dimensions reconcile with docs/SCALE_AND_PERFORMANCE.md
 * §1 (1 unit = 1 m; 1.8 m player; 3.0–4.0 m walls; ≥1.0 m × 1.8 m doorways) and
 * the art-board scale guide (`sv_style_007_camera_scale_guide.png`).
 *
 * Interiors may break the exterior footprint illusion when playability requires
 * it (§ Prompt 036). When a room's interior footprint exceeds the building's
 * exterior shell, that expansion is recorded on the spec (`footprintExpansion`)
 * so the seam between exterior and interior space is an explicit, auditable
 * decision rather than an accident.
 */

/** Canonical interior dimensions, in metres. The kit's single source of truth. */
export const INTERIOR_METRICS = {
  /** Wall thickness (collision proxy + visible shell). */
  wallThickness: 0.3,
  /** Interior wall height — mid-band of the 3.0–4.0 m convention. */
  wallHeight: 3.2,
  /** Ceiling slab thickness. */
  ceilingThickness: 0.3,
  /** Floor slab thickness. */
  floorThickness: 0.2,
  doorway: {
    /** ≥ 1.0 m so the 0.8 m-diameter player capsule passes without clipping. */
    width: 1.2,
    /** ≥ 1.8 m clearance. */
    height: 2.0,
  },
  window: {
    width: 1.0,
    height: 1.1,
    /** Sill height off the floor. */
    sill: 0.9,
  },
  stair: {
    /** Rise per step — within the motor's step-offset so traversal is smooth. */
    rise: 0.18,
    /** Run (tread depth) per step. */
    run: 0.28,
    /** Stair clear width. */
    width: 1.4,
  },
  /** Shop/kitchen counter. */
  counter: {
    height: 1.0,
    depth: 0.7,
  },
  /** Walkable gap that must remain clear around a furniture footprint. */
  furnitureClearance: 0.8,
  /** One-button interaction reach inside an interior. */
  interactionReach: 1.5,
  /** Minimum walkable corridor / navigation width (capsule + comfort margin). */
  navCorridorWidth: 1.4,
} as const;

/** Which wall a doorway / window sits on. */
export type WallSide = 'north' | 'south' | 'east' | 'west';

/** A doorway opening in a room wall. */
export interface Doorway {
  id: string;
  side: WallSide;
  /** Signed offset (m) of the opening centre from the wall's midpoint. */
  offset: number;
  width?: number;
  height?: number;
  /** Stable anchor this doorway transitions to (exterior or another room). */
  toAnchorId?: string;
}

/** A window opening in a room wall (no traversal; affects wall segmentation). */
export interface WindowSpec {
  id: string;
  side: WallSide;
  offset: number;
  width?: number;
}

/** A free-standing interior feature occupying floor space (counter, stair, furniture). */
export interface InteriorFeature {
  id: string;
  kind: 'counter' | 'stair' | 'furniture' | 'interaction';
  /** Footprint centre relative to the room centre (XZ, m). */
  at: { x: number; z: number };
  /** Footprint size (XZ, m). */
  size: { w: number; d: number };
}

/** One authored interior room. */
export interface RoomSpec {
  id: string;
  /** Interior footprint (m). */
  width: number;
  depth: number;
  /** Interior clear height; defaults to INTERIOR_METRICS.wallHeight. */
  height?: number;
  doorways: Doorway[];
  windows?: WindowSpec[];
  features?: InteriorFeature[];
  /** Recorded interior-over-exterior expansion (m²) when the room is bigger
   *  inside than its building shell (the "bigger on the inside" allowance). */
  footprintExpansion?: number;
}

/** A validation issue found on a room spec. */
export interface RoomIssue {
  code: 'doorway-clearance' | 'nav-width' | 'ceiling-height' | 'feature-clearance' | 'doorway-side-overflow';
  message: string;
}

const roomHeight = (spec: RoomSpec): number => spec.height ?? INTERIOR_METRICS.wallHeight;
const doorWidth = (d: Doorway): number => d.width ?? INTERIOR_METRICS.doorway.width;
const doorHeight = (d: Doorway): number => d.height ?? INTERIOR_METRICS.doorway.height;

/** Length of the wall a side runs along. */
export function wallLength(spec: RoomSpec, side: WallSide): number {
  return side === 'north' || side === 'south' ? spec.width : spec.depth;
}

/**
 * Validate a room against the metric kit. Returns every issue found (empty =
 * conformant). Checks the load-bearing playability rules: doorways clear the
 * player, openings stay within their wall, the ceiling clears the player, and
 * furniture leaves a navigable gap.
 */
export function validateRoomSpec(spec: RoomSpec): RoomIssue[] {
  const issues: RoomIssue[] = [];
  const m = INTERIOR_METRICS;

  if (roomHeight(spec) < m.doorway.height) {
    issues.push({ code: 'ceiling-height', message: `room ${spec.id} ceiling ${roomHeight(spec)} m below doorway height ${m.doorway.height} m` });
  }

  for (const d of spec.doorways) {
    // A doorway is a pinch point: it must clear the ≥1.0 m doorway minimum (the
    // capsule passes), not the wider open-corridor nav width.
    if (doorWidth(d) < m.doorway.width - 1e-9) {
      issues.push({ code: 'doorway-clearance', message: `doorway ${d.id} width ${doorWidth(d)} m below doorway minimum ${m.doorway.width} m` });
    }
    if (doorHeight(d) < m.doorway.height - 1e-9) {
      issues.push({ code: 'doorway-clearance', message: `doorway ${d.id} height ${doorHeight(d)} m below ${m.doorway.height} m` });
    }
    // The opening must fit within its wall span.
    const half = wallLength(spec, d.side) / 2;
    if (Math.abs(d.offset) + doorWidth(d) / 2 > half + 1e-9) {
      issues.push({ code: 'doorway-side-overflow', message: `doorway ${d.id} overflows the ${d.side} wall` });
    }
  }

  // Each feature must leave at least the furniture-clearance gap to one room
  // edge along X or Z (a crude but deterministic walkability floor).
  for (const f of spec.features ?? []) {
    const clearX = spec.width / 2 - (Math.abs(f.at.x) + f.size.w / 2);
    const clearZ = spec.depth / 2 - (Math.abs(f.at.z) + f.size.d / 2);
    if (Math.max(clearX, clearZ) < m.furnitureClearance - 1e-9) {
      issues.push({ code: 'feature-clearance', message: `feature ${f.id} leaves no ${m.furnitureClearance} m walkable gap` });
    }
  }

  return issues;
}

/** Whether a room spec is fully conformant. */
export function isRoomConformant(spec: RoomSpec): boolean {
  return validateRoomSpec(spec).length === 0;
}

/**
 * Wall segments for one side after subtracting its doorway/window openings,
 * returned as `[start, end]` spans along the wall's local axis (centred at 0).
 * The builder turns each span into a wall box; the gaps are the openings. A
 * doorway gap runs full height; a window gap is filled below the sill and above
 * the head by the builder, so this returns the horizontal spans only.
 */
export function wallSpans(spec: RoomSpec, side: WallSide): Array<[number, number]> {
  const len = wallLength(spec, side);
  const half = len / 2;
  const openings: Array<[number, number]> = [];
  for (const d of spec.doorways) {
    if (d.side !== side) continue;
    const w = doorWidth(d);
    openings.push([d.offset - w / 2, d.offset + w / 2]);
  }
  for (const win of spec.windows ?? []) {
    if (win.side !== side) continue;
    const w = win.width ?? INTERIOR_METRICS.window.width;
    openings.push([win.offset - w / 2, win.offset + w / 2]);
  }
  openings.sort((a, b) => a[0] - b[0]);

  const spans: Array<[number, number]> = [];
  let cursor = -half;
  for (const [a, b] of openings) {
    const start = Math.max(a, -half);
    if (start > cursor + 1e-6) spans.push([cursor, start]);
    cursor = Math.max(cursor, Math.min(b, half));
  }
  if (cursor < half - 1e-6) spans.push([cursor, half]);
  return spans;
}
