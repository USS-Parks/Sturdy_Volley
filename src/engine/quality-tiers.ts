/**
 * Quality tiers (WEF-12, master Prompt 052). Pure data. A quality tier changes
 * **density + effects only** — never interaction reach, collision, route
 * availability, schedules, or simulation outcomes (acceptance §2). That invariant
 * is **structural**: a `QualityTier` carries only visual-density / effect fields,
 * so a tier physically cannot encode a gameplay change. `VISUAL_TIER_KEYS` +
 * `INVARIANT_CONCERNS` make the contract explicit for the gate test.
 */

export type QualityTierId = 'low' | 'medium' | 'high';

export interface QualityTier {
  id: QualityTierId;
  label: string;
  /** 0..1 multiplier on flora instance count (visual). */
  floraDensity: number;
  /** 0..1 multiplier on ambient fauna count (visual). */
  faunaDensity: number;
  /** 0..1 multiplier on particle/FX count (visual). */
  particleDensity: number;
  /** Real-time shadows on/off (visual). */
  shadows: boolean;
  /** Atmospheric fog quality (visual). */
  fogQuality: 'off' | 'low' | 'high';
  /** Post-processing on/off (visual). */
  postProcessing: boolean;
  /** Render scale 0.5..1 (dynamic resolution; visual). */
  renderScale: number;
  /** Draw distance in metres (LOD bias; visual). */
  drawDistance: number;
}

/** The only fields a tier may carry — all purely visual. */
export const VISUAL_TIER_KEYS: ReadonlyArray<keyof QualityTier> = [
  'id', 'label', 'floraDensity', 'faunaDensity', 'particleDensity',
  'shadows', 'fogQuality', 'postProcessing', 'renderScale', 'drawDistance',
];

/** Gameplay concerns a tier must NEVER change (not encodable on a QualityTier). */
export const INVARIANT_CONCERNS = [
  'interaction-reach',
  'collision',
  'route-availability',
  'schedules',
  'simulation-outcomes',
] as const;

export const QUALITY_TIERS: Record<QualityTierId, QualityTier> = {
  low: {
    id: 'low', label: 'Low (battery / low-end)',
    floraDensity: 0.4, faunaDensity: 0.5, particleDensity: 0.3,
    shadows: false, fogQuality: 'low', postProcessing: false, renderScale: 0.7, drawDistance: 60,
  },
  medium: {
    id: 'medium', label: 'Medium (default mobile)',
    floraDensity: 0.7, faunaDensity: 0.8, particleDensity: 0.7,
    shadows: true, fogQuality: 'low', postProcessing: false, renderScale: 0.85, drawDistance: 90,
  },
  high: {
    id: 'high', label: 'High (desktop)',
    floraDensity: 1, faunaDensity: 1, particleDensity: 1,
    shadows: true, fogQuality: 'high', postProcessing: true, renderScale: 1, drawDistance: 140,
  },
};

export const DEFAULT_QUALITY_TIER: QualityTierId = 'medium';

export function qualityTier(id: QualityTierId): QualityTier {
  return QUALITY_TIERS[id];
}

/** Whether a tier object only carries visual keys (no smuggled gameplay field). */
export function tierIsVisualOnly(tier: QualityTier): boolean {
  return Object.keys(tier).every((k) => (VISUAL_TIER_KEYS as string[]).includes(k));
}
