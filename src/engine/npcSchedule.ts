import type { Season } from '../data/schemas';

/**
 * NPC schedule + abstract pathing (Prompt 011). Pure, deterministic. Every NPC
 * has a layered schedule: a default daily plan, then per-season, per-weather,
 * per-festival, and per-relationship overlays. The engine resolves the layer
 * stack into a flat list of {minutes, sceneKey, point} waypoints; renderers
 * read the active waypoint for each tick. Offscreen NPCs advance via the
 * abstract resolver — no navmesh cost.
 */
export interface Waypoint {
  sceneKey: string;
  /** World-space position (XZ) when sceneKey matches the active scene. */
  x: number;
  z: number;
  /** Posture for personality + idle behavior. */
  posture?: 'idle' | 'work' | 'lean' | 'sit' | 'walk';
  /** Optional facing in radians. */
  facing?: number;
}

export interface ScheduleSegment {
  startMinutes: number; // minutes from midnight
  waypoint: Waypoint;
}

export interface NpcSchedule {
  /** Default Mon–Sun layer when nothing else applies. */
  default: ScheduleSegment[];
  bySeason?: Partial<Record<Season, ScheduleSegment[]>>;
  byWeather?: Record<string, ScheduleSegment[]>;
  byFestival?: Record<string, ScheduleSegment[]>;
  /** Schedule that kicks in once the player's relationship ≥ key (e.g. "6"). */
  byRelationship?: Record<string, ScheduleSegment[]>;
  /** One-off event schedules keyed by flag id. */
  byEvent?: Record<string, ScheduleSegment[]>;
}

export interface ResolveContext {
  minutes: number; // 6:00 AM = 360 .. 2:00 AM next day = 1560
  season: Season;
  weatherId: string | null;
  festivalId: string | null;
  relationshipLevel: number;
  activeEventFlags: readonly string[];
}

/**
 * Pick the layer that applies right now. Precedence (highest first):
 * event flag → festival → weather → relationship-tier → season → default.
 */
export function pickLayer(schedule: NpcSchedule, ctx: ResolveContext): ScheduleSegment[] {
  for (const flag of ctx.activeEventFlags) {
    if (schedule.byEvent?.[flag]?.length) return schedule.byEvent[flag];
  }
  if (ctx.festivalId && schedule.byFestival?.[ctx.festivalId]?.length) {
    return schedule.byFestival[ctx.festivalId];
  }
  if (ctx.weatherId && schedule.byWeather?.[ctx.weatherId]?.length) {
    return schedule.byWeather[ctx.weatherId];
  }
  if (schedule.byRelationship) {
    // Find the highest threshold ≤ relationshipLevel.
    let best: ScheduleSegment[] | null = null;
    let bestKey = -1;
    for (const [key, seg] of Object.entries(schedule.byRelationship)) {
      const k = Number(key);
      if (Number.isFinite(k) && k <= ctx.relationshipLevel && k > bestKey) {
        bestKey = k;
        best = seg;
      }
    }
    if (best) return best;
  }
  if (schedule.bySeason?.[ctx.season]?.length) {
    return schedule.bySeason[ctx.season]!;
  }
  return schedule.default;
}

/** Active waypoint at `ctx.minutes` (last segment whose startMinutes ≤ minutes). */
export function activeWaypoint(schedule: NpcSchedule, ctx: ResolveContext): Waypoint | null {
  const layer = pickLayer(schedule, ctx);
  if (layer.length === 0) return null;
  let active = layer[0]!;
  for (const seg of layer) {
    if (seg.startMinutes <= ctx.minutes) active = seg;
    else break;
  }
  return active.waypoint;
}

/**
 * Abstract advance — for offscreen NPCs we don't pay for path-finding or
 * animation. Snap the NPC straight to the next waypoint's anchor position so
 * the world stays consistent when the player walks back into the scene.
 */
export function abstractStep(schedule: NpcSchedule, ctx: ResolveContext): Waypoint | null {
  return activeWaypoint(schedule, ctx);
}

export interface LiveStepInput {
  position: { x: number; z: number };
  target: Waypoint;
  /** World units per second. */
  speed: number;
  dt: number;
}

/** Linear walk toward the target waypoint at `speed` u/s, with arrival snap. */
export function liveStep(input: LiveStepInput): { x: number; z: number; arrived: boolean } {
  const dx = input.target.x - input.position.x;
  const dz = input.target.z - input.position.z;
  const dist = Math.hypot(dx, dz);
  const step = input.speed * input.dt;
  if (dist <= step) return { x: input.target.x, z: input.target.z, arrived: true };
  return {
    x: input.position.x + (dx / dist) * step,
    z: input.position.z + (dz / dist) * step,
    arrived: false,
  };
}

/** Whether the NPC is reachable for conversation (not mid-cutscene, in-scene). */
export function isConversationAvailable(
  schedule: NpcSchedule,
  ctx: ResolveContext,
  activeSceneKey: string,
): boolean {
  const wp = activeWaypoint(schedule, ctx);
  if (!wp) return false;
  return wp.sceneKey === activeSceneKey && wp.posture !== 'sit'; // very simple heuristic
}
