/**
 * Interior graybox builder (WEF-05, master Prompt 036).
 *
 * Turns a pure `RoomSpec` (src/world/interior-kit.ts) into a closed-shell
 * graybox room: floor, ceiling, four walls segmented around doorways/windows,
 * plus the room's authored camera volume, doorway anchors, and interaction
 * anchors. The shell is **closed** (floor + ceiling + walls on every side with
 * only doorway/window gaps), which is the deliberate backing treatment: fading
 * or cutting away the near wall always reveals room interior, never a void to the
 * skybox. Primitives + `flatMaterial` only (§0.9); a future `.glb` swap replaces
 * the visible meshes without touching the volume/anchors/collision.
 */
import { MeshBuilder, TransformNode, type Mesh, type Scene } from '@babylonjs/core';
import { flatMaterial, PALETTE } from './scene-helpers';
import {
  INTERIOR_METRICS,
  wallSpans,
  type RoomSpec,
  type WallSide,
} from '../world/interior-kit';
import type { CameraVolume, Vec3, VolumeObstructionMode } from '../camera/volumes';

export interface DoorAnchor {
  id: string;
  /** World position of the threshold. */
  world: Vec3;
  /** Facing (rad, about +Y) to step through the doorway into the room. */
  facing: number;
  toAnchorId?: string;
}

export interface InteractionAnchor {
  id: string;
  kind: string;
  world: Vec3;
}

export interface BuiltRoom {
  id: string;
  node: TransformNode;
  meshes: Mesh[];
  /** Wall meshes that may be faded as the near occluder. */
  wallMeshes: Mesh[];
  /** Backing meshes (floor/ceiling/far walls) that keep the void filled. */
  backingMeshes: Mesh[];
  volume: CameraVolume;
  doorAnchors: DoorAnchor[];
  interactionAnchors: InteractionAnchor[];
  /** World centre of the room floor. */
  center: Vec3;
}

export interface BuildRoomOptions {
  /** World position of the room centre (floor at origin.y). */
  origin: Vec3;
  /** Camera profile id to activate inside (`context:variant`). */
  profileId: string;
  /** Safe fallback profile id if `profileId` fails to resolve. */
  fallbackProfileId?: string;
  /** Per-volume occluder mode (e.g. `cutaway` for an opaque public hall). */
  obstructionMode?: VolumeObstructionMode;
  /** Exit-hysteresis margin (m) so adjacent rooms don't oscillate the camera. */
  blendBoundary?: number;
  /** Volume priority (larger rooms usually lower, so a nook nested inside wins). */
  priority: number;
  /** Framed-target offset inside the volume (e.g. lift the camera target). */
  targetOffset?: Vec3;
}

const FACING: Record<WallSide, number> = {
  // Facing to walk from the doorway INTO the room (toward room centre).
  north: -Math.PI / 2, // +Z wall → face -Z
  south: Math.PI / 2, // -Z wall → face +Z
  east: Math.PI, // +X wall → face -X
  west: 0, // -X wall → face +X
};

/** Build a closed-shell graybox room from a spec. */
export function buildRoom(scene: Scene, spec: RoomSpec, opts: BuildRoomOptions): BuiltRoom {
  const m = INTERIOR_METRICS;
  const h = spec.height ?? m.wallHeight;
  const node = new TransformNode(`room-${spec.id}`, scene);
  node.position.set(opts.origin.x, opts.origin.y, opts.origin.z);

  const meshes: Mesh[] = [];
  const wallMeshes: Mesh[] = [];
  const backingMeshes: Mesh[] = [];

  const add = (mesh: Mesh, bucket: 'wall' | 'backing'): Mesh => {
    mesh.parent = node;
    meshes.push(mesh);
    (bucket === 'wall' ? wallMeshes : backingMeshes).push(mesh);
    return mesh;
  };

  // Floor + ceiling (backing — they keep the top/bottom void filled).
  const floor = MeshBuilder.CreateBox(`room-${spec.id}-floor`, { width: spec.width, height: m.floorThickness, depth: spec.depth }, scene);
  floor.position.set(0, -m.floorThickness / 2, 0);
  floor.material = flatMaterial(scene, `room-${spec.id}-floor`, PALETTE.interior, 0.18);
  floor.metadata = { layer: 'render', interiorPart: 'floor' };
  add(floor, 'backing');

  const ceil = MeshBuilder.CreateBox(`room-${spec.id}-ceil`, { width: spec.width, height: m.ceilingThickness, depth: spec.depth }, scene);
  ceil.position.set(0, h + m.ceilingThickness / 2, 0);
  ceil.material = flatMaterial(scene, `room-${spec.id}-ceil`, PALETTE.interior, 0.14);
  ceil.metadata = { layer: 'render', interiorPart: 'ceiling' };
  add(ceil, 'backing');

  // Four walls, each segmented around its doorways/windows.
  const sides: WallSide[] = ['north', 'south', 'east', 'west'];
  for (const side of sides) {
    buildWall(scene, spec, side, h, add);
  }

  // Features (counter / stair / furniture / interaction stand-ins).
  const interactionAnchors: InteractionAnchor[] = [];
  for (const f of spec.features ?? []) {
    buildFeature(scene, spec, f, opts.origin, add, interactionAnchors);
  }

  // Doorway anchors at each opening threshold.
  const doorAnchors: DoorAnchor[] = spec.doorways.map((d) => {
    const local = openingLocal(spec, d.side, d.offset);
    return {
      id: d.id,
      world: { x: opts.origin.x + local.x, y: opts.origin.y, z: opts.origin.z + local.z },
      facing: FACING[d.side],
      ...(d.toAnchorId ? { toAnchorId: d.toAnchorId } : {}),
    };
  });

  const center: Vec3 = { x: opts.origin.x, y: opts.origin.y, z: opts.origin.z };

  const volume: CameraVolume = {
    id: `vol-${spec.id}`,
    min: { x: opts.origin.x - spec.width / 2, y: opts.origin.y - 0.5, z: opts.origin.z - spec.depth / 2 },
    max: { x: opts.origin.x + spec.width / 2, y: opts.origin.y + h, z: opts.origin.z + spec.depth / 2 },
    profileId: opts.profileId,
    priority: opts.priority,
    ...(opts.fallbackProfileId ? { fallbackProfileId: opts.fallbackProfileId } : {}),
    ...(opts.obstructionMode ? { obstructionMode: opts.obstructionMode } : {}),
    ...(opts.blendBoundary !== undefined ? { blendBoundary: opts.blendBoundary } : {}),
    ...(opts.targetOffset ? { targetOffset: opts.targetOffset } : {}),
  };

  return { id: spec.id, node, meshes, wallMeshes, backingMeshes, volume, doorAnchors, interactionAnchors, center };
}

/** Local XZ of an opening centre on a wall side. */
function openingLocal(spec: RoomSpec, side: WallSide, offset: number): { x: number; z: number } {
  switch (side) {
    case 'north':
      return { x: offset, z: spec.depth / 2 };
    case 'south':
      return { x: offset, z: -spec.depth / 2 };
    case 'east':
      return { x: spec.width / 2, z: offset };
    case 'west':
      return { x: -spec.width / 2, z: offset };
  }
}

function buildWall(
  scene: Scene,
  spec: RoomSpec,
  side: WallSide,
  h: number,
  add: (mesh: Mesh, bucket: 'wall' | 'backing') => Mesh,
): void {
  const m = INTERIOR_METRICS;
  const t = m.wallThickness;
  const spans = wallSpans(spec, side);
  const horizontal = side === 'north' || side === 'south';
  const fixed = side === 'north' ? spec.depth / 2 : side === 'south' ? -spec.depth / 2 : side === 'east' ? spec.width / 2 : -spec.width / 2;

  spans.forEach(([a, b], i) => {
    const len = b - a;
    if (len <= 1e-4) return;
    const mid = (a + b) / 2;
    const wall = MeshBuilder.CreateBox(
      `room-${spec.id}-wall-${side}-${i}`,
      horizontal ? { width: len, height: h, depth: t } : { width: t, height: h, depth: len },
      scene,
    );
    if (horizontal) wall.position.set(mid, h / 2, fixed);
    else wall.position.set(fixed, h / 2, mid);
    wall.material = flatMaterial(scene, `room-${spec.id}-wall-${side}-${i}`, PALETTE.stone, 0.16);
    wall.metadata = { layer: 'render', interiorPart: 'wall', side };
    add(wall, 'wall');
  });

  // Window lintels/aprons: fill above the head and below the sill so the opening
  // is a window, not a doorway-height void (keeps the shell closed).
  for (const win of spec.windows ?? []) {
    if (win.side !== side) continue;
    const w = win.width ?? m.window.width;
    const local = openingLocal(spec, side, win.offset);
    const apronH = m.window.sill;
    const headY = m.window.sill + m.window.height;
    const lintelH = h - headY;
    const place = (yCenter: number, height: number, tag: string): void => {
      if (height <= 1e-4) return;
      const fill = MeshBuilder.CreateBox(
        `room-${spec.id}-win-${win.id}-${tag}`,
        horizontal ? { width: w, height, depth: t } : { width: t, height, depth: w },
        scene,
      );
      if (horizontal) fill.position.set(local.x, yCenter, fixed);
      else fill.position.set(fixed, yCenter, local.z);
      fill.material = flatMaterial(scene, `room-${spec.id}-win-${win.id}-${tag}`, PALETTE.stone, 0.16);
      fill.metadata = { layer: 'render', interiorPart: 'window-fill', side };
      add(fill, 'wall');
    };
    place(apronH / 2, apronH, 'apron');
    place(headY + lintelH / 2, lintelH, 'lintel');
  }
}

function buildFeature(
  scene: Scene,
  spec: RoomSpec,
  f: NonNullable<RoomSpec['features']>[number],
  origin: Vec3,
  add: (mesh: Mesh, bucket: 'wall' | 'backing') => Mesh,
  anchors: InteractionAnchor[],
): void {
  const m = INTERIOR_METRICS;
  if (f.kind === 'stair') {
    const steps = Math.max(1, Math.round(f.size.d / m.stair.run));
    for (let i = 0; i < steps; i++) {
      const stepH = m.stair.rise * (i + 1);
      const box = MeshBuilder.CreateBox(`room-${spec.id}-${f.id}-step-${i}`, { width: f.size.w, height: stepH, depth: m.stair.run }, scene);
      box.position.set(f.at.x, stepH / 2, f.at.z - f.size.d / 2 + i * m.stair.run + m.stair.run / 2);
      box.material = flatMaterial(scene, `room-${spec.id}-${f.id}-step-${i}`, PALETTE.cliff, 0.16);
      box.metadata = { layer: 'render', interiorPart: 'stair' };
      add(box, 'backing');
    }
    return;
  }
  const height = f.kind === 'counter' ? m.counter.height : 0.8;
  const box = MeshBuilder.CreateBox(`room-${spec.id}-${f.id}`, { width: f.size.w, height, depth: f.size.d }, scene);
  box.position.set(f.at.x, height / 2, f.at.z);
  box.material = flatMaterial(scene, `room-${spec.id}-${f.id}`, f.kind === 'counter' ? PALETTE.wood : PALETTE.roof, 0.22);
  box.metadata = { layer: 'render', interiorPart: f.kind };
  add(box, 'backing');
  if (f.kind === 'counter' || f.kind === 'interaction') {
    anchors.push({ id: `${spec.id}:${f.id}`, kind: f.kind, world: { x: origin.x + f.at.x, y: origin.y + height, z: origin.z + f.at.z } });
  }
}
