import {
  Scene,
  MeshBuilder,
  Ray,
  Vector3,
  type AbstractMesh,
  type Mesh,
} from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, PALETTE } from '../render/scene-helpers';
import { CameraRig, type FollowTarget, type CameraRigState } from '../camera/rig';
import { baselineProfile } from '../camera/profiles';
import { CameraInputController, ZERO_INPUT, type CameraInput } from '../camera/input';
import { buildRoom, type BuiltRoom } from '../render/interior-builder';
import { validateRoomSpec, INTERIOR_METRICS, type RoomSpec } from '../world/interior-kit';
import {
  createMotorState,
  stepMotor,
  NO_WALL,
  NO_CEILING,
  NO_GROUND,
  flatGround,
  type MotorState,
  type MotorEnvironment,
} from '../engine/motor';
import {
  DEFAULT_CLOCK_MINUTES,
  NPC_STATE_TOKEN,
  type RegionTransitionData,
} from '../world/region-transition';

/**
 * Farmhouse interior — production-foundation map I interior (WEF-10a, master
 * Prompt 046). The **Prompt 036 interior-kit reference implementation**: built by
 * `buildRoom` from a `RoomSpec` grounded in `sv_map_023_farmhouse_interior_starter.png`
 * (bed, fireplace, kitchen counter/hutch, dining table, chest, rug, south door,
 * a window), with its authored `smallInterior` camera volume, the shared motor,
 * and near-wall fade over the closed backing shell. The south door transitions
 * back to Breakpoint Farm, restoring the saved return pose and carrying the clock
 * + NPC token across unchanged.
 *
 * Reachable via the Title "Dev · Farmhouse" item or `?scene=FarmhouseInterior`
 * (boots standalone with a default return pose; normally entered via the farm).
 */

const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.4;
const WALK_SPEED = 3.0;
const FIXED_DT = 1 / 30;

/** Farmhouse room (interior footprint, m). Features mirror the art board. */
export const FARMHOUSE_SPEC: RoomSpec = {
  id: 'farmhouse',
  width: 9,
  depth: 8,
  doorways: [{ id: 'farmhouse-door', side: 'south', offset: 0, toAnchorId: 'farm-farmhouse-door' }],
  windows: [{ id: 'farmhouse-win', side: 'north', offset: -2.5 }],
  features: [
    { id: 'bed', kind: 'furniture', at: { x: -3.4, z: 1.5 }, size: { w: 1.2, d: 2.2 } },
    { id: 'fireplace', kind: 'interaction', at: { x: 0, z: 3.2 }, size: { w: 1.6, d: 0.5 } },
    { id: 'kitchen-counter', kind: 'counter', at: { x: 2.8, z: 3.2 }, size: { w: 1.8, d: 0.6 } },
    { id: 'dining-table', kind: 'furniture', at: { x: 2.6, z: -2.0 }, size: { w: 1.4, d: 0.9 } },
    { id: 'chest', kind: 'interaction', at: { x: -3.6, z: -1.8 }, size: { w: 0.8, d: 0.8 } },
  ],
};

const HALF_W = FARMHOUSE_SPEC.width / 2;
const HALF_D = FARMHOUSE_SPEC.depth / 2;

export class FarmhouseInteriorScene extends GameScene {
  private rig!: CameraRig;
  private input: CameraInputController | null = null;
  private playerMesh!: Mesh;
  private motor!: MotorState;
  private velocity = { x: 0, z: 0 };
  private moveX = 0;
  private moveZ = 0;
  private room!: BuiltRoom;

  private clockMinutes = DEFAULT_CLOCK_MINUTES;
  private npcToken = NPC_STATE_TOKEN;
  private returnAnchor: { x: number; z: number; facing: number } = { x: 56, z: 45, facing: Math.PI };
  private transitioning = false;

  private readonly held = new Set<string>();
  private onKeyDown?: (e: KeyboardEvent) => void;
  private onKeyUp?: (e: KeyboardEvent) => void;

  build(): Scene {
    const scene = makeScene(this.ctx.engine);
    this.scene = scene;
    addFog(scene, PALETTE.fog, 0.004);
    addLights(scene);

    this.room = buildRoom(scene, FARMHOUSE_SPEC, {
      origin: { x: 0, y: 0, z: 0 },
      profileId: 'smallInterior:standard',
      fallbackProfileId: 'exterior:standard',
      blendBoundary: 0.6,
      priority: 20,
    });

    const player = MeshBuilder.CreateCapsule('farmhouse-player', { height: PLAYER_HEIGHT, radius: PLAYER_RADIUS }, scene);
    player.material = flatMaterial(scene, 'farmhouse-player', PALETTE.player, 0.35);
    player.isPickable = false;
    this.playerMesh = player;
    // Default arrival: just inside the south door, facing into the room (+Z).
    this.motor = createMotorState({ x: 0, y: PLAYER_HEIGHT / 2, z: -HALF_D + 1.2 }, 0);
    this.motor.grounded = true;
    this.syncPlayer();

    this.rig = new CameraRig(scene, baselineProfile('smallInterior'), -Math.PI / 2);
    const follow: FollowTarget = {
      position: () => new Vector3(this.motor.position.x, this.motor.position.y + 0.6, this.motor.position.z),
      velocity: () => this.velocity,
      ignore: (): readonly AbstractMesh[] => [this.playerMesh],
    };
    this.rig.setTarget(follow);
    this.rig.setVolumes([this.room.volume]);

    return scene;
  }

  override enter(data?: unknown): void {
    const t = data as RegionTransitionData | undefined;
    if (t && typeof t.clockMinutes === 'number') {
      this.clockMinutes = t.clockMinutes;
      this.npcToken = t.npcToken;
      if (t.returnAnchor) this.returnAnchor = t.returnAnchor;
    }
    const canvas = this.ctx.engine.getRenderingCanvas();
    if (canvas) this.input = new CameraInputController(canvas);
    this.onKeyDown = (e) => {
      this.held.add(e.key.toLowerCase());
      if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') this.pressAction();
    };
    this.onKeyUp = (e) => this.held.delete(e.key.toLowerCase());
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.installDebugApi();
  }

  override update(dt: number): void {
    if (dt <= 0) return;
    this.readKeys();
    this.step(dt);
    const camInput: CameraInput = this.input ? this.input.consume(dt) : ZERO_INPUT;
    this.rig.update(dt, camInput);
  }

  override dispose(): void {
    if (this.onKeyDown) window.removeEventListener('keydown', this.onKeyDown);
    if (this.onKeyUp) window.removeEventListener('keyup', this.onKeyUp);
    this.input?.dispose();
    this.rig?.dispose();
    delete (window as unknown as { sturdyVolleyFarmhouse?: unknown }).sturdyVolleyFarmhouse;
    super.dispose();
  }

  private readKeys(): void {
    const fwd = (this.held.has('w') || this.held.has('arrowup') ? 1 : 0) - (this.held.has('s') || this.held.has('arrowdown') ? 1 : 0);
    const str = (this.held.has('d') || this.held.has('arrowright') ? 1 : 0) - (this.held.has('a') || this.held.has('arrowleft') ? 1 : 0);
    if (fwd === 0 && str === 0) {
      this.moveX = 0;
      this.moveZ = 0;
      return;
    }
    const alpha = this.rig.camera.alpha;
    this.moveX = -Math.sin(alpha) * str + -Math.cos(alpha) * fwd;
    this.moveZ = Math.cos(alpha) * str + -Math.sin(alpha) * fwd;
  }

  private step(dt: number): void {
    const mag = Math.hypot(this.moveX, this.moveZ);
    const moveDir = mag > 1e-4 ? { x: this.moveX / mag, z: this.moveZ / mag } : { x: 0, z: 0 };
    const env: MotorEnvironment = { ground: flatGround(0), wall: NO_WALL, stepGround: NO_GROUND, ceiling: NO_CEILING };
    this.motor = stepMotor(this.motor, { moveDir, speed: mag > 1e-4 ? WALK_SPEED : 0 }, env, dt);
    // Interior wall collision: clamp to the room minus wall thickness, with a
    // door gap on the south wall so the threshold stays reachable.
    const t = INTERIOR_METRICS.wallThickness;
    const limX = HALF_W - PLAYER_RADIUS - t;
    const limZ = HALF_D - PLAYER_RADIUS - t;
    this.motor.position.x = Math.max(-limX, Math.min(limX, this.motor.position.x));
    const nearDoorX = Math.abs(this.motor.position.x) < 0.7;
    const minZ = nearDoorX ? -HALF_D - 0.2 : -limZ;
    this.motor.position.z = Math.max(minZ, Math.min(limZ, this.motor.position.z));
    this.velocity = { x: moveDir.x * WALK_SPEED * (mag > 1e-4 ? 1 : 0), z: moveDir.z * WALK_SPEED * (mag > 1e-4 ? 1 : 0) };
    this.syncPlayer();
  }

  private syncPlayer(): void {
    this.playerMesh.position.set(this.motor.position.x, this.motor.position.y, this.motor.position.z);
    this.playerMesh.rotation.y = this.motor.facing;
  }

  private atDoor(): boolean {
    return Math.abs(this.motor.position.x) < 0.9 && this.motor.position.z < -HALF_D + 1.1;
  }

  private pressAction(): boolean {
    if (this.transitioning || !this.atDoor()) return false;
    this.transitioning = true;
    const data: RegionTransitionData = {
      toAnchor: { x: this.returnAnchor.x, z: this.returnAnchor.z },
      facing: this.returnAnchor.facing,
      cameraContext: 'farm',
      clockMinutes: this.clockMinutes,
      npcToken: this.npcToken,
    };
    void this.ctx.manager.goTo('BreakpointFarm', data);
    return true;
  }

  /** Void test (WEF-05): hiding the near wall still hits backing, never the sky. */
  private seesBackingThroughNearWall(): boolean {
    if (this.room.wallMeshes.length === 0) return false;
    const camPos = this.rig.camera.position;
    let near: Mesh | null = null;
    let bestD = Infinity;
    for (const w of this.room.wallMeshes) {
      const d = Vector3.Distance(camPos, w.getAbsolutePosition());
      if (d < bestD) { bestD = d; near = w; }
    }
    if (!near) return false;
    const was = near.isVisible;
    near.isVisible = false;
    const target = new Vector3(this.room.center.x, this.room.center.y + 0.6, this.room.center.z);
    const dir = target.subtract(camPos).normalize();
    const ray = new Ray(camPos, dir, Vector3.Distance(camPos, target) + 6);
    const set = new Set<AbstractMesh>(this.room.meshes);
    const pick = this.scene.pickWithRay(ray, (m) => set.has(m) && m !== near);
    near.isVisible = was;
    return Boolean(pick?.hit);
  }

  private installDebugApi(): void {
    const api = {
      region: (): string => 'farmhouse-interior',
      meshCount: (): number => this.scene.meshes.length,
      roomConformant: (): { ok: boolean; issues: string[] } => {
        const issues = validateRoomSpec(FARMHOUSE_SPEC);
        return { ok: issues.length === 0, issues: issues.map((i) => i.code) };
      },
      interactionAnchors: (): string[] => this.room.interactionAnchors.map((a) => a.id),
      player: (): { x: number; z: number; facing: number } => ({ x: this.motor.position.x, z: this.motor.position.z, facing: this.motor.facing }),
      setPlayer: (x: number, z: number, facing?: number): void => {
        this.motor = createMotorState({ x, y: PLAYER_HEIGHT / 2, z }, facing ?? this.motor.facing);
        this.motor.grounded = true;
        this.syncPlayer();
      },
      setMove: (x: number, z: number): void => { this.moveX = x; this.moveZ = z; },
      cameraState: (): CameraRigState => this.rig.getState(),
      activeVolumeId: (): string | null => this.rig.getState().activeVolumeId,
      seesBackingThroughNearWall: (): boolean => this.seesBackingThroughNearWall(),
      atDoor: (): boolean => this.atDoor(),
      pressAction: (): boolean => this.pressAction(),
      clockMinutes: (): number => this.clockMinutes,
      npcToken: (): string => this.npcToken,
      returnAnchor: (): { x: number; z: number; facing: number } => ({ ...this.returnAnchor }),
      tick: (n = 1): void => {
        for (let i = 0; i < n; i++) {
          this.step(FIXED_DT);
          this.rig.update(FIXED_DT, ZERO_INPUT);
        }
      },
    };
    (window as unknown as { sturdyVolleyFarmhouse?: typeof api }).sturdyVolleyFarmhouse = api;
  }
}
