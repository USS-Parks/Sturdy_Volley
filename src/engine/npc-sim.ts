/**
 * NPC simulation tiers, schedule authority, and recovery (WEF-07b, master
 * Prompt 041).
 *
 * Pure, deterministic. Decides which NPCs run the full active simulation
 * (motor + avoidance + animation) vs. cheap **abstract** offscreen advance
 * (snap to the scheduled anchor, no physics body), enforces a mobile active-agent
 * ceiling (throttle), and defines the explicit recovery policies for the failure
 * modes the §07b acceptance names: navmesh loss / off-mesh, stuck, and missed
 * schedule time.
 */
import { patchAt, clampToPatch, type NavMesh, type NavPoint } from './navigation';

export type SimTier = 'active' | 'abstract';

export interface SimConfig {
  /** Distance (m) from the player within which an NPC simulates actively. */
  activationRadius: number;
  /** Hard ceiling on simultaneously active NPCs (mobile throttle). */
  activeCap: number;
}

export const DEFAULT_SIM_CONFIG: SimConfig = { activationRadius: 28, activeCap: 12 };

/** Tier for a single NPC by distance alone (before the active-cap throttle). */
export function tierFor(distanceToPlayer: number, cfg: SimConfig = DEFAULT_SIM_CONFIG): SimTier {
  return distanceToPlayer <= cfg.activationRadius ? 'active' : 'abstract';
}

/**
 * Assign tiers across the whole population: nearest-first, an NPC is `active`
 * only if it is within the activation radius **and** under the active cap; every
 * other NPC is `abstract`. Deterministic (ties broken by id) so the same frame
 * always yields the same assignment.
 */
export function assignTiers(
  agents: ReadonlyArray<{ id: string; distance: number }>,
  cfg: SimConfig = DEFAULT_SIM_CONFIG,
): Map<string, SimTier> {
  const sorted = [...agents].sort((a, b) => a.distance - b.distance || (a.id < b.id ? -1 : 1));
  const out = new Map<string, SimTier>();
  let active = 0;
  for (const a of sorted) {
    if (a.distance <= cfg.activationRadius && active < cfg.activeCap) {
      out.set(a.id, 'active');
      active++;
    } else {
      out.set(a.id, 'abstract');
    }
  }
  return out;
}

/** Count of active assignments (for perf assertions). */
export function activeCount(tiers: Map<string, SimTier>): number {
  let n = 0;
  for (const t of tiers.values()) if (t === 'active') n++;
  return n;
}

// --- Stuck detection --------------------------------------------------------

export interface StuckTracker {
  /** Distance accumulated over the current window. */
  accumDist: number;
  /** Time accumulated over the current window (s). */
  accumTime: number;
  lastPos: NavPoint;
}

export function createStuckTracker(pos: NavPoint): StuckTracker {
  return { accumDist: 0, accumTime: 0, lastPos: { ...pos } };
}

export interface StuckConfig {
  /** Window length (s) over which progress is measured. */
  window: number;
  /** Minimum distance (m) expected within the window while intending to move. */
  minProgress: number;
}

export const DEFAULT_STUCK_CONFIG: StuckConfig = { window: 1.5, minProgress: 0.3 };

/**
 * Track movement progress. While the NPC *intends* to move (`movingIntent`), if
 * it covers less than `minProgress` over a `window`, it is flagged `stuck` and
 * the tracker resets. Idle NPCs (no intent) never flag.
 */
export function trackProgress(
  tracker: StuckTracker,
  pos: NavPoint,
  dt: number,
  movingIntent: boolean,
  cfg: StuckConfig = DEFAULT_STUCK_CONFIG,
): { tracker: StuckTracker; stuck: boolean } {
  const moved = Math.hypot(pos.x - tracker.lastPos.x, pos.z - tracker.lastPos.z);
  const next: StuckTracker = {
    accumDist: tracker.accumDist + moved,
    accumTime: tracker.accumTime + dt,
    lastPos: { ...pos },
  };
  if (!movingIntent) {
    // Reset the window while idle so a parked NPC is never "stuck".
    return { tracker: { accumDist: 0, accumTime: 0, lastPos: { ...pos } }, stuck: false };
  }
  if (next.accumTime >= cfg.window) {
    const stuck = next.accumDist < cfg.minProgress;
    return { tracker: { accumDist: 0, accumTime: 0, lastPos: { ...pos } }, stuck };
  }
  return { tracker: next, stuck: false };
}

// --- Recovery ---------------------------------------------------------------

export type RecoveryReason = 'none' | 'off-mesh' | 'navmesh-loss' | 'stuck';

export interface RecoveryResult {
  point: NavPoint;
  reason: RecoveryReason;
  recovered: boolean;
}

/**
 * Recover an NPC to valid ground. If the position is off-mesh, snap to the
 * nearest patch point (off-mesh / navmesh-loss). If `stuck`, return the nearest
 * patch point with the `stuck` reason so the caller re-paths. Otherwise no-op.
 */
export function recoverToMesh(mesh: NavMesh, pos: NavPoint, stuck = false): RecoveryResult {
  const patch = patchAt(mesh, pos);
  if (!patch) {
    // Off the navmesh entirely: snap to the nearest patch's clamped point.
    let best: NavPoint = pos;
    let bestD = Infinity;
    for (const p of mesh.patches) {
      const c = clampToPatch(p, pos);
      const d = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return { point: best, reason: mesh.patches.length === 0 ? 'navmesh-loss' : 'off-mesh', recovered: true };
  }
  if (stuck) {
    return { point: clampToPatch(patch, pos), reason: 'stuck', recovered: true };
  }
  return { point: pos, reason: 'none', recovered: false };
}

// --- Schedule authority -----------------------------------------------------

/**
 * The semantic anchor an abstract NPC is "at" given its goal cycle + index.
 * Offscreen NPCs hold their scheduled anchor (no motor); when they re-activate
 * they rejoin here — a valid semantic anchor, never a stale interpolated pose.
 */
export function abstractAnchor(goalCycle: readonly NavPoint[], index: number): NavPoint | null {
  if (goalCycle.length === 0) return null;
  return goalCycle[index % goalCycle.length];
}

/**
 * Catch a schedule up after missed time: returns the goal index whose slot the
 * absolute minute falls into, so a long offscreen stretch resumes at the right
 * scheduled goal rather than replaying every missed one.
 */
export function catchUpIndex(slotMinutes: readonly number[], minute: number): number {
  let idx = 0;
  for (let i = 0; i < slotMinutes.length; i++) {
    if (slotMinutes[i] <= minute) idx = i;
  }
  return idx;
}
