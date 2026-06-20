import { describe, it, expect } from 'vitest';
import {
  currentKind,
  findPath,
  navAdvance,
  navDesiredDir,
  patchAt,
  setNavGoal,
  type NavMesh,
} from '../../src/engine/navigation';

/** A yard (exterior) → house (interior) → upper floor, joined by a door + stair. */
const MESH: NavMesh = {
  patches: [
    { id: 'yard', minX: -10, maxX: 10, minZ: -10, maxZ: 0, area: 'exterior' },
    { id: 'house', minX: -5, maxX: 5, minZ: 0, maxZ: 8, area: 'interior' },
    { id: 'upper', minX: -5, maxX: 5, minZ: 8, maxZ: 14, area: 'interior' },
    { id: 'island', minX: 40, maxX: 50, minZ: 40, maxZ: 50, area: 'exterior' }, // disconnected
  ],
  links: [
    { id: 'door1', from: 'yard', to: 'house', kind: 'door', at: { x: 0, z: 0 }, toAt: { x: 0, z: 0.5 } },
    { id: 'stair1', from: 'house', to: 'upper', kind: 'stair', at: { x: 0, z: 8 }, toAt: { x: 0, z: 8.5 } },
  ],
};

describe('navmesh — patch lookup', () => {
  it('finds the patch containing a point', () => {
    expect(patchAt(MESH, { x: 0, z: -5 })?.id).toBe('yard');
    expect(patchAt(MESH, { x: 0, z: 4 })?.id).toBe('house');
    expect(patchAt(MESH, { x: 100, z: 100 })).toBeNull();
  });
});

describe('findPath — patches, portals, off-mesh links', () => {
  it('returns a single walk waypoint within one patch', () => {
    const path = findPath(MESH, { x: -3, z: -5 }, { x: 3, z: -2 });
    expect(path).not.toBeNull();
    expect(path!.waypoints).toEqual([{ point: { x: 3, z: -2 }, kind: 'walk' }]);
  });

  it('crosses a door from exterior to interior', () => {
    const path = findPath(MESH, { x: 0, z: -5 }, { x: 2, z: 4 });
    expect(path).not.toBeNull();
    const kinds = path!.waypoints.map((w) => w.kind);
    expect(kinds).toEqual(['walk', 'door', 'walk']);
    // The door entry then exit points are emitted.
    expect(path!.waypoints[0].point).toEqual({ x: 0, z: 0 });
    expect(path!.waypoints[1].point).toEqual({ x: 0, z: 0.5 });
  });

  it('chains a door + a stair across three patches', () => {
    const path = findPath(MESH, { x: 0, z: -5 }, { x: 0, z: 12 });
    expect(path).not.toBeNull();
    expect(path!.waypoints.map((w) => w.kind)).toEqual(['walk', 'door', 'walk', 'stair', 'walk']);
    expect(path!.cost).toBeGreaterThan(15);
  });

  it('returns null for an off-mesh endpoint', () => {
    expect(findPath(MESH, { x: 100, z: 100 }, { x: 0, z: 4 })).toBeNull();
    expect(findPath(MESH, { x: 0, z: -5 }, { x: 100, z: 100 })).toBeNull();
  });

  it('returns null for an unreachable (disconnected) patch', () => {
    expect(findPath(MESH, { x: 0, z: -5 }, { x: 45, z: 45 })).toBeNull();
  });
});

describe('nav agent — path following for the motor', () => {
  it('heads toward the first waypoint, advances on arrival, finishes at the goal', () => {
    let agent = setNavGoal(MESH, { x: 0, z: -5 }, { x: 0, z: 12 });
    expect(agent.path).not.toBeNull();
    expect(currentKind(agent)).toBe('walk'); // walking to the door entry first

    // Desired direction points +Z toward the door at (0,0).
    const dir = navDesiredDir(agent, { x: 0, z: -5 });
    expect(dir.z).toBeGreaterThan(0.9);
    expect(Math.abs(dir.x)).toBeLessThan(0.1);

    // Snap to the door entry → advance to the door-cross waypoint.
    let r = navAdvance(agent, { x: 0, z: 0 });
    agent = r.agent;
    expect(r.arrived).toBe(false);
    expect(currentKind(agent)).toBe('door');

    // Walk through every remaining waypoint to the goal.
    const remaining = agent.path!.waypoints.slice(agent.index);
    for (const wp of remaining) {
      r = navAdvance(agent, wp.point);
      agent = r.agent;
    }
    expect(r.arrived).toBe(true);
    expect(navDesiredDir(agent, { x: 0, z: 12 })).toEqual({ x: 0, z: 0 });
  });

  it('produces no path (null) for an unreachable goal but does not throw', () => {
    const agent = setNavGoal(MESH, { x: 0, z: -5 }, { x: 45, z: 45 });
    expect(agent.path).toBeNull();
    expect(navDesiredDir(agent, { x: 0, z: -5 })).toEqual({ x: 0, z: 0 });
    expect(navAdvance(agent, { x: 0, z: -5 }).arrived).toBe(true);
  });
});
