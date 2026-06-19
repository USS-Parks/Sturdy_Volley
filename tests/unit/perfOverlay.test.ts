import { describe, it, expect, beforeEach } from 'vitest';
import {
  budgetFor,
  isPerfOverlayEnabled,
  MOBILE_BUDGETS,
  mountPerfOverlay,
  passesBudget,
  type PerfSample,
} from '../../src/render/perf-overlay';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('isPerfOverlayEnabled', () => {
  it('reads ?debug=perf from the search string', () => {
    expect(isPerfOverlayEnabled('?debug=perf')).toBe(true);
    expect(isPerfOverlayEnabled('?debug=other')).toBe(false);
    expect(isPerfOverlayEnabled('')).toBe(false);
    expect(isPerfOverlayEnabled('?foo=bar&debug=perf&x=1')).toBe(true);
  });
});

describe('budgetFor', () => {
  it('returns the per-scene budget', () => {
    expect(budgetFor('Farm')).toEqual(MOBILE_BUDGETS.Farm);
    expect(budgetFor('Interior')).toEqual(MOBILE_BUDGETS.Interior);
  });

  it('falls back to a conservative default for unknown scenes', () => {
    const def = budgetFor('Unknown');
    expect(def.drawCalls).toBe(180);
    expect(def.activeMeshes).toBe(140);
  });
});

describe('passesBudget', () => {
  const farm: PerfSample = { fps: 60, drawCalls: 150, activeMeshes: 120, triangles: 90_000 };
  it('passes when every counter is within budget', () => {
    expect(passesBudget(farm, MOBILE_BUDGETS.Farm!)).toBe(true);
  });

  it('fails when any single counter is over', () => {
    expect(
      passesBudget({ ...farm, drawCalls: 999 }, MOBILE_BUDGETS.Farm!),
    ).toBe(false);
    expect(passesBudget({ ...farm, fps: 15 }, MOBILE_BUDGETS.Farm!)).toBe(false);
  });
});

describe('mountPerfOverlay', () => {
  it('mounts a single overlay element with the expected cells', () => {
    const ctrl = mountPerfOverlay();
    expect(document.querySelector('[data-testid="perf-overlay"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="fps"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="perf-draws"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="perf-meshes"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="perf-tris"]')).toBeTruthy();
    ctrl.destroy();
  });

  it('updateFrom paints over-budget cells with the over flag', () => {
    const ctrl = mountPerfOverlay();
    ctrl.updateFrom(
      { fps: 60, drawCalls: 999, activeMeshes: 50, triangles: 50_000 },
      MOBILE_BUDGETS.Farm,
    );
    const draws = document.querySelector('[data-testid="perf-draws"]');
    expect(draws?.getAttribute('data-over')).toBe('1');
    const fps = document.querySelector('[data-testid="fps"]');
    expect(fps?.getAttribute('data-over')).toBe('0');
    ctrl.destroy();
  });

  it('destroy removes the element', () => {
    const ctrl = mountPerfOverlay();
    ctrl.destroy();
    expect(document.querySelector('[data-testid="perf-overlay"]')).toBeNull();
  });

  it('mounting again replaces the previous element', () => {
    mountPerfOverlay();
    mountPerfOverlay();
    expect(document.querySelectorAll('[data-testid="perf-overlay"]')).toHaveLength(1);
  });
});
