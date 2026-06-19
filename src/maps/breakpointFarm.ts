import { TILE, TILE_INDEX, COLLIDING_TILES } from './tiles';

export const FARM_WIDTH = 40;
export const FARM_HEIGHT = 30;

export type FarmObjectType = 'tree' | 'rock' | 'house' | 'fence' | 'court';

export interface FarmObject {
  type: FarmObjectType;
  tx: number;
  ty: number;
  solid: boolean;
}

export interface FarmMap {
  width: number;
  height: number;
  tileSize: number;
  tiles: number[][];
  collides: number[];
  objects: FarmObject[];
  spawn: { x: number; y: number };
  waterIndices: [number, number];
}

/**
 * Deterministically generate the Breakpoint Farm map: a grass field with a
 * northern cliff edge, a tide-fed irrigation channel, a tilled soil patch, a
 * sandy corner, and scattered solid objects (house, trees, rocks, fence). No
 * randomness, so it is unit-testable and identical every run.
 */
export function generateBreakpointFarm(): FarmMap {
  const W = FARM_WIDTH;
  const H = FARM_HEIGHT;
  const tiles: number[][] = [];

  for (let y = 0; y < H; y++) {
    const row: number[] = [];
    for (let x = 0; x < W; x++) {
      row.push((x * 7 + y * 13) % 11 === 0 ? TILE_INDEX.grassAlt : TILE_INDEX.grass);
    }
    tiles.push(row);
  }

  // Northern cliff edge (solid boundary).
  for (let x = 0; x < W; x++) tiles[0][x] = TILE_INDEX.cliff;

  // Tide-fed irrigation channel (water, solid).
  for (let y = 2; y <= 20; y++) {
    tiles[y][5] = TILE_INDEX.waterA;
    tiles[y][6] = TILE_INDEX.waterA;
  }

  // Tilled soil patch (walkable).
  for (let y = 10; y <= 16; y++) {
    for (let x = 20; x <= 27; x++) tiles[y][x] = TILE_INDEX.soil;
  }

  // Sandy corner (bottom-right).
  for (let y = H - 5; y < H; y++) {
    for (let x = W - 6; x < W; x++) tiles[y][x] = TILE_INDEX.sand;
  }

  // Short path.
  for (let x = 18; x <= 20; x++) tiles[12][x] = TILE_INDEX.path;

  const objects: FarmObject[] = [
    { type: 'house', tx: 23, ty: 5, solid: true },
    { type: 'court', tx: 30, ty: 21, solid: false },
    { type: 'tree', tx: 10, ty: 8, solid: true },
    { type: 'tree', tx: 13, ty: 23, solid: true },
    { type: 'tree', tx: 33, ty: 7, solid: true },
    { type: 'tree', tx: 8, ty: 26, solid: true },
    { type: 'rock', tx: 27, ty: 24, solid: true },
    { type: 'rock', tx: 11, ty: 14, solid: true },
    { type: 'rock', tx: 35, ty: 15, solid: true },
    { type: 'fence', tx: 18, ty: 19, solid: true },
    { type: 'fence', tx: 19, ty: 19, solid: true },
    { type: 'fence', tx: 20, ty: 19, solid: true },
  ];

  return {
    width: W,
    height: H,
    tileSize: TILE,
    tiles,
    collides: [...COLLIDING_TILES],
    objects,
    spawn: { x: 15 * TILE + TILE / 2, y: 15 * TILE + TILE / 2 },
    waterIndices: [TILE_INDEX.waterA, TILE_INDEX.waterB],
  };
}
