import { describe, it, expect } from 'vitest';
import { FarmGrid, FARM_CELL_SIZE } from '../../src/engine/farmGrid';

describe('FarmGrid', () => {
  it('creates a grid filled with the given state', () => {
    const g = new FarmGrid(8, 6, 'tilled');
    expect(g.cols).toBe(8);
    expect(g.rows).toBe(6);
    expect(g.get(0, 0)).toBe('tilled');
    expect(g.get(7, 5)).toBe('tilled');
  });

  it('rejects non-positive dimensions', () => {
    expect(() => new FarmGrid(0, 4)).toThrow();
    expect(() => new FarmGrid(4, -1)).toThrow();
  });

  it('bounds-checks addresses', () => {
    const g = new FarmGrid(4, 4);
    expect(g.inBounds(0, 0)).toBe(true);
    expect(g.inBounds(3, 3)).toBe(true);
    expect(g.inBounds(4, 0)).toBe(false);
    expect(g.inBounds(-1, 0)).toBe(false);
    expect(g.inBounds(1.5, 0)).toBe(false);
    expect(() => g.get(4, 0)).toThrow();
    expect(() => g.set(0, 4, 'tilled')).toThrow();
  });

  it('get/set round-trips and is addressable', () => {
    const g = new FarmGrid(3, 3);
    g.set(1, 2, 'watered');
    expect(g.get(1, 2)).toBe('watered');
    expect(g.get(0, 0)).toBe('untilled');
    expect(g.index(1, 2)).toBe(2 * 3 + 1);
  });

  it('cellToWorld and worldToCell are exact inverses (centered grid)', () => {
    const g = new FarmGrid(5, 5);
    for (let row = 0; row < g.rows; row++) {
      for (let col = 0; col < g.cols; col++) {
        const w = g.cellToWorld(col, row);
        expect(g.worldToCell(w.x, w.z)).toEqual({ col, row });
      }
    }
  });

  it('worldToCell returns null outside the grid', () => {
    const g = new FarmGrid(4, 4);
    expect(g.worldToCell(1000, 1000)).toBeNull();
  });

  it('forEach visits every cell exactly once', () => {
    const g = new FarmGrid(3, 2);
    let count = 0;
    g.forEach(() => (count += 1));
    expect(count).toBe(6);
  });

  it('exports a positive cell size', () => {
    expect(FARM_CELL_SIZE).toBeGreaterThan(0);
  });
});
