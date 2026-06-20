import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CHUNK_SIZE,
  chunkBounds,
  chunkCenter,
  chunkChebyshev,
  chunkCoordEquals,
  chunkId,
  chunkNeighbors,
  chunkOrigin,
  chunksInRadius,
  localToWorld,
  parseChunkId,
  worldToChunk,
  worldToLocal,
  type Region,
} from '../../src/world/topology';

const WILLA: Region = { id: 'willa-crick', label: 'Willa Crick', origin: { x: 0, z: 0 } };
const BALLAST: Region = { id: 'ballast-bay', label: 'Ballast Bay', origin: { x: 256, z: 0 } };

describe('world topology — coordinate frames', () => {
  it('round-trips world↔local through a region origin (floating origin)', () => {
    const world = { x: 300, z: 17 };
    const local = worldToLocal(BALLAST, world);
    expect(local).toEqual({ x: 44, z: 17 });
    expect(localToWorld(BALLAST, local)).toEqual(world);
  });

  it('keeps chunk coords small near a far region (numerical stability)', () => {
    // A point 300 m out in world space is only 44 m into Ballast Bay's frame, so
    // its chunk index is tiny — the precision-preserving property the doc claims.
    const coord = worldToChunk(BALLAST, { x: 300, z: 17 }, 32);
    expect(coord).toEqual({ cx: 1, cz: 0 });
  });

  it('worldToChunk floors into the owning cell, including negatives', () => {
    expect(worldToChunk(WILLA, { x: 0, z: 0 }, 32)).toEqual({ cx: 0, cz: 0 });
    expect(worldToChunk(WILLA, { x: 31.9, z: 31.9 }, 32)).toEqual({ cx: 0, cz: 0 });
    expect(worldToChunk(WILLA, { x: 32, z: 0 }, 32)).toEqual({ cx: 1, cz: 0 });
    expect(worldToChunk(WILLA, { x: -1, z: -1 }, 32)).toEqual({ cx: -1, cz: -1 });
  });

  it('chunkOrigin / chunkCenter / chunkBounds align to the grid', () => {
    expect(chunkOrigin(WILLA, { cx: 2, cz: 1 }, 32)).toEqual({ x: 64, z: 32 });
    expect(chunkCenter(WILLA, { cx: 2, cz: 1 }, 32)).toEqual({ x: 80, z: 48 });
    expect(chunkBounds(WILLA, { cx: 0, cz: 0 }, 32)).toEqual({ min: { x: 0, z: 0 }, max: { x: 32, z: 32 } });
  });

  it('chunk centre lands back in the same chunk', () => {
    const coord = { cx: 3, cz: -2 };
    const center = chunkCenter(BALLAST, coord, 32);
    expect(worldToChunk(BALLAST, center, 32)).toEqual(coord);
  });

  it('defaults the chunk size to DEFAULT_CHUNK_SIZE', () => {
    expect(DEFAULT_CHUNK_SIZE).toBe(32);
    expect(chunkOrigin(WILLA, { cx: 1, cz: 1 })).toEqual({ x: 32, z: 32 });
  });
});

describe('world topology — stable persistence ids', () => {
  it('derives a stable id from region + coord (not a mesh name)', () => {
    expect(chunkId('willa-crick', { cx: 2, cz: -3 })).toBe('willa-crick#2,-3');
  });

  it('parses an id back to region + coord', () => {
    expect(parseChunkId('willa-crick#2,-3')).toEqual({ regionId: 'willa-crick', coord: { cx: 2, cz: -3 } });
  });

  it('round-trips a region id that itself contains a hyphen', () => {
    const id = chunkId('ballast-bay', { cx: 0, cz: 0 });
    expect(parseChunkId(id)).toEqual({ regionId: 'ballast-bay', coord: { cx: 0, cz: 0 } });
  });

  it('rejects malformed ids', () => {
    expect(parseChunkId('no-hash')).toBeNull();
    expect(parseChunkId('region#1')).toBeNull();
    expect(parseChunkId('region#a,b')).toBeNull();
  });
});

describe('world topology — neighbourhoods', () => {
  it('chunksInRadius returns a (2r+1)² square in stable order', () => {
    const r0 = chunksInRadius({ cx: 0, cz: 0 }, 0);
    expect(r0).toEqual([{ cx: 0, cz: 0 }]);
    const r1 = chunksInRadius({ cx: 0, cz: 0 }, 1);
    expect(r1.length).toBe(9);
    expect(r1[0]).toEqual({ cx: -1, cz: -1 });
    expect(r1[8]).toEqual({ cx: 1, cz: 1 });
    expect(chunksInRadius({ cx: 0, cz: 0 }, 2).length).toBe(25);
  });

  it('chunkNeighbors excludes the centre', () => {
    const n = chunkNeighbors({ cx: 5, cz: 5 });
    expect(n.length).toBe(8);
    expect(n.some((c) => chunkCoordEquals(c, { cx: 5, cz: 5 }))).toBe(false);
  });

  it('chunkChebyshev measures the square-ring distance', () => {
    expect(chunkChebyshev({ cx: 0, cz: 0 }, { cx: 3, cz: 1 })).toBe(3);
    expect(chunkChebyshev({ cx: 0, cz: 0 }, { cx: -2, cz: -4 })).toBe(4);
  });
});
