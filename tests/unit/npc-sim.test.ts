import { describe, it, expect } from 'vitest';
import {
  abstractAnchor,
  activeCount,
  assignTiers,
  catchUpIndex,
  createStuckTracker,
  recoverToMesh,
  tierFor,
  trackProgress,
  DEFAULT_SIM_CONFIG,
} from '../../src/engine/npc-sim';
import type { NavMesh } from '../../src/engine/navigation';

const MESH: NavMesh = {
  patches: [
    { id: 'yard', minX: -10, maxX: 10, minZ: -10, maxZ: 10, area: 'exterior' },
    { id: 'house', minX: -5, maxX: 5, minZ: 10, maxZ: 20, area: 'interior' },
  ],
  links: [{ id: 'door', from: 'yard', to: 'house', kind: 'door', at: { x: 0, z: 10 }, toAt: { x: 0, z: 11 } }],
};

describe('sim tiers + throttle', () => {
  it('tierFor splits on the activation radius', () => {
    expect(tierFor(10)).toBe('active');
    expect(tierFor(DEFAULT_SIM_CONFIG.activationRadius + 1)).toBe('abstract');
  });

  it('assignTiers caps active agents at the throttle and abstracts the farthest', () => {
    const agents = Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, distance: i })); // all within radius
    const tiers = assignTiers(agents, { activationRadius: 28, activeCap: 12 });
    expect(activeCount(tiers)).toBe(12);
    // The 12 nearest are active; the rest abstract.
    expect(tiers.get('n0')).toBe('active');
    expect(tiers.get('n11')).toBe('active');
    expect(tiers.get('n12')).toBe('abstract');
  });

  it('abstracts agents outside the radius regardless of the cap', () => {
    const agents = [
      { id: 'near', distance: 5 },
      { id: 'far', distance: 100 },
    ];
    const tiers = assignTiers(agents);
    expect(tiers.get('near')).toBe('active');
    expect(tiers.get('far')).toBe('abstract');
  });
});

describe('stuck detection', () => {
  it('flags stuck when intending to move but not progressing', () => {
    let t = createStuckTracker({ x: 0, z: 0 });
    let stuck = false;
    // 2 s of "trying to move" while stationary → stuck once the window elapses.
    for (let i = 0; i < 5; i++) {
      const r = trackProgress(t, { x: 0, z: 0 }, 0.4, true);
      t = r.tracker;
      stuck = stuck || r.stuck;
    }
    expect(stuck).toBe(true);
  });

  it('never flags an idle (no-intent) NPC', () => {
    let t = createStuckTracker({ x: 0, z: 0 });
    for (let i = 0; i < 10; i++) {
      const r = trackProgress(t, { x: 0, z: 0 }, 0.4, false);
      t = r.tracker;
      expect(r.stuck).toBe(false);
    }
  });

  it('does not flag a moving NPC', () => {
    let t = createStuckTracker({ x: 0, z: 0 });
    let x = 0;
    let stuck = false;
    for (let i = 0; i < 6; i++) {
      x += 1; // 1 m per 0.4 s step → well above minProgress
      const r = trackProgress(t, { x, z: 0 }, 0.4, true);
      t = r.tracker;
      stuck = stuck || r.stuck;
    }
    expect(stuck).toBe(false);
  });
});

describe('recovery policies', () => {
  it('snaps an off-mesh position back to the nearest patch', () => {
    const r = recoverToMesh(MESH, { x: 25, z: 0 });
    expect(r.recovered).toBe(true);
    expect(r.reason).toBe('off-mesh');
    expect(r.point.x).toBeLessThanOrEqual(10);
  });

  it('reports navmesh-loss when there are no patches', () => {
    const r = recoverToMesh({ patches: [], links: [] }, { x: 0, z: 0 });
    expect(r.reason).toBe('navmesh-loss');
  });

  it('returns a stuck recovery point inside the current patch', () => {
    const r = recoverToMesh(MESH, { x: 1, z: 1 }, true);
    expect(r.reason).toBe('stuck');
    expect(r.recovered).toBe(true);
  });

  it('no-ops when on-mesh and not stuck', () => {
    const r = recoverToMesh(MESH, { x: 1, z: 1 });
    expect(r.reason).toBe('none');
    expect(r.recovered).toBe(false);
  });
});

describe('schedule authority', () => {
  it('abstractAnchor returns the scheduled anchor for the cycle index', () => {
    const cycle = [{ x: 0, z: 0 }, { x: 5, z: 5 }];
    expect(abstractAnchor(cycle, 1)).toEqual({ x: 5, z: 5 });
    expect(abstractAnchor(cycle, 3)).toEqual({ x: 5, z: 5 }); // wraps
    expect(abstractAnchor([], 0)).toBeNull();
  });

  it('catchUpIndex resumes at the right slot after missed time', () => {
    const slots = [360, 600, 900, 1200];
    expect(catchUpIndex(slots, 360)).toBe(0);
    expect(catchUpIndex(slots, 700)).toBe(1);
    expect(catchUpIndex(slots, 1300)).toBe(3);
  });
});
