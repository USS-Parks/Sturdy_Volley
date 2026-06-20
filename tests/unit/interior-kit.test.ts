import { describe, it, expect } from 'vitest';
import {
  INTERIOR_METRICS,
  isRoomConformant,
  validateRoomSpec,
  wallLength,
  wallSpans,
  type RoomSpec,
} from '../../src/world/interior-kit';

const smallRoom: RoomSpec = {
  id: 'small',
  width: 5,
  depth: 4,
  doorways: [{ id: 'd', side: 'south', offset: 0 }],
  windows: [{ id: 'w', side: 'north', offset: 0 }],
};

describe('interior metric kit — scale conformance', () => {
  it('matches the docs/SCALE_AND_PERFORMANCE conventions', () => {
    expect(INTERIOR_METRICS.wallHeight).toBeGreaterThanOrEqual(3.0);
    expect(INTERIOR_METRICS.wallHeight).toBeLessThanOrEqual(4.0);
    expect(INTERIOR_METRICS.doorway.width).toBeGreaterThanOrEqual(1.0);
    expect(INTERIOR_METRICS.doorway.height).toBeGreaterThanOrEqual(1.8);
    // Stair rise stays within the motor's step offset territory.
    expect(INTERIOR_METRICS.stair.rise).toBeLessThanOrEqual(0.2);
    expect(INTERIOR_METRICS.navCorridorWidth).toBeGreaterThan(0.8); // > capsule diameter
  });
});

describe('validateRoomSpec', () => {
  it('passes a conformant room', () => {
    expect(validateRoomSpec(smallRoom)).toEqual([]);
    expect(isRoomConformant(smallRoom)).toBe(true);
  });

  it('flags a too-low ceiling', () => {
    const issues = validateRoomSpec({ ...smallRoom, height: 1.5 });
    expect(issues.some((i) => i.code === 'ceiling-height')).toBe(true);
  });

  it('flags a narrow doorway below nav width', () => {
    const issues = validateRoomSpec({ ...smallRoom, doorways: [{ id: 'd', side: 'south', offset: 0, width: 0.9 }] });
    expect(issues.some((i) => i.code === 'doorway-clearance')).toBe(true);
  });

  it('flags a doorway that overflows its wall', () => {
    // South wall length = width 5, half 2.5; offset 2.4 + half-width 0.6 = 3.0 > 2.5.
    const issues = validateRoomSpec({ ...smallRoom, doorways: [{ id: 'd', side: 'south', offset: 2.4 }] });
    expect(issues.some((i) => i.code === 'doorway-side-overflow')).toBe(true);
  });

  it('flags furniture that blocks the navigable gap', () => {
    const issues = validateRoomSpec({
      ...smallRoom,
      features: [{ id: 'blob', kind: 'furniture', at: { x: 0, z: 0 }, size: { w: 4.6, d: 3.6 } }],
    });
    expect(issues.some((i) => i.code === 'feature-clearance')).toBe(true);
  });
});

describe('wallSpans / wallLength', () => {
  it('reports the correct wall length per side', () => {
    expect(wallLength(smallRoom, 'north')).toBe(5);
    expect(wallLength(smallRoom, 'east')).toBe(4);
  });

  it('subtracts a centred doorway into two spans', () => {
    const spans = wallSpans(smallRoom, 'south'); // doorway width 1.2 at offset 0
    expect(spans).toEqual([
      [-2.5, -0.6],
      [0.6, 2.5],
    ]);
  });

  it('subtracts a centred window into two spans', () => {
    const spans = wallSpans(smallRoom, 'north'); // window width 1.0 at offset 0
    expect(spans).toEqual([
      [-2.5, -0.5],
      [0.5, 2.5],
    ]);
  });

  it('leaves an unopened wall as one full span', () => {
    expect(wallSpans(smallRoom, 'east')).toEqual([[-2, 2]]);
  });

  it('handles two openings on one wall', () => {
    const room: RoomSpec = {
      id: 'two',
      width: 12,
      depth: 9,
      doorways: [{ id: 'd', side: 'south', offset: 0 }],
      windows: [
        { id: 'w1', side: 'south', offset: -4 },
        { id: 'w2', side: 'south', offset: 4 },
      ],
    };
    const spans = wallSpans(room, 'south');
    // Three solid segments between the three openings, plus the ends.
    expect(spans.length).toBe(4);
    expect(spans[0][0]).toBe(-6);
    expect(spans[spans.length - 1][1]).toBe(6);
  });
});
