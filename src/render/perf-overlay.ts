import type { Engine, Scene } from '@babylonjs/core';

/**
 * Performance overlay (VS-A1). Optional, gated by `?debug=perf` in the URL.
 * Shows the four observability numbers the mobile budget cares about:
 * FPS, active draw calls, active mesh count, and active triangle count.
 * Pure DOM — no Babylon GUI dependency, no main-bundle weight when off.
 */
export interface PerfSample {
  fps: number;
  drawCalls: number;
  activeMeshes: number;
  triangles: number;
}

/**
 * Mobile budgets per scene class. These are the numbers Playwright asserts
 * against on the Pixel 5 viewport. Desktop has 2× headroom by convention.
 */
export const MOBILE_BUDGETS: Record<string, PerfSample> = {
  Farm: { fps: 30, drawCalls: 220, activeMeshes: 180, triangles: 220_000 },
  Town: { fps: 30, drawCalls: 220, activeMeshes: 200, triangles: 220_000 },
  Interior: { fps: 30, drawCalls: 140, activeMeshes: 120, triangles: 100_000 },
  Beach: { fps: 30, drawCalls: 180, activeMeshes: 140, triangles: 160_000 },
  Mine: { fps: 30, drawCalls: 180, activeMeshes: 140, triangles: 160_000 },
};

export function isPerfOverlayEnabled(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get('debug') === 'perf';
}

/**
 * Read one sample from the active Babylon scene. The renderer tracks the
 * counters we care about; we don't accumulate anything ourselves.
 */
export function sampleScene(engine: Engine, scene: Scene | null): PerfSample {
  if (!scene) return { fps: 0, drawCalls: 0, activeMeshes: 0, triangles: 0 };
  const drawCalls = scene.getActiveMeshes().length; // 1 draw call per active mesh as a floor estimate
  const activeMeshes = scene.getActiveMeshes().length;
  let triangles = 0;
  for (const mesh of scene.meshes) {
    if (!mesh.isEnabled() || !mesh.isVisible) continue;
    triangles += mesh.getTotalIndices() / 3;
  }
  return {
    fps: Math.round(engine.getFps()),
    drawCalls,
    activeMeshes,
    triangles: Math.round(triangles),
  };
}

export interface PerfOverlayController {
  setLabel: (label: string) => void;
  updateFrom: (sample: PerfSample, budget?: PerfSample) => void;
  destroy: () => void;
}

/**
 * Mount the perf overlay element + return a controller the scene loop drives.
 * Idempotent — calling twice replaces the existing element.
 */
export function mountPerfOverlay(parent: HTMLElement = document.body): PerfOverlayController {
  parent.querySelector('#perf-overlay')?.remove();
  const root = document.createElement('div');
  root.id = 'perf-overlay';
  root.dataset.testid = 'perf-overlay';

  const label = document.createElement('div');
  label.className = 'perf-label';
  label.dataset.testid = 'perf-label';
  label.textContent = 'scene: —';

  const grid = document.createElement('div');
  grid.className = 'perf-grid';
  const cells: Record<keyof PerfSample, HTMLDivElement> = {
    fps: makeCell('fps', 'fps'),
    drawCalls: makeCell('draws', 'perf-draws'),
    activeMeshes: makeCell('meshes', 'perf-meshes'),
    triangles: makeCell('tris', 'perf-tris'),
  };
  grid.append(cells.fps, cells.drawCalls, cells.activeMeshes, cells.triangles);

  root.append(label, grid);
  parent.appendChild(root);

  return {
    setLabel(text) {
      label.textContent = `scene: ${text}`;
    },
    updateFrom(sample, budget) {
      cells.fps.textContent = `${sample.fps} fps`;
      cells.drawCalls.textContent = `${sample.drawCalls} dc`;
      cells.activeMeshes.textContent = `${sample.activeMeshes} m`;
      cells.triangles.textContent = `${sample.triangles.toLocaleString()} tris`;
      cells.fps.dataset.over = budget && sample.fps < budget.fps ? '1' : '0';
      cells.drawCalls.dataset.over =
        budget && sample.drawCalls > budget.drawCalls ? '1' : '0';
      cells.activeMeshes.dataset.over =
        budget && sample.activeMeshes > budget.activeMeshes ? '1' : '0';
      cells.triangles.dataset.over =
        budget && sample.triangles > budget.triangles ? '1' : '0';
    },
    destroy() {
      root.remove();
    },
  };
}

function makeCell(label: string, testId: string): HTMLDivElement {
  const cell = document.createElement('div');
  cell.className = 'perf-cell';
  cell.dataset.testid = testId;
  cell.textContent = `0 ${label}`;
  return cell;
}

/**
 * Whether a sample passes its budget. Used by tests + the live overlay to
 * paint over-budget numbers red.
 */
export function passesBudget(sample: PerfSample, budget: PerfSample): boolean {
  return (
    sample.fps >= budget.fps &&
    sample.drawCalls <= budget.drawCalls &&
    sample.activeMeshes <= budget.activeMeshes &&
    sample.triangles <= budget.triangles
  );
}

/** Look up the budget for a scene key, falling back to a conservative default. */
export function budgetFor(sceneKey: string): PerfSample {
  return MOBILE_BUDGETS[sceneKey] ?? { fps: 30, drawCalls: 180, activeMeshes: 140, triangles: 160_000 };
}
