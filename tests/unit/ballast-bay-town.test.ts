import { describe, it, expect } from 'vitest';
import { validateMapDocument } from '../../src/world/map-schema';
import { BALLAST_BAY_DISTRICT_BLOCKOUT } from '../../src/world/blockouts/ballast-bay-district';
import { BREAKPOINT_FARM_BLOCKOUT } from '../../src/world/blockouts/breakpoint-farm';

describe('Prompt 047 — Ballast Bay town district', () => {
  it('the town blockout the scene reads is a valid map document', () => {
    const res = validateMapDocument(BALLAST_BAY_DISTRICT_BLOCKOUT);
    expect(res.ok, res.issues.map((i) => i.message).join('; ')).toBe(true);
  });

  it('has the 5×4 chunk grid and the market/harbor/elevation anchors', () => {
    expect(BALLAST_BAY_DISTRICT_BLOCKOUT.chunks.length).toBe(20);
    const ids = BALLAST_BAY_DISTRICT_BLOCKOUT.anchors.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['harbor-dock', 'market-well', 'terrace-stair-base', 'terrace-stair-top']));
  });

  it('the Farm ↔ Town transition is reciprocal across both blockouts', () => {
    const townToFarm = BALLAST_BAY_DISTRICT_BLOCKOUT.transitions.find((t) => t.toRegion === 'breakpoint-farm');
    const farmToTown = BREAKPOINT_FARM_BLOCKOUT.transitions.find((t) => t.toRegion === 'ballast-bay-town');
    expect(townToFarm).toBeDefined();
    expect(farmToTown).toBeDefined();
    // Each region owns its outgoing edge.
    expect(townToFarm!.fromRegion).toBe('ballast-bay-town');
    expect(farmToTown!.fromRegion).toBe('breakpoint-farm');
  });
});
