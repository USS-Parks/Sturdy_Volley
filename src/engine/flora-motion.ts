/**
 * Flora & environment motion (WEF-09, master Prompt 045). Pure + deterministic —
 * no Babylon, no DOM. A **Tier-1 visual** layer (§3.3): authored deformation —
 * wind sway, gust response, and transient interaction bend — for grass, crops,
 * shrubs, flowers, trees, reeds, kelp, hanging props (nets/flags), and shoreline
 * foam, with **distance tiers**, **reduced-motion**, **season/weather** inputs,
 * and a hard **active-deformation ceiling** (mobile throttle).
 *
 * Determinism boundary (§3.2): this module **never writes gameplay state**. It
 * returns a transform offset the renderer applies; crop / forage / harvest /
 * regrowth outcomes stay deterministic and are owned elsewhere. Wind itself is
 * driven from explicit `time` + config so the proving ground is reproducible.
 *
 * Silhouettes follow the shape-language families (flowing reef plants as crossed
 * cards + fronds; wind-shaped ridge trees — `sv_theme_03_004_shape_language.png`
 * panels 4–5); distant plants/FX fall back to billboards/impostors per the
 * panel-11 model economy.
 *
 * Units: radians for bend, metres for distance, seconds for time.
 */
import type { Season } from './timeSystem';

/** Mirrors `world/variants.WeatherKind`; kept local so the engine layer is pure. */
export type FloraWeather = 'clear' | 'rain' | 'storm' | 'snow' | 'fog';

export type FloraFamilyId =
  | 'grass'
  | 'crop'
  | 'shrub'
  | 'flower'
  | 'tree'
  | 'reed'
  | 'kelp'
  | 'hanging'
  | 'foam';

/** What drives a family's motion. */
export type MotionSource = 'wind' | 'water' | 'tide';

/** How a mover (player / tool / animal) passing through responds; trees ignore it. */
export type InteractionResponse = 'part' | 'brush' | 'push' | 'none';

export interface FloraFamily {
  id: FloraFamilyId;
  label: string;
  motionSource: MotionSource;
  /** Pivot segments: 1 = single base pivot, 2 = base + mid, etc. */
  bendPoints: number;
  /** 0 = limp, 1 = rigid. Scales how much wind moves it. */
  stiffness: number;
  /** Primary lean (rad) at full drive. */
  swayAmplitude: number;
  /** Secondary tip/branch flutter (rad) at full drive. */
  secondaryAmplitude: number;
  /** How strongly gusts add over the base (0..1). */
  gustResponse: number;
  /** Mover response. */
  interaction: InteractionResponse;
  /** Goes still / dormant in winter (e.g. crops, flowers). */
  seasonDormant: boolean;
  /** Distance tiers [nearMax, midMax] (m): ≤near full · ≤mid reduced · else billboard. */
  distanceTiers: [number, number];
  /** Amplitude (rad) under reduced motion — a tiny ambient, no impulses. */
  reducedMotionAmplitude: number;
  /** Mobile fallback when over budget / far. */
  mobileFallback: 'billboard' | 'static' | 'reduced';
}

export const FLORA_FAMILIES: Record<FloraFamilyId, FloraFamily> = {
  grass: {
    id: 'grass', label: 'Grass tuft', motionSource: 'wind', bendPoints: 1, stiffness: 0.1,
    swayAmplitude: 0.22, secondaryAmplitude: 0.08, gustResponse: 0.8, interaction: 'part',
    seasonDormant: false, distanceTiers: [14, 30], reducedMotionAmplitude: 0.02, mobileFallback: 'billboard',
  },
  crop: {
    id: 'crop', label: 'Crop plant', motionSource: 'wind', bendPoints: 1, stiffness: 0.35,
    swayAmplitude: 0.12, secondaryAmplitude: 0.05, gustResponse: 0.6, interaction: 'brush',
    seasonDormant: true, distanceTiers: [16, 32], reducedMotionAmplitude: 0.015, mobileFallback: 'static',
  },
  shrub: {
    id: 'shrub', label: 'Shrub', motionSource: 'wind', bendPoints: 2, stiffness: 0.55,
    swayAmplitude: 0.08, secondaryAmplitude: 0.06, gustResponse: 0.5, interaction: 'brush',
    seasonDormant: false, distanceTiers: [18, 36], reducedMotionAmplitude: 0.012, mobileFallback: 'static',
  },
  flower: {
    id: 'flower', label: 'Flower', motionSource: 'wind', bendPoints: 1, stiffness: 0.2,
    swayAmplitude: 0.18, secondaryAmplitude: 0.07, gustResponse: 0.7, interaction: 'brush',
    seasonDormant: true, distanceTiers: [12, 26], reducedMotionAmplitude: 0.02, mobileFallback: 'billboard',
  },
  tree: {
    id: 'tree', label: 'Tree + canopy', motionSource: 'wind', bendPoints: 3, stiffness: 0.8,
    swayAmplitude: 0.045, secondaryAmplitude: 0.05, gustResponse: 0.6, interaction: 'none',
    seasonDormant: false, distanceTiers: [40, 80], reducedMotionAmplitude: 0.008, mobileFallback: 'billboard',
  },
  reed: {
    id: 'reed', label: 'Reed', motionSource: 'wind', bendPoints: 2, stiffness: 0.25,
    swayAmplitude: 0.26, secondaryAmplitude: 0.1, gustResponse: 0.85, interaction: 'push',
    seasonDormant: false, distanceTiers: [16, 32], reducedMotionAmplitude: 0.02, mobileFallback: 'billboard',
  },
  kelp: {
    id: 'kelp', label: 'Kelp frond', motionSource: 'water', bendPoints: 3, stiffness: 0.15,
    swayAmplitude: 0.3, secondaryAmplitude: 0.12, gustResponse: 0.2, interaction: 'push',
    seasonDormant: false, distanceTiers: [14, 28], reducedMotionAmplitude: 0.04, mobileFallback: 'reduced',
  },
  hanging: {
    id: 'hanging', label: 'Hanging net / flag', motionSource: 'wind', bendPoints: 2, stiffness: 0.3,
    swayAmplitude: 0.2, secondaryAmplitude: 0.14, gustResponse: 0.9, interaction: 'none',
    seasonDormant: false, distanceTiers: [20, 40], reducedMotionAmplitude: 0.02, mobileFallback: 'static',
  },
  foam: {
    id: 'foam', label: 'Shoreline foam', motionSource: 'tide', bendPoints: 1, stiffness: 0.5,
    swayAmplitude: 0.12, secondaryAmplitude: 0.06, gustResponse: 0.1, interaction: 'none',
    seasonDormant: false, distanceTiers: [16, 30], reducedMotionAmplitude: 0.03, mobileFallback: 'reduced',
  },
};

export function floraFamily(id: FloraFamilyId): FloraFamily {
  return FLORA_FAMILIES[id];
}

// --- Wind -------------------------------------------------------------------

export interface WindConfig {
  /** Prevailing direction (rad, atan2(x, z)). */
  direction: number;
  /** Base strength 0..1. */
  baseStrength: number;
  /** Gust period (s). */
  gustPeriod: number;
  /** Gust strength added over base (0..1). */
  gustStrength: number;
}

export const DEFAULT_WIND: WindConfig = {
  direction: 0.6,
  baseStrength: 0.4,
  gustPeriod: 7,
  gustStrength: 0.4,
};

const TWO_PI = Math.PI * 2;
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Coherent wind strength at a time (0..1): a base plus two incommensurate gust
 * waves so gusts arrive on a believable cadence without a robotic single sine.
 * Deterministic in `time`.
 */
export function windStrength(time: number, wind: WindConfig = DEFAULT_WIND): number {
  const g1 = Math.sin(time * (TWO_PI / wind.gustPeriod)) * 0.5 + 0.5;
  const g2 = Math.sin(time * (TWO_PI / (wind.gustPeriod * 0.37)) + 1.3) * 0.5 + 0.5;
  const gust = g1 * 0.7 + g2 * 0.3;
  return clamp01(wind.baseStrength + gust * wind.gustStrength);
}

/** Wind as a planar unit direction × current strength. */
export function windVector(time: number, wind: WindConfig = DEFAULT_WIND): { x: number; z: number; strength: number } {
  const s = windStrength(time, wind);
  return { x: Math.sin(wind.direction) * s, z: Math.cos(wind.direction) * s, strength: s };
}

/**
 * Season + weather modulation of the wind drive. Storm/rain strengthen it,
 * snow/fog calm it, winter stiffens (a touch weaker). Returns a new WindConfig.
 */
export function modulateWind(base: WindConfig, season: Season, weather: FloraWeather): WindConfig {
  let mult = 1;
  if (weather === 'storm') mult = 2.2;
  else if (weather === 'rain') mult = 1.4;
  else if (weather === 'snow') mult = 0.8;
  else if (weather === 'fog') mult = 0.5;
  if (season === 'winter') mult *= 0.85;
  return {
    ...base,
    baseStrength: clamp01(base.baseStrength * mult),
    gustStrength: clamp01(base.gustStrength * mult),
  };
}

// --- Per-instance sway ------------------------------------------------------

/** Steady drive (0..1) for water/tide families (no wind gusts), gently undulating. */
function ambientDrive(time: number, period: number): number {
  return 0.55 + 0.25 * (Math.sin(time * (TWO_PI / period)) * 0.5 + 0.5);
}

/**
 * Per-instance bend angle (rad) this frame. `instancePhase` is a stable per-plant
 * offset so a field of the same family never moves in lockstep. Wind families
 * track the gusting wind; water/kelp + tide/foam track a steady current. Reduced
 * motion collapses to a tiny ambient amplitude with no gust impulse.
 */
export function swayAngle(
  family: FloraFamily,
  instancePhase: number,
  time: number,
  wind: WindConfig = DEFAULT_WIND,
  reducedMotion = false,
): number {
  const drive = family.motionSource === 'wind'
    ? windStrength(time, wind)
    : ambientDrive(time, family.id === 'kelp' ? 5 : 6);
  const softness = 1 - family.stiffness;
  const amp = reducedMotion ? family.reducedMotionAmplitude : family.swayAmplitude;
  const w = time * 1.2 + instancePhase;
  const primary = Math.sin(w) * amp * drive * (reducedMotion ? 1 : softness);
  // Secondary tip/branch flutter, weighted by how much the family answers gusts.
  const secondary = reducedMotion
    ? 0
    : Math.sin(w * 3.1 + instancePhase * 2) * family.secondaryAmplitude * drive * (0.5 + family.gustResponse);
  return primary + secondary;
}

/**
 * Transient bend (rad) when a mover (player/tool/animal) passes within `radius`.
 * `interaction: 'none'` families (trees, hanging props) ignore it. Owned by the
 * mover, separate from wind — and read-only over gameplay state.
 */
export function interactionBend(family: FloraFamily, distance: number, radius: number): number {
  if (family.interaction === 'none' || distance >= radius || radius <= 0) return 0;
  const t = 1 - distance / radius;
  const k = family.interaction === 'push' ? 0.9 : family.interaction === 'part' ? 0.6 : 0.4;
  return t * k;
}

// --- Distance tiers + active-deformation ceiling ----------------------------

export type FloraTier = 'full' | 'reduced' | 'billboard';

/** Tier for one instance by distance + its family's tier thresholds. */
export function floraTier(distance: number, family: FloraFamily): FloraTier {
  const [nearMax, midMax] = family.distanceTiers;
  if (distance <= nearMax) return 'full';
  if (distance <= midMax) return 'reduced';
  return 'billboard';
}

export interface FloraPerfConfig {
  /** Hard ceiling on instances doing full deformation at once (mobile throttle). */
  activeCap: number;
  /** Ceiling on the cheaper 'reduced' tier before the rest go billboard. */
  reducedCap: number;
}

export const DEFAULT_FLORA_PERF: FloraPerfConfig = { activeCap: 48, reducedCap: 96 };

export interface FloraInstanceRef {
  id: string;
  distance: number;
  family: FloraFamily;
}

/**
 * Assign render tiers across a field, enforcing the active-deformation ceiling:
 * nearest-within-range instances get 'full' up to `activeCap`, the next get
 * 'reduced' up to `reducedCap`, the rest fall back to 'billboard'. Deterministic
 * (ties break by id) so a frame's tiering is reproducible.
 */
export function assignFloraTiers(
  instances: ReadonlyArray<FloraInstanceRef>,
  cfg: FloraPerfConfig = DEFAULT_FLORA_PERF,
): Map<string, FloraTier> {
  const sorted = [...instances].sort((a, b) => a.distance - b.distance || (a.id < b.id ? -1 : 1));
  const out = new Map<string, FloraTier>();
  let full = 0;
  let reduced = 0;
  for (const inst of sorted) {
    const want = floraTier(inst.distance, inst.family);
    if (want === 'full' && full < cfg.activeCap) {
      out.set(inst.id, 'full');
      full++;
    } else if ((want === 'full' || want === 'reduced') && reduced < cfg.reducedCap) {
      out.set(inst.id, 'reduced');
      reduced++;
    } else {
      out.set(inst.id, 'billboard');
    }
  }
  return out;
}

/** Count instances at the 'full' (active-deforming) tier. */
export function activeDeformingCount(tiers: Map<string, FloraTier>): number {
  let n = 0;
  for (const t of tiers.values()) if (t === 'full') n++;
  return n;
}
