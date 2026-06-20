import {
  Scene,
  MeshBuilder,
  Matrix,
  Ray,
  Vector3,
  type AbstractMesh,
  type Mesh,
} from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, PALETTE } from '../render/scene-helpers';
import { CameraRig, type FollowTarget, type CameraRigState } from '../camera/rig';
import { CameraInputController, mergeInput, ZERO_INPUT } from '../camera/input';
import { baselineProfile } from '../camera/profiles';
import type { Planar } from '../camera/orbit';
import { buildRoom, type BuiltRoom } from '../render/interior-builder';
import { validateRoomSpec, type RoomSpec } from '../world/interior-kit';
import type { Vec3 } from '../camera/volumes';

/**
 * Interior construction-kit proving ground (WEF-05, master Prompt 036).
 *
 * Stands up the five interior archetypes the kit must cover — small room,
 * corridor, stair room, crowded shop, large public hall — each built from the
 * metric kit (src/world/interior-kit.ts) by the graybox builder
 * (src/render/interior-builder.ts) with its authored camera volume. It proves
 * the WEF-05 contract: authored volumes override profile / target-offset /
 * yaw-bounds / obstruction-mode and blend without oscillation at shared edges
 * (blend boundary + sticky selection); the near wall fades/cuts away over a
 * closed backing shell (never a void to the skybox); the player + primary
 * interaction stay readable on Pixel 5; and the exterior↔interior handoff
 * preserves the destination anchor, facing, camera intent, clock, NPC state, and
 * return path.
 *
 * Reachable via the Title "Dev · Interior Lab" item (dev builds) or the
 * `?scene=InteriorLab` direct-boot route (works in the production preview build).
 */

const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.4;
const WALK_SPEED = 3.2;

interface HandoffRecord {
  fromAnchorId: string;
  toRoomId: string;
  toAnchorId: string;
  facing: number;
  cameraContext: string;
  /** State the handoff must carry across unchanged. */
  preserved: { clockMinutes: number; npcToken: string; returnPath: { x: number; z: number; facing: number } };
}

/** The five archetype specs (interior footprints in metres). */
const ROOM_SPECS: RoomSpec[] = [
  {
    id: 'small-room',
    width: 5,
    depth: 4,
    doorways: [{ id: 'small-door', side: 'south', offset: 0, toAnchorId: 'ext-small' }],
    windows: [{ id: 'small-win', side: 'north', offset: 0 }],
  },
  {
    id: 'corridor',
    width: 2,
    depth: 10,
    doorways: [
      { id: 'corr-s', side: 'south', offset: 0, toAnchorId: 'ext-corr' },
      { id: 'corr-n', side: 'north', offset: 0 },
    ],
  },
  {
    id: 'stair-room',
    width: 6,
    depth: 6,
    doorways: [{ id: 'stair-door', side: 'south', offset: 0, toAnchorId: 'ext-stair' }],
    features: [{ id: 'stair', kind: 'stair', at: { x: 1.6, z: 0 }, size: { w: 1.4, d: 4 } }],
  },
  {
    id: 'crowded-shop',
    width: 7,
    depth: 6,
    doorways: [{ id: 'shop-door', side: 'south', offset: 0, toAnchorId: 'ext-shop' }],
    features: [
      { id: 'counter', kind: 'counter', at: { x: 0, z: 1.6 }, size: { w: 3, d: 0.7 } },
      { id: 'crate', kind: 'furniture', at: { x: -2.4, z: -1.4 }, size: { w: 0.8, d: 0.8 } },
      { id: 'shelf', kind: 'furniture', at: { x: 2.4, z: -1.4 }, size: { w: 0.8, d: 0.8 } },
    ],
  },
  {
    id: 'large-hall',
    width: 12,
    depth: 9,
    doorways: [{ id: 'hall-door', side: 'south', offset: 0, toAnchorId: 'ext-hall' }],
    windows: [
      { id: 'hall-w1', side: 'east', offset: -2 },
      { id: 'hall-w2', side: 'east', offset: 2 },
    ],
  },
];

/** World origins for each archetype (spread so each frames in isolation). */
const ROOM_ORIGINS: Record<string, Vec3> = {
  'small-room': { x: 0, y: 0, z: 0 },
  corridor: { x: 22, y: 0, z: 0 },
  'stair-room': { x: -22, y: 0, z: 0 },
  'crowded-shop': { x: 0, y: 0, z: 26 },
  'large-hall': { x: 0, y: 0, z: -28 },
};

/** Per-room volume wiring: profile, priority, obstruction override, blend margin. */
const ROOM_VOLUME: Record<string, { profileId: string; priority: number; obstructionMode?: 'fade' | 'cutaway' }> = {
  'small-room': { profileId: 'smallInterior:standard', priority: 20 },
  corridor: { profileId: 'smallInterior:standard', priority: 20 },
  'stair-room': { profileId: 'smallInterior:standard', priority: 18 },
  'crowded-shop': { profileId: 'largeInterior:standard', priority: 16 },
  'large-hall': { profileId: 'largeInterior:standard', priority: 14, obstructionMode: 'cutaway' },
};

export class InteriorLabScene extends GameScene {
  private rig!: CameraRig;
  private input: CameraInputController | null = null;
  private playerMesh!: Mesh;
  private playerPos = new Vector3(0, PLAYER_HEIGHT / 2, 6);
  private facing = 0;
  private velocity: Planar = { x: 0, z: 0 };
  private readonly rooms = new Map<string, BuiltRoom>();
  private readonly shopNpcs: Mesh[] = [];

  // Handoff state (the preserved fields a real exterior↔interior transition carries).
  private clockMinutes = 9 * 60; // 9:00 AM — never mutated by a transition
  private npcToken = 'npc-state-v1';
  private lastHandoff: HandoffRecord | null = null;
  private returnAnchor: { x: number; z: number; facing: number } | null = null;

  private readonly held = new Set<string>();
  private onKeyDown!: (e: KeyboardEvent) => void;
  private onKeyUp!: (e: KeyboardEvent) => void;

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    this.scene = scene;
    addFog(scene, PALETTE.fog, 0.01);
    addLights(scene);

    // A neutral exterior ground so the rooms sit in a legible world.
    const ground = MeshBuilder.CreateGround('interior-lab-ground', { width: 120, height: 120 }, scene);
    ground.material = flatMaterial(scene, 'interior-lab-ground', PALETTE.grass, 0.2);
    ground.isPickable = false;

    const player = MeshBuilder.CreateCapsule('interior-player', { height: PLAYER_HEIGHT, radius: PLAYER_RADIUS }, scene);
    player.material = flatMaterial(scene, 'interior-player', PALETTE.player, 0.35);
    player.isPickable = false;
    player.position.copyFrom(this.playerPos);
    this.playerMesh = player;

    // Build every archetype + collect its authored volume.
    const volumes = [];
    for (const spec of ROOM_SPECS) {
      const cfg = ROOM_VOLUME[spec.id];
      const built = buildRoom(scene, spec, {
        origin: ROOM_ORIGINS[spec.id],
        profileId: cfg.profileId,
        fallbackProfileId: 'exterior:standard',
        blendBoundary: 0.6,
        priority: cfg.priority,
        ...(cfg.obstructionMode ? { obstructionMode: cfg.obstructionMode } : {}),
      });
      this.rooms.set(spec.id, built);
      volumes.push(built.volume);
    }

    // Clutter the shop with NPC capsules to test crowded readability.
    const shop = this.rooms.get('crowded-shop')!;
    [
      [-1.4, 0.4],
      [1.4, 0.4],
      [0, -1.2],
    ].forEach(([dx, dz], i) => {
      const npc = MeshBuilder.CreateCapsule(`shop-npc-${i}`, { height: PLAYER_HEIGHT, radius: PLAYER_RADIUS }, scene);
      npc.position.set(shop.center.x + dx, PLAYER_HEIGHT / 2, shop.center.z + dz);
      npc.material = flatMaterial(scene, `shop-npc-${i}`, PALETTE.accent, 0.3);
      this.shopNpcs.push(npc);
    });

    this.rig = new CameraRig(scene, baselineProfile('exterior'), -Math.PI / 2);
    const follow: FollowTarget = {
      position: () => new Vector3(this.playerMesh.position.x, this.playerMesh.position.y + 0.6, this.playerMesh.position.z),
      velocity: () => this.velocity,
      ignore: (): readonly AbstractMesh[] => [this.playerMesh, ...this.shopNpcs],
    };
    this.rig.setTarget(follow);
    this.rig.setVolumes(volumes);

    return scene;
  }

  override enter(): void {
    const canvas = this.ctx.engine.getRenderingCanvas();
    if (canvas) this.input = new CameraInputController(canvas);
    this.onKeyDown = (e) => this.held.add(e.key.toLowerCase());
    this.onKeyUp = (e) => this.held.delete(e.key.toLowerCase());
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.installDebugApi();
  }

  override update(dt: number): void {
    if (dt <= 0) return;
    this.stepMovement(dt);
    const camInput = this.input ? this.input.consume(dt) : { ...ZERO_INPUT };
    this.rig.update(dt, mergeInput(camInput, { ...ZERO_INPUT }));
  }

  override dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.input?.dispose();
    this.rig?.dispose();
    delete (window as unknown as { sturdyVolleyInterior?: unknown }).sturdyVolleyInterior;
    super.dispose();
  }

  private stepMovement(dt: number): void {
    const fwd = (this.held.has('w') || this.held.has('arrowup') ? 1 : 0) - (this.held.has('s') || this.held.has('arrowdown') ? 1 : 0);
    const str = (this.held.has('d') || this.held.has('arrowright') ? 1 : 0) - (this.held.has('a') || this.held.has('arrowleft') ? 1 : 0);
    if (fwd === 0 && str === 0) {
      this.velocity = { x: 0, z: 0 };
      return;
    }
    const alpha = this.rig.camera.alpha;
    const forward: Planar = { x: -Math.cos(alpha), z: -Math.sin(alpha) };
    const right: Planar = { x: -Math.sin(alpha), z: Math.cos(alpha) };
    let mx = right.x * str + forward.x * fwd;
    let mz = right.z * str + forward.z * fwd;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len;
    mz /= len;
    this.playerPos.x += mx * WALK_SPEED * dt;
    this.playerPos.z += mz * WALK_SPEED * dt;
    this.facing = Math.atan2(mx, mz);
    this.velocity = { x: mx * WALK_SPEED, z: mz * WALK_SPEED };
    this.playerMesh.position.copyFrom(this.playerPos);
    this.playerMesh.rotation.y = this.facing;
  }

  private placePlayer(x: number, z: number, facing = this.facing): void {
    this.playerPos.set(x, PLAYER_HEIGHT / 2, z);
    this.facing = facing;
    this.velocity = { x: 0, z: 0 };
    this.playerMesh.position.copyFrom(this.playerPos);
    this.playerMesh.rotation.y = facing;
  }

  /** Exterior→interior handoff: snapshot the return path + preserved state, then
   *  recover the player onto the room's doorway anchor facing into the room. */
  private enterRoom(roomId: string): HandoffRecord | null {
    const room = this.rooms.get(roomId);
    if (!room || room.doorAnchors.length === 0) return null;
    const door = room.doorAnchors[0];
    this.returnAnchor = { x: this.playerPos.x, z: this.playerPos.z, facing: this.facing };
    const handoff: HandoffRecord = {
      fromAnchorId: door.toAnchorId ?? `ext-${roomId}`,
      toRoomId: roomId,
      toAnchorId: door.id,
      facing: door.facing,
      cameraContext: room.volume.profileId.split(':')[0],
      preserved: { clockMinutes: this.clockMinutes, npcToken: this.npcToken, returnPath: { ...this.returnAnchor } },
    };
    // Step just inside the doorway, facing into the room.
    const inward = { x: Math.sin(door.facing), z: Math.cos(door.facing) };
    this.placePlayer(door.world.x + inward.x * 0.8, door.world.z + inward.z * 0.8, door.facing);
    this.lastHandoff = handoff;
    return handoff;
  }

  /** Return to the exterior: restore the saved return path pose + facing. */
  private exitRoom(): { x: number; z: number; facing: number } | null {
    if (!this.returnAnchor) return null;
    const r = this.returnAnchor;
    this.placePlayer(r.x, r.z, r.facing);
    this.returnAnchor = null;
    return r;
  }

  /** Void test: hide the wall nearest the camera and confirm the camera→room-centre
   *  ray still hits a backing surface (closed shell), never escaping to the sky. */
  private seesBackingThroughNearWall(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room || room.wallMeshes.length === 0) return false;
    const camPos = this.rig.camera.position;
    let near: Mesh | null = null;
    let bestD = Infinity;
    for (const w of room.wallMeshes) {
      const d = Vector3.Distance(camPos, w.getAbsolutePosition());
      if (d < bestD) {
        bestD = d;
        near = w;
      }
    }
    if (!near) return false;
    const wasVisible = near.isVisible;
    near.isVisible = false; // simulate a full fade / cutaway of the near wall
    const target = new Vector3(room.center.x, room.center.y + 0.6, room.center.z);
    const dir = target.subtract(camPos).normalize();
    const ray = new Ray(camPos, dir, Vector3.Distance(camPos, target) + 6);
    const roomMeshes = new Set<AbstractMesh>(room.meshes);
    const pick = this.scene.pickWithRay(ray, (mesh) => roomMeshes.has(mesh) && mesh !== near);
    near.isVisible = wasVisible;
    return Boolean(pick?.hit);
  }

  /** Nearest interaction anchor to the player + its screen framing (readability). */
  private interactionFocus(): { id: string | null; onScreen: boolean; x: number; y: number } {
    let best: { id: string; world: Vec3 } | null = null;
    let bestD = Infinity;
    for (const room of this.rooms.values()) {
      for (const a of room.interactionAnchors) {
        const d = Math.hypot(a.world.x - this.playerPos.x, a.world.z - this.playerPos.z);
        if (d < bestD) {
          bestD = d;
          best = { id: a.id, world: a.world };
        }
      }
    }
    if (!best || bestD > 3) return { id: null, onScreen: false, x: 0, y: 0 };
    const screen = this.project(new Vector3(best.world.x, best.world.y, best.world.z));
    return { id: best.id, onScreen: screen.onScreen, x: screen.x, y: screen.y };
  }

  private project(world: Vector3): { x: number; y: number; onScreen: boolean } {
    const engine = this.ctx.engine;
    const w = engine.getRenderWidth();
    const h = engine.getRenderHeight();
    const p = Vector3.Project(world, Matrix.Identity(), this.scene.getTransformMatrix(), this.rig.camera.viewport.toGlobal(w, h));
    const nx = p.x / w;
    const ny = p.y / h;
    return { x: nx, y: ny, onScreen: p.z > 0 && p.z < 1 && nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1 };
  }

  private installDebugApi(): void {
    const api = {
      rooms: (): string[] => [...this.rooms.keys()],
      meshCount: (): number => this.scene.meshes.length,
      player: (): { x: number; z: number; facing: number } => ({ x: this.playerPos.x, z: this.playerPos.z, facing: this.facing }),
      setPlayer: (x: number, z: number, facing?: number): void => this.placePlayer(x, z, facing ?? this.facing),
      /** Teleport to a room centre (camera volume should engage). */
      gotoRoom: (id: string): boolean => {
        const room = this.rooms.get(id);
        if (!room) return false;
        this.placePlayer(room.center.x, room.center.z);
        return true;
      },
      roomConformant: (id: string): { ok: boolean; issues: string[] } => {
        const spec = ROOM_SPECS.find((s) => s.id === id);
        if (!spec) return { ok: false, issues: ['unknown room'] };
        const issues = validateRoomSpec(spec);
        return { ok: issues.length === 0, issues: issues.map((i) => i.code) };
      },
      cameraState: (): CameraRigState => this.rig.getState(),
      activeVolumeId: (): string | null => this.rig.getState().activeVolumeId,
      seesBackingThroughNearWall: (id: string): boolean => this.seesBackingThroughNearWall(id),
      interactionFocus: () => this.interactionFocus(),
      playerScreen: (): { x: number; y: number; onScreen: boolean } =>
        this.project(new Vector3(this.playerMesh.position.x, this.playerMesh.position.y + 0.6, this.playerMesh.position.z)),
      enterRoom: (id: string): HandoffRecord | null => this.enterRoom(id),
      exitRoom: (): { x: number; z: number; facing: number } | null => this.exitRoom(),
      lastHandoff: (): HandoffRecord | null => this.lastHandoff,
      /** Preserved-state probes — a transition must never mutate these. */
      clockMinutes: (): number => this.clockMinutes,
      npcToken: (): string => this.npcToken,
      doorAnchors: (id: string): Array<{ id: string; facing: number; toAnchorId: string | null }> => {
        const room = this.rooms.get(id);
        return room ? room.doorAnchors.map((d) => ({ id: d.id, facing: d.facing, toAnchorId: d.toAnchorId ?? null })) : [];
      },
    };
    (window as unknown as { sturdyVolleyInterior?: typeof api }).sturdyVolleyInterior = api;
  }
}
