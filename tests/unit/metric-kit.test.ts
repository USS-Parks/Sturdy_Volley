import { describe, it, expect } from 'vitest';
import {
  BODY,
  METRIC_KIT,
  routeSupports,
  routeSupportsAll,
  routeWidthOk,
  slopeWalkable,
  mediumForDepth,
} from '../../src/world/metric-kit';
import { DEFAULT_MOTOR_CONFIG } from '../../src/engine/motor';
import { INTERIOR_METRICS } from '../../src/world/interior-kit';

describe('metric kit — reconciliation with the motor + interior kit', () => {
  it('mirrors the motor thresholds (so a walkable route really is walkable)', () => {
    expect(BODY.capsule).toBe(DEFAULT_MOTOR_CONFIG.capsuleRadius * 2);
    expect(METRIC_KIT.slopeMaxDeg.value).toBe(DEFAULT_MOTOR_CONFIG.slopeLimitDeg);
    expect(METRIC_KIT.stepMax.value).toBe(DEFAULT_MOTOR_CONFIG.stepOffset);
    expect(METRIC_KIT.wadeDepthMax.value).toBe(DEFAULT_MOTOR_CONFIG.swimDepth);
  });

  it('mirrors the interior kit dimensions', () => {
    expect(METRIC_KIT.doorway.value).toBe(INTERIOR_METRICS.doorway.width);
    expect(METRIC_KIT.doorway.secondary).toBe(INTERIOR_METRICS.doorway.height);
    expect(METRIC_KIT.navCorridor.value).toBe(INTERIOR_METRICS.navCorridorWidth);
    expect(METRIC_KIT.stair.value).toBe(INTERIOR_METRICS.stair.run);
  });

  it('gives every element a tolerance', () => {
    for (const [key, el] of Object.entries(METRIC_KIT)) {
      expect(el.tolerance, `${key} has a tolerance`).toBeGreaterThanOrEqual(0);
      expect(el.value, `${key} has a positive value`).toBeGreaterThan(0);
    }
  });
});

describe('route body support', () => {
  it('routeSupports reflects body widths + comfort margin', () => {
    expect(routeSupports(1.6)).toEqual({ capsule: true, smallAnimal: true, largeAnimal: true });
    expect(routeSupports(1.0)).toEqual({ capsule: true, smallAnimal: true, largeAnimal: false });
    expect(routeSupports(0.9)).toEqual({ capsule: false, smallAnimal: true, largeAnimal: false });
  });

  it('routeSupportsAll requires the large-animal body', () => {
    expect(routeSupportsAll(1.6)).toBe(true);
    expect(routeSupportsAll(1.2)).toBe(false);
  });

  it('routeWidthOk applies per-kind body requirements', () => {
    // Footpaths/desire-lines/corridors: capsule + small animal is enough.
    expect(routeWidthOk('desire-line', METRIC_KIT.desireLine.value)).toBe(true); // 1.2
    expect(routeWidthOk('path', METRIC_KIT.path.value)).toBe(true); // 1.6
    // Mount/cart routes must clear the large-animal body.
    expect(routeWidthOk('road', METRIC_KIT.road.value)).toBe(true); // 3.0
    expect(routeWidthOk('road', 1.2)).toBe(false); // too narrow for a large body
    expect(routeWidthOk('bridge', METRIC_KIT.bridge.value)).toBe(true); // 1.8
    expect(routeWidthOk('dock', METRIC_KIT.dock.value)).toBe(true); // 2.0
    // Anything below capsule clearance fails outright.
    expect(routeWidthOk('path', 0.8)).toBe(false);
  });
});

describe('terrain helpers', () => {
  it('slopeWalkable tracks the motor slope limit', () => {
    expect(slopeWalkable(DEFAULT_MOTOR_CONFIG.slopeLimitDeg)).toBe(true);
    expect(slopeWalkable(DEFAULT_MOTOR_CONFIG.slopeLimitDeg + 1)).toBe(false);
  });

  it('mediumForDepth splits dry / wade / swim at the motor swim depth', () => {
    expect(mediumForDepth(0)).toBe('dry');
    expect(mediumForDepth(0.5)).toBe('wade');
    expect(mediumForDepth(DEFAULT_MOTOR_CONFIG.swimDepth)).toBe('wade');
    expect(mediumForDepth(DEFAULT_MOTOR_CONFIG.swimDepth + 0.1)).toBe('swim');
  });
});
