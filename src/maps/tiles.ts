/** Tile constants shared by the map data and the texture generator. Phaser-free. */
export const TILE = 32;

export const TILE_INDEX = {
  grass: 0,
  grassAlt: 1,
  soil: 2,
  sand: 3,
  waterA: 4,
  waterB: 5,
  cliff: 6,
  path: 7,
} as const;

export type TileIndex = (typeof TILE_INDEX)[keyof typeof TILE_INDEX];

/** Tiles the player cannot walk through. */
export const COLLIDING_TILES: number[] = [TILE_INDEX.waterA, TILE_INDEX.waterB, TILE_INDEX.cliff];
