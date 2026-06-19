import { describe, it, expect } from 'vitest';
import { generateBreakpointFarm, FARM_WIDTH, FARM_HEIGHT } from '../../src/maps/breakpointFarm';
import { COLLIDING_TILES, TILE } from '../../src/maps/tiles';

describe('generateBreakpointFarm', () => {
  const farm = generateBreakpointFarm();

  it('has the declared dimensions', () => {
    expect(farm.width).toBe(FARM_WIDTH);
    expect(farm.height).toBe(FARM_HEIGHT);
    expect(farm.tiles).toHaveLength(FARM_HEIGHT);
    expect(farm.tiles.every((row) => row.length === FARM_WIDTH)).toBe(true);
  });

  it('is deterministic', () => {
    expect(generateBreakpointFarm().tiles).toEqual(farm.tiles);
  });

  it('includes collidable water and cliff tiles', () => {
    const flat = farm.tiles.flat();
    expect(flat).toContain(COLLIDING_TILES[0]); // water channel
    expect(farm.tiles[0].every((t) => t === 6)).toBe(true); // northern cliff row
  });

  it('spawns the player on a walkable, in-bounds tile', () => {
    const tx = Math.floor(farm.spawn.x / TILE);
    const ty = Math.floor(farm.spawn.y / TILE);
    expect(tx).toBeGreaterThanOrEqual(0);
    expect(tx).toBeLessThan(FARM_WIDTH);
    expect(ty).toBeGreaterThanOrEqual(0);
    expect(ty).toBeLessThan(FARM_HEIGHT);
    expect(COLLIDING_TILES).not.toContain(farm.tiles[ty][tx]);
  });

  it('places solid objects inside the map bounds', () => {
    expect(farm.objects.length).toBeGreaterThan(0);
    for (const obj of farm.objects) {
      expect(obj.tx).toBeGreaterThanOrEqual(0);
      expect(obj.tx).toBeLessThan(FARM_WIDTH);
      expect(obj.ty).toBeGreaterThanOrEqual(0);
      expect(obj.ty).toBeLessThan(FARM_HEIGHT);
    }
    expect(farm.objects.some((o) => o.type === 'house')).toBe(true);
  });
});
