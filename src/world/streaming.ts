/**
 * Exterior chunk streaming controller (WEF-04, master Prompt 035).
 *
 * Pure decision logic — no Babylon import — so hysteresis, directional
 * look-ahead (horse-speed preload), budget enforcement, and failure/recovery
 * are deterministic and unit-tested. The proving-ground scene owns the *effect*
 * of each decision (building/disposing the per-chunk render, collision,
 * navigation, interaction, spawn, camera-volume, and audio layers); this module
 * only decides each chunk's **target state** and the load/unload diff.
 *
 * Separated concerns (§3.1 + the doc): the controller speaks in
 * persistence-id'd chunks and abstract `ChunkState`s. The eight layers are kept
 * conceptually distinct — the scene maps `active` → all layers on, `loaded`
 * (hysteresis band) → collision/navigation/persistence retained with throttled
 * simulation, `unloaded` → everything released. Nothing here references a render
 * mesh, so tide/season/weather/restoration content swaps never change a chunk's
 * identity.
 */

import {
  chunkChebyshev,
  chunkId,
  chunksInRadius,
  worldToChunk,
  type ChunkCoord,
  type Region,
  type Vec2,
} from './topology';

export type ChunkState = 'unloaded' | 'preloading' | 'loaded' | 'active' | 'failed';

/** Per-chunk cost the scene reports so the controller can enforce budgets. */
export interface ChunkCost {
  meshes: number;
  bodies: number;
}

const ZERO_COST: ChunkCost = { meshes: 0, bodies: 0 };

/** A tracked chunk + its streaming state. */
export interface ChunkRecord {
  id: string;
  regionId: string;
  coord: ChunkCoord;
  state: ChunkState;
  /** Chebyshev distance from the focus chunk at the last update. */
  ring: number;
  /** Cost reported by the scene once content is built (0 until loaded). */
  cost: ChunkCost;
  /** ms remaining before a failed chunk is retried. */
  retryMs: number;
}

export interface StreamingConfig {
  chunkSize: number;
  /** Chebyshev radius of fully-active chunks (render + sim + all layers). */
  activeRadius: number;
  /** Chebyshev radius kept loaded for hysteresis; unload only beyond this. */
  keepRadius: number;
  /** Seconds of travel projected ahead to size directional preload. */
  preloadSeconds: number;
  /** Hard cap on extra preload rings around the look-ahead point. */
  maxAheadRadius: number;
  /** Speed (m/s) above which directional look-ahead engages (walk → no extra). */
  lookAheadMinSpeed: number;
  /** Hard ceiling on simultaneously non-unloaded chunks (memory budget proxy). */
  maxLoadedChunks: number;
  /** Aggregate mesh budget across loaded chunks (advisory; surfaced in overlay). */
  maxMeshes: number;
  /** Aggregate physics-body budget across loaded chunks (advisory). */
  maxBodies: number;
  /** ms a failed chunk waits before the controller retries its load. */
  failureRetryMs: number;
}

/**
 * Default streaming budget. Chunk size 32 m is derived from the locked exterior
 * camera (follow 9.5 m, 31° downward, 47° FOV) against EXP2 fog at density
 * ~0.012–0.014, which leaves content readable to roughly 60 m before the fog
 * closes; `activeRadius` 2 (a 5×5 = 25-chunk window, ±80 m) therefore keeps
 * everything inside the fog horizon resident, and `keepRadius` 3 adds a
 * one-chunk hysteresis margin so seam crossings never thrash. See the doc.
 */
export const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
  chunkSize: 32,
  activeRadius: 2,
  keepRadius: 3,
  preloadSeconds: 1.5,
  maxAheadRadius: 2,
  lookAheadMinSpeed: 3.5,
  maxLoadedChunks: 64,
  maxMeshes: 1200,
  maxBodies: 400,
  failureRetryMs: 750,
};

/** The desired chunk sets for a focus + velocity, before budget/hysteresis. */
export interface DesiredSets {
  focus: ChunkCoord;
  /** Fully-active chunks (within activeRadius). */
  active: ChunkCoord[];
  /** Loaded-or-active chunks (the keep band ∪ directional look-ahead). */
  keep: ChunkCoord[];
}

/** Key a coord for set membership within one region. */
function key(c: ChunkCoord): string {
  return `${c.cx},${c.cz}`;
}

/**
 * Pure desired-state computation: which chunks should be active, and which
 * should be kept loaded (the hysteresis band plus directional look-ahead sized
 * by speed — a galloping horse projects the look-ahead point farther, pulling
 * an extra ring of chunks in the travel direction before the player arrives).
 */
export function desiredSets(
  region: Region,
  focus: Vec2,
  velocity: Vec2,
  config: StreamingConfig,
): DesiredSets {
  const focusCoord = worldToChunk(region, focus, config.chunkSize);
  const active = chunksInRadius(focusCoord, config.activeRadius);

  const keepMap = new Map<string, ChunkCoord>();
  for (const c of chunksInRadius(focusCoord, config.keepRadius)) keepMap.set(key(c), c);

  // Directional look-ahead (horse-speed preload): above walking pace, step the
  // focus chunk `lead` chunks along the dominant travel direction and add a
  // keep-radius forward field around that lead point. Because the field is
  // centred ahead of the focus, it extends the loaded region *past* the
  // symmetric keep band in the travel direction — so a galloping horse has the
  // chunks it is about to enter resident before it arrives, and a faster gallop
  // (larger `lead`) reaches farther. Walking adds nothing (the symmetric band is
  // already ample at foot pace).
  const speed = Math.hypot(velocity.x, velocity.z);
  if (speed >= config.lookAheadMinSpeed) {
    const lead = Math.min(config.maxAheadRadius, Math.ceil((speed * config.preloadSeconds) / config.chunkSize));
    const stepX = Math.round(velocity.x / speed);
    const stepZ = Math.round(velocity.z / speed);
    const aheadCoord: ChunkCoord = { cx: focusCoord.cx + stepX * lead, cz: focusCoord.cz + stepZ * lead };
    for (const c of chunksInRadius(aheadCoord, config.keepRadius)) keepMap.set(key(c), c);
  }

  return { focus: focusCoord, active, keep: [...keepMap.values()] };
}

/** The diff a single {@link StreamingController.update} produces. */
export interface StreamingDiff {
  toLoad: ChunkRecord[];
  toUnload: string[];
  toActivate: string[];
  toDeactivate: string[];
}

export interface BudgetUsage {
  loadedChunks: number;
  maxLoadedChunks: number;
  meshes: number;
  maxMeshes: number;
  bodies: number;
  maxBodies: number;
  /** True if any aggregate ceiling is currently exceeded. */
  over: boolean;
}

/**
 * Stateful streaming controller. Deterministic: given the same focus/velocity/dt
 * sequence and the same markLoaded/markFailed callbacks it produces the same
 * diffs. Holds one active region at a time; a cross-region transition swaps it.
 */
export class StreamingController {
  private readonly records = new Map<string, ChunkRecord>();
  private region: Region;
  private focusCoord: ChunkCoord = { cx: 0, cz: 0 };

  constructor(
    region: Region,
    private config: StreamingConfig = DEFAULT_STREAMING_CONFIG,
  ) {
    this.region = region;
  }

  /**
   * Swap the active region (cross-region transition). Records are per-region, so
   * the previous region's chunks are dropped wholesale — the next `update`
   * rebuilds the ring around the destination. This is what makes the community
   * transition a clean handoff rather than a coordinate-collision between two
   * regions that happen to share local chunk indices.
   */
  setRegion(region: Region): void {
    if (region.id === this.region.id) {
      this.region = region;
      return;
    }
    this.region = region;
    this.records.clear();
  }

  activeRegion(): Region {
    return this.region;
  }

  /**
   * Reconcile streaming state toward `focus`/`velocity`, advancing failure
   * retries by `dtMs`. Returns the load/unload/activate diff and mutates the
   * tracked records. The chunk under the focus is force-loaded and never
   * evicted, so the player always has valid ground beneath them.
   */
  update(focus: Vec2, velocity: Vec2, dtMs: number): StreamingDiff {
    const { focus: focusCoord, active, keep } = desiredSets(this.region, focus, velocity, this.config);
    this.focusCoord = focusCoord;

    const activeKeys = new Set(active.map(key));
    const keepKeys = new Map<string, ChunkCoord>();
    for (const c of keep) keepKeys.set(key(c), c);
    // The focus chunk is mandatory regardless of any budget pressure.
    keepKeys.set(key(focusCoord), focusCoord);

    const diff: StreamingDiff = { toLoad: [], toUnload: [], toActivate: [], toDeactivate: [] };

    // 1. Unload tracked chunks that fell outside the keep band (hysteresis: we
    //    only release beyond keepRadius, never merely beyond activeRadius).
    //    Re-rank every surviving record against the new focus.
    for (const [id, rec] of [...this.records]) {
      rec.ring = chunkChebyshev(rec.coord, focusCoord);
      if (!keepKeys.has(key(rec.coord))) {
        this.records.delete(id);
        diff.toUnload.push(id);
      }
    }

    // 2. Advance failure retries for the survivors; a chunk whose retry elapses
    //    re-enters preload and is re-emitted for the scene to rebuild (its
    //    content was never built, so the scene must construct it on retry).
    for (const rec of this.records.values()) {
      if (rec.state === 'failed') {
        rec.retryMs -= dtMs;
        if (rec.retryMs <= 0) {
          rec.state = 'preloading';
          diff.toLoad.push(rec);
        }
      }
    }

    // 3. Budget-aware load planning: rank desired-but-missing chunks by ring
    //    (nearest first) and only admit while under the chunk ceiling. The focus
    //    chunk and the active ring are always admitted.
    const desiredOrdered = [...keepKeys.values()].sort(
      (a, b) => chunkChebyshev(a, focusCoord) - chunkChebyshev(b, focusCoord),
    );
    for (const coord of desiredOrdered) {
      const id = chunkId(this.region.id, coord);
      const existing = this.records.get(id);
      const ring = chunkChebyshev(coord, focusCoord);
      const mandatory = ring === 0 || activeKeys.has(key(coord));
      if (!existing) {
        if (!mandatory && this.records.size >= this.config.maxLoadedChunks) continue; // budget gate
        const rec: ChunkRecord = {
          id,
          regionId: this.region.id,
          coord,
          state: 'preloading',
          ring,
          cost: { ...ZERO_COST },
          retryMs: 0,
        };
        this.records.set(id, rec);
        diff.toLoad.push(rec);
      } else {
        existing.ring = ring;
      }
    }

    // 4. Promote/demote between loaded and active based on the active ring.
    for (const rec of this.records.values()) {
      if (rec.state === 'loaded' && activeKeys.has(key(rec.coord))) {
        rec.state = 'active';
        diff.toActivate.push(rec.id);
      } else if (rec.state === 'active' && !activeKeys.has(key(rec.coord))) {
        rec.state = 'loaded';
        diff.toDeactivate.push(rec.id);
      }
    }

    return diff;
  }

  /** The scene calls this when a chunk's content finished building. */
  markLoaded(id: string, cost: ChunkCost = ZERO_COST): void {
    const rec = this.records.get(id);
    if (!rec || (rec.state !== 'preloading' && rec.state !== 'failed')) return;
    rec.cost = { ...cost };
    // Promote straight to active if it's within the active ring, else loaded.
    rec.state = chunkChebyshev(rec.coord, this.focusCoord) <= this.config.activeRadius ? 'active' : 'loaded';
  }

  /** The scene calls this when a chunk's content failed to build / load. */
  markFailed(id: string): void {
    const rec = this.records.get(id);
    if (!rec) return;
    rec.state = 'failed';
    rec.retryMs = this.config.failureRetryMs;
  }

  /** The persistence id of the chunk under the focus. */
  focusChunkId(): string {
    return chunkId(this.region.id, this.focusCoord);
  }

  /**
   * A chunk guaranteed to have valid ground for recovery: the focus chunk if it
   * is loaded/active, else the nearest loaded/active chunk (so a failed or
   * still-preloading focus chunk never strands the player). Null if nothing is
   * loaded yet.
   */
  safeChunkId(): string | null {
    const focusId = this.focusChunkId();
    const focusRec = this.records.get(focusId);
    if (focusRec && (focusRec.state === 'loaded' || focusRec.state === 'active')) return focusId;
    let best: ChunkRecord | null = null;
    for (const rec of this.records.values()) {
      if (rec.state !== 'loaded' && rec.state !== 'active') continue;
      if (!best || rec.ring < best.ring) best = rec;
    }
    return best ? best.id : null;
  }

  stateOf(id: string): ChunkState {
    return this.records.get(id)?.state ?? 'unloaded';
  }

  record(id: string): ChunkRecord | undefined {
    return this.records.get(id);
  }

  allRecords(): ChunkRecord[] {
    return [...this.records.values()];
  }

  budgetUsage(): BudgetUsage {
    let meshes = 0;
    let bodies = 0;
    for (const rec of this.records.values()) {
      meshes += rec.cost.meshes;
      bodies += rec.cost.bodies;
    }
    const loadedChunks = this.records.size;
    return {
      loadedChunks,
      maxLoadedChunks: this.config.maxLoadedChunks,
      meshes,
      maxMeshes: this.config.maxMeshes,
      bodies,
      maxBodies: this.config.maxBodies,
      over: loadedChunks > this.config.maxLoadedChunks || meshes > this.config.maxMeshes || bodies > this.config.maxBodies,
    };
  }
}
