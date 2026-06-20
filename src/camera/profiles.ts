/**
 * Data-driven camera profiles + the pure math the rig runs each frame
 * (WEF-01b, master Prompt 029). No Babylon import lives here so the orbit /
 * recenter / look-ahead / obstruction behaviour is unit-testable and the rig
 * (src/camera/rig.ts) is a thin binding over these functions.
 *
 * Every behavioural knob is profile data: the rig holds no hard-coded tuning, so
 * the camera can be retuned (and Prompt 030's baselines locked) purely by
 * editing CAMERA_PROFILES.
 *
 * Angle conventions:
 *  - `pitchDeg` is the **downward view** angle of the §2 table — how far below
 *    horizontal the camera looks down at the target.
 *  - Babylon's ArcRotateCamera `beta` is the polar angle from +Y (up): beta 90°
 *    is horizontal, smaller beta is more top-down. So beta = 90° − pitchDeg.
 */

export type CameraContextId =
  | 'exterior'
  | 'farm'
  | 'smallInterior'
  | 'largeInterior'
  | 'cave'
  | 'water'
  | 'mounted';

export const CAMERA_CONTEXTS: readonly CameraContextId[] = [
  'exterior',
  'farm',
  'smallInterior',
  'largeInterior',
  'cave',
  'water',
  'mounted',
];

export interface ObstructionConfig {
  /** Probe sphere radius (m) used when sweeping camera → target. */
  probeRadius: number;
  /** Hard floor the camera may be pulled in to (m) when blocked. */
  minDistance: number;
  /** Pull-in / push-out blend rate (m/s). */
  pullSpeed: number;
  /** If the blocker is closer than this fraction of follow distance, fade
   *  occluders rather than (or as well as) pulling in. 0..1. */
  fadeThreshold: number;
}

export interface CameraProfile {
  id: string;
  context: CameraContextId;
  variant: string;
  /** Downward view in degrees (the §2 table column). */
  pitchDeg: number;
  /** Follow distance in metres. */
  followDistance: number;
  /** Vertical FOV in degrees. */
  fovDeg: number;
  /** ± manual orbit limit from the rest heading, in degrees. null = unbounded. */
  yawLimitDeg: number | null;
  /** Seconds of no manual input before auto-recenter begins. */
  recenterDelay: number;
  /** Auto-recenter blend rate toward the rest yaw (rad/s). */
  recenterSpeed: number;
  /** Target look-ahead: metres of lead per (m/s) of planar target speed. */
  lookAheadGain: number;
  /** Clamp on look-ahead lead distance (m). */
  lookAheadMax: number;
  /** Follow-position smoothing time constant (s); larger = laggier. */
  followLag: number;
  obstruction: ObstructionConfig;
}

const DEG2RAD = Math.PI / 180;

/** Babylon ArcRotateCamera beta (rad) for a given downward view in degrees. */
export function betaFromPitchDeg(pitchDeg: number): number {
  return (90 - pitchDeg) * DEG2RAD;
}

/** Vertical FOV in radians for a given FOV in degrees. */
export function fovRadFromDeg(fovDeg: number): number {
  return fovDeg * DEG2RAD;
}

const STD_OBSTRUCTION: ObstructionConfig = {
  probeRadius: 0.3,
  minDistance: 1.6,
  pullSpeed: 24,
  fadeThreshold: 0.5,
};

/** Tighter obstruction recovery for enclosed / fast contexts. */
const TIGHT_OBSTRUCTION: ObstructionConfig = {
  probeRadius: 0.3,
  minDistance: 1.2,
  pullSpeed: 36,
  fadeThreshold: 0.6,
};

/**
 * The full profile catalogue: three variants per §2 context spanning that
 * context's parameter range. Prompt 030 selects one baseline per context from
 * these and records the decision; until then all three are switchable live.
 */
export const CAMERA_PROFILES: readonly CameraProfile[] = [
  // Exterior exploration — 28–35°, 8–11 m, 45–50°. Bounded orbit, delayed recenter.
  prof('exterior', 'near', 28, 8, 50, 180, 2.6, 1.6, 0.35, 3, 0.18, STD_OBSTRUCTION),
  prof('exterior', 'standard', 31, 9.5, 47, 180, 2.4, 1.8, 0.4, 3.5, 0.16, STD_OBSTRUCTION),
  prof('exterior', 'far', 35, 11, 45, 180, 2.2, 2.0, 0.45, 4, 0.15, STD_OBSTRUCTION),

  // Farm / precision — 38–46°, 8–10 m, 43–48°. Damped yaw, stable cells.
  prof('farm', 'near', 38, 8, 48, 55, 1.6, 2.6, 0.2, 2, 0.2, STD_OBSTRUCTION),
  prof('farm', 'standard', 42, 9, 45, 60, 1.4, 2.8, 0.22, 2.2, 0.18, STD_OBSTRUCTION),
  prof('farm', 'far', 46, 10, 43, 65, 1.2, 3.0, 0.24, 2.4, 0.16, STD_OBSTRUCTION),

  // Small interior — 35–45°, 5–7 m, 48–55°. Authored volume; wall fade/cutaway.
  prof('smallInterior', 'near', 35, 5, 55, 30, 1.0, 3.4, 0.12, 1.4, 0.14, TIGHT_OBSTRUCTION),
  prof('smallInterior', 'standard', 40, 6, 51, 35, 0.9, 3.6, 0.14, 1.6, 0.12, TIGHT_OBSTRUCTION),
  prof('smallInterior', 'far', 45, 7, 48, 40, 0.8, 3.8, 0.16, 1.8, 0.11, TIGHT_OBSTRUCTION),

  // Large public interior — 30–40°, 7–9 m, 45–52°.
  prof('largeInterior', 'near', 30, 7, 52, 50, 1.4, 2.8, 0.18, 2, 0.16, TIGHT_OBSTRUCTION),
  prof('largeInterior', 'standard', 35, 8, 48, 60, 1.3, 3.0, 0.2, 2.2, 0.14, TIGHT_OBSTRUCTION),
  prof('largeInterior', 'far', 40, 9, 45, 70, 1.2, 3.2, 0.22, 2.4, 0.13, TIGHT_OBSTRUCTION),

  // Cave exploration / combat — 20–29°, 6–8 m, 48–55°. Tighter, faster recovery.
  prof('cave', 'near', 20, 6, 55, 40, 1.0, 3.6, 0.16, 1.8, 0.12, TIGHT_OBSTRUCTION),
  prof('cave', 'standard', 24, 7, 51, 45, 0.9, 3.8, 0.18, 2, 0.11, TIGHT_OBSTRUCTION),
  prof('cave', 'far', 29, 8, 48, 50, 0.8, 4.0, 0.2, 2.2, 0.1, TIGHT_OBSTRUCTION),

  // Contextual swim / wade — 25–34°, 8–10 m, 46–52°. Horizon + shore legible.
  prof('water', 'near', 25, 8, 52, 60, 1.8, 2.4, 0.3, 2.6, 0.18, STD_OBSTRUCTION),
  prof('water', 'standard', 29, 9, 49, 70, 1.6, 2.6, 0.34, 2.8, 0.16, STD_OBSTRUCTION),
  prof('water', 'far', 34, 10, 46, 80, 1.4, 2.8, 0.38, 3, 0.15, STD_OBSTRUCTION),

  // Mounted / horseback — 26–32°, 9–12 m, 46–52°. Wider, gait-scaled look-ahead.
  prof('mounted', 'near', 26, 9, 52, 80, 1.8, 2.2, 0.5, 5, 0.2, TIGHT_OBSTRUCTION),
  prof('mounted', 'standard', 29, 10.5, 49, 90, 1.6, 2.4, 0.6, 6, 0.18, TIGHT_OBSTRUCTION),
  prof('mounted', 'far', 32, 12, 46, 100, 1.4, 2.6, 0.7, 7, 0.16, TIGHT_OBSTRUCTION),
];

function prof(
  context: CameraContextId,
  variant: string,
  pitchDeg: number,
  followDistance: number,
  fovDeg: number,
  yawLimitDeg: number | null,
  recenterDelay: number,
  recenterSpeed: number,
  lookAheadGain: number,
  lookAheadMax: number,
  followLag: number,
  obstruction: ObstructionConfig,
): CameraProfile {
  return {
    id: `${context}:${variant}`,
    context,
    variant,
    pitchDeg,
    followDistance,
    fovDeg,
    yawLimitDeg,
    recenterDelay,
    recenterSpeed,
    lookAheadGain,
    lookAheadMax,
    followLag,
    obstruction,
  };
}

/** All profiles for a context, in catalogue (near→far) order. */
export function variantsForContext(context: CameraContextId): CameraProfile[] {
  return CAMERA_PROFILES.filter((p) => p.context === context);
}

/** Look up a profile by `context:variant` id. */
export function profileById(id: string): CameraProfile | undefined {
  return CAMERA_PROFILES.find((p) => p.id === id);
}
