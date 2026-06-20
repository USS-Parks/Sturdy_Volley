import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STREAMING_CONFIG,
  StreamingController,
  desiredSets,
  type StreamingConfig,
} from '../../src/world/streaming';
import { chunkId, type Region } from '../../src/world/topology';

const REGION: Region = { id: 'willa-crick', label: 'Willa Crick', origin: { x: 0, z: 0 } };
const STILL = { x: 0, z: 0 };

/** Drive a controller to a settled state at a focus point (loads everything). */
function settle(c: StreamingController, focus: { x: number; z: number }): void {
  const diff = c.update(focus, STILL, 0);
  for (const rec of diff.toLoad) c.markLoaded(rec.id, { meshes: 5, bodies: 1 });
}

describe('desiredSets — radius, hysteresis band, look-ahead', () => {
  it('active ring is activeRadius, keep band is keepRadius (still)', () => {
    const sets = desiredSets(REGION, { x: 80, z: 80 }, STILL, DEFAULT_STREAMING_CONFIG);
    expect(sets.focus).toEqual({ cx: 2, cz: 2 });
    expect(sets.active.length).toBe((2 * DEFAULT_STREAMING_CONFIG.activeRadius + 1) ** 2); // 25
    expect(sets.keep.length).toBe((2 * DEFAULT_STREAMING_CONFIG.keepRadius + 1) ** 2); // 49
  });

  it('walking (below threshold) adds no directional look-ahead', () => {
    const slow = desiredSets(REGION, { x: 80, z: 80 }, { x: 3, z: 0 }, DEFAULT_STREAMING_CONFIG);
    expect(slow.keep.length).toBe(49);
  });

  it('horse-speed velocity pulls extra chunks ahead in the travel direction', () => {
    const walk = desiredSets(REGION, { x: 80, z: 80 }, { x: 3, z: 0 }, DEFAULT_STREAMING_CONFIG);
    const gallop = desiredSets(REGION, { x: 80, z: 80 }, { x: 11, z: 0 }, DEFAULT_STREAMING_CONFIG);
    expect(gallop.keep.length).toBeGreaterThan(walk.keep.length);
    // The extra chunks are on the +X (travel) side, beyond the still keep band.
    const maxCxWalk = Math.max(...walk.keep.map((c) => c.cx));
    const maxCxGallop = Math.max(...gallop.keep.map((c) => c.cx));
    expect(maxCxGallop).toBeGreaterThan(maxCxWalk);
  });

  it('faster gallop projects the look-ahead even farther', () => {
    const fast = desiredSets(REGION, { x: 80, z: 80 }, { x: 11, z: 0 }, DEFAULT_STREAMING_CONFIG);
    const faster = desiredSets(REGION, { x: 80, z: 80 }, { x: 22, z: 0 }, DEFAULT_STREAMING_CONFIG);
    expect(Math.max(...faster.keep.map((c) => c.cx))).toBeGreaterThanOrEqual(Math.max(...fast.keep.map((c) => c.cx)));
  });
});

describe('StreamingController — load / unload / hysteresis', () => {
  it('loads the keep band as preloading, promotes to active/loaded on markLoaded', () => {
    const c = new StreamingController(REGION);
    const diff = c.update({ x: 80, z: 80 }, STILL, 0);
    expect(diff.toLoad.length).toBe(49);
    expect(diff.toLoad.every((r) => r.state === 'preloading')).toBe(true);
    for (const rec of diff.toLoad) c.markLoaded(rec.id);
    // Inside activeRadius → active; the hysteresis ring → loaded.
    expect(c.stateOf(c.focusChunkId())).toBe('active');
    const counts = c.allRecords().reduce<Record<string, number>>((m, r) => ({ ...m, [r.state]: (m[r.state] ?? 0) + 1 }), {});
    expect(counts.active).toBe(25);
    expect(counts.loaded).toBe(24);
  });

  it('does not unload a chunk merely for leaving the active ring (hysteresis)', () => {
    const c = new StreamingController(REGION);
    settle(c, { x: 80, z: 80 }); // focus chunk (2,2)
    // Move one chunk east: (3,2) now focus. (0,2) is ring 3 from new focus —
    // still inside keepRadius 3, so it must NOT unload yet.
    const diff = c.update({ x: 112, z: 80 }, STILL, 0);
    expect(diff.toUnload).not.toContain(chunkId(REGION.id, { cx: 0, cz: 2 }));
    expect(c.stateOf(chunkId(REGION.id, { cx: 0, cz: 2 }))).not.toBe('unloaded');
  });

  it('unloads only once a chunk falls beyond keepRadius', () => {
    const c = new StreamingController(REGION);
    settle(c, { x: 80, z: 80 });
    // Jump two chunks east: focus (4,2). (0,2) is ring 4 > keepRadius 3 → unload.
    const diff = c.update({ x: 144, z: 80 }, STILL, 0);
    expect(diff.toUnload).toContain(chunkId(REGION.id, { cx: 0, cz: 2 }));
    expect(c.stateOf(chunkId(REGION.id, { cx: 0, cz: 2 }))).toBe('unloaded');
  });

  it('demotes active→loaded when a chunk leaves the active ring but stays kept', () => {
    const c = new StreamingController(REGION);
    settle(c, { x: 80, z: 80 });
    const farActive = chunkId(REGION.id, { cx: 0, cz: 2 }); // ring 2 = active at focus (2,2)
    expect(c.stateOf(farActive)).toBe('active');
    c.update({ x: 112, z: 80 }, STILL, 0); // focus (3,2); (0,2) now ring 3
    expect(c.stateOf(farActive)).toBe('loaded');
  });
});

describe('StreamingController — budget enforcement', () => {
  it('never admits more than maxLoadedChunks (drops farthest desired)', () => {
    const tight: StreamingConfig = { ...DEFAULT_STREAMING_CONFIG, maxLoadedChunks: 30 };
    const c = new StreamingController(REGION, tight);
    const diff = c.update({ x: 80, z: 80 }, STILL, 0);
    expect(diff.toLoad.length).toBe(30); // capped from the desired 49
    expect(c.allRecords().length).toBe(30);
    // The active ring (the nearest 25) is always admitted.
    expect(c.stateOf(c.focusChunkId())).toBe('preloading');
    expect(diff.toLoad.filter((r) => r.ring <= tight.activeRadius).length).toBe(25);
  });

  it('reports aggregate mesh/body usage and an over flag', () => {
    const c = new StreamingController(REGION, { ...DEFAULT_STREAMING_CONFIG, maxMeshes: 10 });
    settle(c, { x: 80, z: 80 }); // 49 chunks × 5 meshes = 245 > 10
    const b = c.budgetUsage();
    expect(b.loadedChunks).toBe(49);
    expect(b.meshes).toBe(245);
    expect(b.bodies).toBe(49);
    expect(b.over).toBe(true);
  });
});

describe('StreamingController — failure & recovery', () => {
  it('keeps a safe loaded chunk when the focus chunk fails, retries after delay', () => {
    const c = new StreamingController(REGION, { ...DEFAULT_STREAMING_CONFIG, failureRetryMs: 500 });
    const diff = c.update({ x: 80, z: 80 }, STILL, 0);
    const focusId = c.focusChunkId();
    // Load everything except the focus chunk, then fail the focus chunk.
    for (const rec of diff.toLoad) if (rec.id !== focusId) c.markLoaded(rec.id);
    c.markFailed(focusId);
    expect(c.stateOf(focusId)).toBe('failed');
    // A resident neighbour → the player still has valid ground for recovery.
    const safe = c.safeChunkId();
    expect(safe).not.toBeNull();
    expect(safe).not.toBe(focusId);
    expect(['active', 'loaded']).toContain(c.stateOf(safe as string));

    // Before the retry elapses the chunk stays failed…
    c.update({ x: 80, z: 80 }, STILL, 200);
    expect(c.stateOf(focusId)).toBe('failed');
    // …after it elapses the controller re-queues the load.
    c.update({ x: 80, z: 80 }, STILL, 400);
    expect(c.stateOf(focusId)).toBe('preloading');
    c.markLoaded(focusId);
    expect(c.stateOf(focusId)).toBe('active');
  });

  it('safeChunkId prefers the focus chunk once it is loaded', () => {
    const c = new StreamingController(REGION);
    settle(c, { x: 80, z: 80 });
    expect(c.safeChunkId()).toBe(c.focusChunkId());
  });
});

describe('StreamingController — region swap (community transition)', () => {
  it('reports chunks under the new region id after a swap', () => {
    const c = new StreamingController(REGION);
    settle(c, { x: 80, z: 80 });
    const bay: Region = { id: 'ballast-bay', label: 'Ballast Bay', origin: { x: 256, z: 0 } };
    c.setRegion(bay);
    const diff = c.update({ x: 280, z: 48 }, STILL, 0);
    expect(diff.toLoad.every((r) => r.regionId === 'ballast-bay')).toBe(true);
    expect(c.focusChunkId().startsWith('ballast-bay#')).toBe(true);
  });
});
