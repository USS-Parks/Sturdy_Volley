import { describe, it, expect } from 'vitest';
import { validateRoomSpec } from '../../src/world/interior-kit';
import { validateMapDocument } from '../../src/world/map-schema';
import { BREAKPOINT_FARM_BLOCKOUT } from '../../src/world/blockouts/breakpoint-farm';
import { FARMHOUSE_SPEC } from '../../src/scenes/FarmhouseInteriorScene';
import {
  preservedIntact,
  DEFAULT_CLOCK_MINUTES,
  NPC_STATE_TOKEN,
  type RegionTransitionData,
} from '../../src/world/region-transition';

describe('Prompt 046 — Breakpoint Farm + Farmhouse', () => {
  it('the farmhouse room spec is conformant to the interior kit', () => {
    expect(validateRoomSpec(FARMHOUSE_SPEC)).toEqual([]);
  });

  it('the farmhouse door transitions back to the farm farmhouse-door anchor', () => {
    const door = FARMHOUSE_SPEC.doorways.find((d) => d.id === 'farmhouse-door');
    expect(door?.toAnchorId).toBe('farm-farmhouse-door');
  });

  it('the farm blockout the scene reads is a valid map document with the door anchor', () => {
    const res = validateMapDocument(BREAKPOINT_FARM_BLOCKOUT);
    expect(res.ok, res.issues.map((i) => i.message).join('; ')).toBe(true);
    expect(BREAKPOINT_FARM_BLOCKOUT.anchors.map((a) => a.id)).toContain('farmhouse-door');
    // The farm → farmhouse-interior transition exists for the handoff.
    expect(BREAKPOINT_FARM_BLOCKOUT.transitions.some((t) => t.toRegion === 'farmhouse-interior')).toBe(true);
  });

  it('preservedIntact gates a transition that carries the clock + NPC token unchanged', () => {
    const data: RegionTransitionData = {
      toAnchor: { x: 0, z: 1.5 },
      facing: 0,
      cameraContext: 'smallInterior',
      clockMinutes: DEFAULT_CLOCK_MINUTES,
      npcToken: NPC_STATE_TOKEN,
    };
    expect(preservedIntact(data, DEFAULT_CLOCK_MINUTES, NPC_STATE_TOKEN)).toBe(true);
    expect(preservedIntact(data, DEFAULT_CLOCK_MINUTES + 1, NPC_STATE_TOKEN)).toBe(false);
    expect(preservedIntact(data, DEFAULT_CLOCK_MINUTES, 'other')).toBe(false);
  });
});
