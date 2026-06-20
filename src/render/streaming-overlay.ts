/**
 * Streaming debug overlay (WEF-04, master Prompt 035). Optional, gated by
 * `?debug=streaming`. Surfaces the streaming contract the §3.4 debug doctrine
 * asks for: the active region + its origin, the focus chunk, the per-state chunk
 * counts (active / loaded / preloading / failed), and the live budget usage.
 * Pure DOM — no Babylon GUI dependency, no main-bundle weight when off.
 */

import type { BudgetUsage, ChunkRecord, ChunkState } from '../world/streaming';
import type { Vec2 } from '../world/topology';

export interface StreamingSample {
  regionLabel: string;
  origin: Vec2;
  focusChunkId: string;
  counts: Record<ChunkState, number>;
  budget: BudgetUsage;
}

export function isStreamingOverlayEnabled(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get('debug') === 'streaming';
}

/** Tally chunk records by state for the overlay. */
export function countByState(records: readonly ChunkRecord[]): Record<ChunkState, number> {
  const counts: Record<ChunkState, number> = {
    unloaded: 0,
    preloading: 0,
    loaded: 0,
    active: 0,
    failed: 0,
  };
  for (const r of records) counts[r.state] += 1;
  return counts;
}

export interface StreamingOverlayController {
  updateFrom: (sample: StreamingSample) => void;
  destroy: () => void;
}

/** Mount the streaming overlay + return a controller the scene loop drives. */
export function mountStreamingOverlay(parent: HTMLElement = document.body): StreamingOverlayController {
  parent.querySelector('#streaming-overlay')?.remove();
  const root = document.createElement('div');
  root.id = 'streaming-overlay';
  root.dataset.testid = 'streaming-overlay';

  const region = row('region', 'stream-region');
  const focus = row('focus', 'stream-focus');
  const states = row('states', 'stream-states');
  const budget = row('budget', 'stream-budget');
  root.append(region, focus, states, budget);
  parent.appendChild(root);

  return {
    updateFrom(s) {
      region.textContent = `region: ${s.regionLabel} @ (${s.origin.x.toFixed(0)}, ${s.origin.z.toFixed(0)})`;
      focus.textContent = `focus: ${s.focusChunkId}`;
      states.textContent = `A${s.counts.active} L${s.counts.loaded} P${s.counts.preloading} F${s.counts.failed}`;
      budget.textContent = `chunks ${s.budget.loadedChunks}/${s.budget.maxLoadedChunks} · ${s.budget.meshes} m · ${s.budget.bodies} b`;
      budget.dataset.over = s.budget.over ? '1' : '0';
      states.dataset.over = s.counts.failed > 0 ? '1' : '0';
    },
    destroy() {
      root.remove();
    },
  };
}

function row(label: string, testId: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'stream-row';
  el.dataset.testid = testId;
  el.textContent = `${label}: —`;
  return el;
}
