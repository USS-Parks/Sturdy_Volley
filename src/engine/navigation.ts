/**
 * NPC navigation service core (WEF-07a, master Prompt 040).
 *
 * Pure, deterministic — no Babylon. Replaces the straight-line
 * `npcSchedule.liveStep` interpolation with a real navigation service: a
 * navmesh of convex walkable patches joined by portals and authored **off-mesh
 * links** (doors, stairs, slopes), A* pathfinding across them, and a per-agent
 * path follower that emits a desired move direction for the **shared motor**
 * (`engine/motor.stepMotor`) to consume. Locomotion stays the motor's job;
 * navigation only decides *where* to step and *what kind* of link is being
 * crossed (so the renderer can play a door/stair traversal).
 *
 * The schedule layer (`npcSchedule`) still decides each NPC's *goal*; this
 * service decides *how they get there*.
 */

export interface NavPoint {
  x: number;
  z: number;
}

/** A convex (axis-aligned rectangular) walkable area. */
export interface NavPatch {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Scene/area tag (exterior, interior, …) — used for debug + conversation. */
  area?: string;
}

export type NavLinkKind = 'portal' | 'door' | 'stair' | 'slope';

/**
 * A connection between two patches. `at` is the entry point on the `from` side;
 * `toAt` is the exit on the `to` side (defaults to `at` for a shared-edge
 * portal). Links are traversable both ways.
 */
export interface NavLink {
  id: string;
  from: string;
  to: string;
  kind: NavLinkKind;
  at: NavPoint;
  toAt?: NavPoint;
}

export interface NavMesh {
  patches: NavPatch[];
  links: NavLink[];
}

/** One step of a resolved path: a point to walk to + how it is reached. */
export interface NavWaypoint {
  point: NavPoint;
  /** 'walk' for ordinary movement inside a patch; otherwise the link kind. */
  kind: 'walk' | NavLinkKind;
}

export interface NavPath {
  waypoints: NavWaypoint[];
  /** Total path cost (metres). */
  cost: number;
}

export interface NavAgentState {
  path: NavPath | null;
  /** Index of the waypoint the agent is currently walking toward. */
  index: number;
  goal: NavPoint | null;
}

const dist = (a: NavPoint, b: NavPoint): number => Math.hypot(a.x - b.x, a.z - b.z);

export function containsPoint(p: NavPatch, pt: NavPoint): boolean {
  return pt.x >= p.minX && pt.x <= p.maxX && pt.z >= p.minZ && pt.z <= p.maxZ;
}

/** The patch containing a point (first match), or null. */
export function patchAt(mesh: NavMesh, pt: NavPoint): NavPatch | null {
  return mesh.patches.find((p) => containsPoint(p, pt)) ?? null;
}

/** Clamp a point into a patch's bounds (nearest interior point). */
export function clampToPatch(p: NavPatch, pt: NavPoint): NavPoint {
  return {
    x: Math.max(p.minX, Math.min(p.maxX, pt.x)),
    z: Math.max(p.minZ, Math.min(p.maxZ, pt.z)),
  };
}

/** Directional adjacency: for each patch id, the links leaving it (both ways). */
interface DirLink {
  to: string;
  /** Point on this patch where the link is entered. */
  at: NavPoint;
  /** Point on the destination patch where the link exits. */
  exit: NavPoint;
  kind: NavLinkKind;
}

function adjacency(mesh: NavMesh): Map<string, DirLink[]> {
  const adj = new Map<string, DirLink[]>();
  const push = (id: string, link: DirLink): void => {
    const list = adj.get(id) ?? [];
    list.push(link);
    adj.set(id, list);
  };
  for (const l of mesh.links) {
    const toAt = l.toAt ?? l.at;
    push(l.from, { to: l.to, at: l.at, exit: toAt, kind: l.kind });
    push(l.to, { to: l.from, at: toAt, exit: l.at, kind: l.kind });
  }
  return adj;
}

/**
 * A* over patches from `start` to `goal`. Returns the patch-id sequence, or null
 * when unreachable.
 */
function patchPath(mesh: NavMesh, startId: string, goalId: string, adj: Map<string, DirLink[]>): string[] | null {
  if (startId === goalId) return [startId];
  const open = new Set<string>([startId]);
  const cameFrom = new Map<string, string>();
  const g = new Map<string, number>([[startId, 0]]);
  const centerOf = (id: string): NavPoint => {
    const p = mesh.patches.find((q) => q.id === id)!;
    return { x: (p.minX + p.maxX) / 2, z: (p.minZ + p.maxZ) / 2 };
  };
  const goalCenter = centerOf(goalId);
  const f = new Map<string, number>([[startId, dist(centerOf(startId), goalCenter)]]);

  while (open.size) {
    // Lowest-f open node.
    let cur = '';
    let best = Infinity;
    for (const id of open) {
      const fv = f.get(id) ?? Infinity;
      if (fv < best) {
        best = fv;
        cur = id;
      }
    }
    if (cur === goalId) {
      const path = [cur];
      while (cameFrom.has(cur)) {
        cur = cameFrom.get(cur) as string;
        path.unshift(cur);
      }
      return path;
    }
    open.delete(cur);
    for (const link of adj.get(cur) ?? []) {
      const tentative = (g.get(cur) ?? Infinity) + dist(link.at, link.exit) + 0.001;
      if (tentative < (g.get(link.to) ?? Infinity)) {
        cameFrom.set(link.to, cur);
        g.set(link.to, tentative);
        f.set(link.to, tentative + dist(centerOf(link.to), goalCenter));
        open.add(link.to);
      }
    }
  }
  return null;
}

/**
 * Find a path from `start` to `goal` across the navmesh. Emits walk waypoints
 * inside patches and link-kind waypoints when crossing doors/stairs/slopes.
 * Returns null when either endpoint is off-mesh or the goal is unreachable.
 */
export function findPath(mesh: NavMesh, start: NavPoint, goal: NavPoint): NavPath | null {
  const startPatch = patchAt(mesh, start);
  const goalPatch = patchAt(mesh, goal);
  if (!startPatch || !goalPatch) return null;

  const adj = adjacency(mesh);
  const patches = patchPath(mesh, startPatch.id, goalPatch.id, adj);
  if (!patches) return null;

  const waypoints: NavWaypoint[] = [];
  let cost = 0;
  let cursor: NavPoint = start;

  for (let i = 0; i < patches.length - 1; i++) {
    // Find the link this service uses to move from patches[i] → patches[i+1]
    // (cheapest entry from the current cursor).
    const candidates = (adj.get(patches[i]) ?? []).filter((l) => l.to === patches[i + 1]);
    if (candidates.length === 0) return null;
    let link = candidates[0];
    let bestC = dist(cursor, link.at);
    for (const c of candidates) {
      const d = dist(cursor, c.at);
      if (d < bestC) {
        bestC = d;
        link = c;
      }
    }
    // Walk to the link entry, then cross with the link's kind.
    waypoints.push({ point: link.at, kind: 'walk' });
    waypoints.push({ point: link.exit, kind: link.kind });
    cost += dist(cursor, link.at) + dist(link.at, link.exit);
    cursor = link.exit;
  }
  // Final walk to the goal inside the goal patch.
  waypoints.push({ point: goal, kind: 'walk' });
  cost += dist(cursor, goal);

  return { waypoints, cost };
}

export function createNavAgent(): NavAgentState {
  return { path: null, index: 0, goal: null };
}

/** Build an agent state for a new goal: the path is computed from `pos`. */
export function setNavGoal(mesh: NavMesh, pos: NavPoint, goal: NavPoint): NavAgentState {
  const path = findPath(mesh, pos, goal);
  return { path, index: 0, goal };
}

/** Whether the agent has a path and has not consumed all its waypoints. */
export function navActive(agent: NavAgentState): boolean {
  return agent.path !== null && agent.index < agent.path.waypoints.length;
}

/** The waypoint the agent is currently heading to, or null when finished. */
export function currentWaypoint(agent: NavAgentState): NavWaypoint | null {
  if (!agent.path || agent.index >= agent.path.waypoints.length) return null;
  return agent.path.waypoints[agent.index];
}

/** The link kind currently being traversed (or 'walk'/null). */
export function currentKind(agent: NavAgentState): NavWaypoint['kind'] | null {
  return currentWaypoint(agent)?.kind ?? null;
}

/**
 * Unit move direction from `pos` toward the current waypoint, or `{x:0,z:0}`
 * when the path is finished or the agent is already on the waypoint.
 */
export function navDesiredDir(agent: NavAgentState, pos: NavPoint): NavPoint {
  const wp = currentWaypoint(agent);
  if (!wp) return { x: 0, z: 0 };
  const dx = wp.point.x - pos.x;
  const dz = wp.point.z - pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return { x: 0, z: 0 };
  return { x: dx / d, z: dz / d };
}

/**
 * Advance the agent's waypoint cursor once `pos` reaches the current waypoint
 * (within `arrivalRadius`). Returns the (possibly advanced) agent state + an
 * `arrived` flag set when the *final* waypoint is reached.
 */
export function navAdvance(agent: NavAgentState, pos: NavPoint, arrivalRadius = 0.35): { agent: NavAgentState; arrived: boolean } {
  const wp = currentWaypoint(agent);
  if (!wp) return { agent, arrived: true };
  if (dist(pos, wp.point) <= arrivalRadius) {
    const index = agent.index + 1;
    const arrived = !agent.path || index >= agent.path.waypoints.length;
    return { agent: { ...agent, index }, arrived };
  }
  return { agent, arrived: false };
}
