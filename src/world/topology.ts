/**
 * Exterior world topology + coordinate frames (WEF-04, master Prompt 035).
 *
 * Pure math — no Babylon import — so the chunk grid, region floating origins,
 * stable persistence ids, and cross-region transition contracts are all
 * unit-testable and shared by the streaming controller (src/world/streaming.ts)
 * and the proving-ground scene.
 *
 * Coordinate doctrine (docs/WORLD_TOPOLOGY_AND_STREAMING.md):
 *  - Runtime is Y-up, metres, +Z forward (the §3.1 convention). This module
 *    operates in the XZ ground plane (`Vec2 = {x,z}`); height never affects
 *    streaming.
 *  - The world is partitioned per **region**. Each region owns a stable string
 *    id and a **local origin** in world space. Chunk coordinates are computed in
 *    region-local space (`world − origin`) so they stay small integers near the
 *    region no matter how far the region sits from the world origin — the
 *    "floating origin per region" strategy that keeps float precision stable
 *    across the whole planned world (Willa Crick ↔ Klam-ity River ↔ Ballast Bay).
 *  - A chunk's **persistence id** is `${regionId}#cx,cz` — derived from the
 *    region + integer coordinate, never from a render-mesh name (§3.1). It is
 *    invariant across tide/season/weather/restoration variants.
 */

/** A point on the XZ ground plane, in metres. */
export interface Vec2 {
  x: number;
  z: number;
}

/** Integer chunk indices in a region's local frame. */
export interface ChunkCoord {
  cx: number;
  cz: number;
}

/** A streamable region: a stable id + a world-space local origin. */
export interface Region {
  id: string;
  /** World-space position of the region's local origin (its (0,0) corner). */
  origin: Vec2;
  /** Human label for debug surfaces. */
  label: string;
}

/** World-space axis-aligned bounds of a chunk (XZ). */
export interface ChunkBounds {
  min: Vec2;
  max: Vec2;
}

/** A cross-region transition seam (§3.1): carries everything a handoff needs. */
export interface RegionTransition {
  id: string;
  /** Region the player leaves. */
  fromRegion: string;
  /** World-space anchor in the source region where the transition triggers. */
  fromAnchor: Vec2;
  /** Region the player enters. */
  toRegion: string;
  /** World-space anchor in the destination region to recover to. */
  toAnchor: Vec2;
  /** Facing (radians, about +Y) to restore on arrival. */
  facing: number;
  /** Camera context to hand off to on arrival (OoT-era authored handoff). */
  cameraContext: string;
}

/** Default exterior chunk edge length, in metres. Derivation: see the doc + below. */
export const DEFAULT_CHUNK_SIZE = 32;

/**
 * Region-local coordinate of a world point: `world − origin`. Keeps numbers
 * small near the region so float precision stays stable far from world (0,0).
 */
export function worldToLocal(region: Region, world: Vec2): Vec2 {
  return { x: world.x - region.origin.x, z: world.z - region.origin.z };
}

/** Inverse of {@link worldToLocal}: `local + origin`. */
export function localToWorld(region: Region, local: Vec2): Vec2 {
  return { x: local.x + region.origin.x, z: local.z + region.origin.z };
}

/** The chunk a world point falls in, in the region's local frame. */
export function worldToChunk(region: Region, world: Vec2, size = DEFAULT_CHUNK_SIZE): ChunkCoord {
  const local = worldToLocal(region, world);
  return { cx: Math.floor(local.x / size), cz: Math.floor(local.z / size) };
}

/** World-space min corner of a chunk. */
export function chunkOrigin(region: Region, coord: ChunkCoord, size = DEFAULT_CHUNK_SIZE): Vec2 {
  return localToWorld(region, { x: coord.cx * size, z: coord.cz * size });
}

/** World-space centre of a chunk. */
export function chunkCenter(region: Region, coord: ChunkCoord, size = DEFAULT_CHUNK_SIZE): Vec2 {
  return localToWorld(region, { x: (coord.cx + 0.5) * size, z: (coord.cz + 0.5) * size });
}

/** World-space bounds of a chunk. */
export function chunkBounds(region: Region, coord: ChunkCoord, size = DEFAULT_CHUNK_SIZE): ChunkBounds {
  const min = chunkOrigin(region, coord, size);
  return { min, max: { x: min.x + size, z: min.z + size } };
}

/**
 * Stable persistence id for a chunk: `${regionId}#cx,cz`. The save identity for
 * everything anchored to the chunk — invariant across content variants and
 * across reloads, and never tied to a render-mesh name (§3.1).
 */
export function chunkId(regionId: string, coord: ChunkCoord): string {
  return `${regionId}#${coord.cx},${coord.cz}`;
}

/** Parse a {@link chunkId} back into its region id + coordinate. */
export function parseChunkId(id: string): { regionId: string; coord: ChunkCoord } | null {
  const hash = id.lastIndexOf('#');
  if (hash < 0) return null;
  const regionId = id.slice(0, hash);
  const rest = id.slice(hash + 1);
  const comma = rest.indexOf(',');
  if (comma < 0) return null;
  const cx = Number(rest.slice(0, comma));
  const cz = Number(rest.slice(comma + 1));
  if (!Number.isInteger(cx) || !Number.isInteger(cz)) return null;
  return { regionId, coord: { cx, cz } };
}

/** Chebyshev (square-ring) radius between two chunk coords. */
export function chunkChebyshev(a: ChunkCoord, b: ChunkCoord): number {
  return Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cz - b.cz));
}

/**
 * All chunk coords within Chebyshev `radius` of `center` (a `(2r+1)²` square),
 * returned in a stable row-major order so callers are deterministic.
 */
export function chunksInRadius(center: ChunkCoord, radius: number): ChunkCoord[] {
  const out: ChunkCoord[] = [];
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      out.push({ cx: center.cx + dx, cz: center.cz + dz });
    }
  }
  return out;
}

/** The eight neighbours of a chunk (no centre). */
export function chunkNeighbors(coord: ChunkCoord): ChunkCoord[] {
  return chunksInRadius(coord, 1).filter((c) => !(c.cx === coord.cx && c.cz === coord.cz));
}

/** Whether two chunk coords are equal. */
export function chunkCoordEquals(a: ChunkCoord, b: ChunkCoord): boolean {
  return a.cx === b.cx && a.cz === b.cz;
}
