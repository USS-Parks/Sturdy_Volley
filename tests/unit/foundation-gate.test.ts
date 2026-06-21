import { describe, it, expect } from 'vitest';
import {
  foundationEnvironments,
  budgetFor,
  withinBudget,
  INITIAL_DOWNLOAD_BUDGET,
} from '../../src/engine/foundation-budget';
import {
  QUALITY_TIERS,
  VISUAL_TIER_KEYS,
  INVARIANT_CONCERNS,
  tierIsVisualOnly,
  qualityTier,
} from '../../src/engine/quality-tiers';
import {
  DEFAULT_ACCESSIBILITY,
  ACCESSIBILITY_CHECKS,
  CHECK_TO_SETTING,
  validateAccessibility,
  MIN_TOUCH_TARGET_PX,
} from '../../src/engine/accessibility';
import { FOUNDATION_TOUR, TOUR_SPECS } from '../../src/engine/foundation-coverage';
import { CAMERA_CONTEXTS } from '../../src/camera/profiles';
import { ANIMAL_FAMILIES } from '../../src/engine/animal-families';

describe('foundation gate — performance budgets', () => {
  it('defines desktop + mobile budgets for all five WEF environments', () => {
    const envs = foundationEnvironments();
    expect(envs).toHaveLength(5);
    for (const env of envs) {
      for (const platform of ['desktop', 'mobile'] as const) {
        const b = budgetFor(env, platform);
        // The full metric set (acceptance §1) is present + positive.
        for (const k of ['minFps', 'maxDrawCalls', 'maxTriangles', 'maxActiveMeshes', 'maxPhysicsBodies', 'maxCharacterMotors', 'maxNavAgents', 'maxSkinnedMeshes', 'maxDeformingFlora', 'maxStreamedMemoryMB', 'maxChunkTransitionMs', 'maxRegionDownloadMB'] as const) {
          expect(b[k], `${env}/${platform}.${k}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('desktop has headroom over mobile on the GPU-bound metrics', () => {
    const m = budgetFor('breakpoint-farm', 'mobile');
    const d = budgetFor('breakpoint-farm', 'desktop');
    expect(d.maxDrawCalls).toBeGreaterThan(m.maxDrawCalls);
    expect(d.maxTriangles).toBeGreaterThan(m.maxTriangles);
    expect(d.minFps).toBeGreaterThan(m.minFps);
  });

  it('withinBudget flags breaches and passes representative populations', () => {
    const b = budgetFor('ballast-bay-town', 'mobile');
    expect(withinBudget({ drawCalls: 50, triangles: 50000, activeMeshes: 100, fps: 30 }, b).ok).toBe(true);
    const over = withinBudget({ drawCalls: b.maxDrawCalls + 1, fps: 10 }, b);
    expect(over.ok).toBe(false);
    expect(over.breaches.map((x) => x.metric)).toEqual(expect.arrayContaining(['drawCalls', 'fps']));
  });

  it('codifies the initial-download budget', () => {
    expect(INITIAL_DOWNLOAD_BUDGET.maxInitialMB).toBeLessThanOrEqual(INITIAL_DOWNLOAD_BUDGET.hardCapMB);
  });
});

describe('foundation gate — quality tiers (density/effects only)', () => {
  it('has low/medium/high tiers that only carry visual fields', () => {
    expect(Object.keys(QUALITY_TIERS)).toEqual(['low', 'medium', 'high']);
    for (const id of ['low', 'medium', 'high'] as const) {
      expect(tierIsVisualOnly(qualityTier(id)), `${id} visual-only`).toBe(true);
    }
  });

  it('tiers change density + effects, not gameplay invariants', () => {
    const lo = QUALITY_TIERS.low;
    const hi = QUALITY_TIERS.high;
    expect(hi.floraDensity).toBeGreaterThan(lo.floraDensity);
    expect(hi.drawDistance).toBeGreaterThan(lo.drawDistance);
    // The invariants are named + NONE of them appear as a tier field.
    expect(INVARIANT_CONCERNS.length).toBeGreaterThan(0);
    for (const concern of INVARIANT_CONCERNS) {
      expect(VISUAL_TIER_KEYS as readonly string[]).not.toContain(concern);
    }
  });
});

describe('foundation gate — accessibility', () => {
  it('defaults are valid and cover all twelve required controls', () => {
    expect(validateAccessibility(DEFAULT_ACCESSIBILITY)).toEqual([]);
    expect(ACCESSIBILITY_CHECKS).toHaveLength(12);
    for (const check of ACCESSIBILITY_CHECKS) {
      const setting = CHECK_TO_SETTING[check];
      expect(DEFAULT_ACCESSIBILITY[setting], `${check} → ${setting}`).toBeDefined();
    }
  });

  it('enforces the touch-target floor and the sensitivity range', () => {
    expect(validateAccessibility({ ...DEFAULT_ACCESSIBILITY, minTouchTargetPx: MIN_TOUCH_TARGET_PX - 1 }).some((i) => i.code === 'touch-target-too-small')).toBe(true);
    expect(validateAccessibility({ ...DEFAULT_ACCESSIBILITY, cameraSensitivity: 5 }).some((i) => i.code === 'sensitivity-out-of-range')).toBe(true);
  });

  it('supports separate X / Y inversion', () => {
    expect(typeof DEFAULT_ACCESSIBILITY.invertX).toBe('boolean');
    expect(typeof DEFAULT_ACCESSIBILITY.invertY).toBe('boolean');
  });
});

describe('foundation gate — tour coverage (complete vs. the real enums)', () => {
  it('tours every budget environment, with a proving spec per category', () => {
    expect(FOUNDATION_TOUR.environments).toEqual(foundationEnvironments());
    for (const category of Object.keys(FOUNDATION_TOUR) as (keyof typeof FOUNDATION_TOUR)[]) {
      expect(FOUNDATION_TOUR[category].length, `${category} non-empty`).toBeGreaterThan(0);
      expect(TOUR_SPECS[category]?.length, `${category} has specs`).toBeGreaterThan(0);
    }
  });

  it('covers every camera context', () => {
    for (const ctx of CAMERA_CONTEXTS) {
      expect(FOUNDATION_TOUR.cameraContexts, `camera context ${ctx}`).toContain(ctx);
    }
  });

  it('covers every animal family', () => {
    for (const id of Object.keys(ANIMAL_FAMILIES)) {
      expect(FOUNDATION_TOUR.animalFamilies, `animal family ${id}`).toContain(id);
    }
  });
});
