import {
  Scene,
  Matrix,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  TransformNode,
  Vector3,
  Color3,
  type AbstractMesh,
  type Mesh,
} from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, PALETTE } from '../render/scene-helpers';
import { CameraRig, type FollowTarget, type ObstructionMode } from '../camera/rig';
import {
  beginTraversal,
  createMotorState,
  groundedPoseAt,
  stepMotor,
  DEFAULT_MOTOR_CONFIG,
  NO_WALL,
  NO_CEILING,
  NO_GROUND,
  type GroundHit,
  type MotorEnvironment,
  type MotorState,
} from '../engine/motor';
import { createControllerState, stepController, type ControllerState } from '../engine/controller';
import {
  resolveTarget,
  beginAction,
  stepAction,
  canCancel,
  cancelAction,
  faceTarget,
  headingTo,
  IDLE_ACTION,
  type ActionState,
  type TargetCandidate,
} from '../engine/interaction-targeting';
import { initHavok, enableScenePhysics } from '../physics/havok';
import {
  HavokMotorPhysics,
  RaypickMotorPhysics,
  type MotorPhysics,
} from '../physics/motor-physics';
import {
  baselineProfile,
  CAMERA_BASELINES,
  CAMERA_CONTEXTS,
  variantsForContext,
  type CameraContextId,
  type CameraProfile,
} from '../camera/profiles';
import { CameraInputController, mergeInput, ZERO_INPUT, type CameraInput } from '../camera/input';
import type { CameraVolume } from '../camera/volumes';
import type { Planar } from '../camera/orbit';

/**
 * Camera proving ground (WEF-01a/01b, master Prompts 028–029).
 *
 * A single scene holding the full camera/motor test-geometry kit at true meter
 * scale (1 unit = 1 m, per docs/SCALE_AND_PERFORMANCE.md). It is the fixed stage
 * the data-driven camera profiles (Prompt 029) and the kinematic motor
 * (Prompt 031+) are tuned against, so every camera context — exterior, farm,
 * interiors, lane, cave, water, slopes — has a representative obstruction to
 * frame. Reachable via the Title "Dev · Camera Lab" item (dev builds) or the
 * `?scene=CameraLab` direct-boot route (works in the production preview build).
 *
 * Prompt 029 wires the data-driven CameraRig here: a camera-relative movable
 * reference player drives look-ahead, manual orbit comes from mouse/touch drag +
 * the controller right-stick, and number keys + `[`/`]` switch context/variant
 * live (≥3 variants per §2 context). A few demo camera volumes auto-swap the
 * profile when the player walks into the interior / water / cave stations.
 */

/** One labelled station in the kit. Stations are spaced on a grid so each
 *  obstruction can be framed in isolation by the future camera profiles. */
interface KitStation {
  id: string;
  label: string;
  /** Ground-plane centre of the station, in metres. */
  at: Vector3;
}

const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.4;
const WALL_HEIGHT = 3.4; // mid-band of the 3.0–4.0 m wall convention
const DOOR_W = 1.2; // ≥ 1.0 m
const DOOR_H = 1.9; // ≥ 1.8 m

const GROUND_HALF = 38;
const SPAWN = new Vector3(0, PLAYER_HEIGHT / 2, 0);

export class CameraLabScene extends GameScene {
  private readonly stations: KitStation[] = [];
  private rig!: CameraRig;
  private input: CameraInputController | null = null;
  private playerMesh!: Mesh;
  private groundMesh!: Mesh;
  private playerVel: Planar = { x: 0, z: 0 };
  private contextIndex = 0; // exterior
  private variantIndex = 1; // 'standard'
  private readonly held = new Set<string>();
  private injected: CameraInput = { ...ZERO_INPUT };
  private onKeyDown!: (e: KeyboardEvent) => void;
  private onKeyUp!: (e: KeyboardEvent) => void;

  // Motor (031): pure capsule motor core + the existing locomotion controller
  // (stamina/gait), grounded through a swappable physics backend (Havok primary,
  // ray-pick fallback). The proxy planar driver from 029 is gone.
  private motorState: MotorState = createMotorState(SPAWN);
  private controllerState: ControllerState = createControllerState();
  private physics!: MotorPhysics;
  private lastMoveDir: Planar = { x: 0, z: 1 };
  private groundBody: PhysicsAggregate | null = null;
  private readonly colliderBodies: PhysicsAggregate[] = [];
  private disposed = false;

  // Moving-platform demo (032): a low slab oscillating along X. Detected
  // geometrically (backend-independent) so the contact contract works on Havok
  // and ray-pick alike.
  private platformMesh: Mesh | null = null;
  private readonly platform = { cx: 12, cz: -16, hx: 2, hz: 1.5, topY: 0.3, amp: 4, vel: 0, t: 0 };

  // Water + traversal (033). Wade pool (the shallow-water station) + a deep swim
  // pool, plus one authored climb link onto a ledge (no free jump).
  private readonly waters = [
    { cx: 22, cz: 12, hx: 3.5, hz: 3.5, surfaceY: 0.3, bedY: -0.1 }, // wade (shallow station)
    { cx: -16, cz: -10, hx: 3.5, hz: 3.5, surfaceY: 0.5, bedY: -2.4 }, // deep swim pool
  ];
  private readonly climbLink = { x: 16, z: -12.2, range: 1.9, to: { x: 16, y: 2 + PLAYER_HEIGHT / 2, z: -9.5 }, duration: 0.8 };

  // Interaction targeting (034): one-button resolver over kit candidates, a
  // visible focus ring, and the anticipation→impact→recovery action lifecycle.
  private static readonly TOOL_CYCLE: (string | undefined)[] = [undefined, 'hoe', 'pick', 'watering-can'];
  private heldToolIndex = 0;
  private chosenTargetId: string | null = null;
  private action: ActionState = { ...IDLE_ACTION };
  private lastImpactId: string | null = null;
  private focusRing: Mesh | null = null;

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    this.scene = scene; // station()/box() build against this.scene below
    addFog(scene, PALETTE.fog, 0.012);
    addLights(scene);

    // Reference ground — 80 m across so every station sits on solid floor.
    const ground = MeshBuilder.CreateGround('lab-ground', { width: 80, height: 80 }, scene);
    ground.material = flatMaterial(scene, 'lab-ground', PALETTE.grass, 0.22);
    this.groundMesh = ground;

    this.buildKit(scene);

    // Moving-platform demo slab (032).
    const plat = MeshBuilder.CreateBox('lab-platform', { width: this.platform.hx * 2, height: this.platform.topY, depth: this.platform.hz * 2 }, scene);
    plat.position.set(this.platform.cx, this.platform.topY / 2, this.platform.cz);
    plat.material = flatMaterial(scene, 'lab-platform', PALETTE.accent, 0.35);
    plat.isPickable = false; // grounded geometrically, not by raycast
    this.platformMesh = plat;

    this.buildWaterAndLinks(scene);

    // Interaction focus ring (034): a ground preview that snaps to the chosen
    // target, hidden when nothing is in reach.
    const ring = MeshBuilder.CreateTorus('lab-focus-ring', { diameter: 1.1, thickness: 0.12, tessellation: 16 }, scene);
    ring.material = flatMaterial(scene, 'lab-focus-ring', PALETTE.warmLight, 0.7);
    ring.isPickable = false;
    ring.visibility = 0;
    this.focusRing = ring;

    // Data-driven camera rig (029), framing the movable reference player. The
    // locked exterior baseline (030) is the starting profile.
    this.rig = new CameraRig(scene, baselineProfile('exterior'), -Math.PI / 2);
    const follow: FollowTarget = {
      position: () => new Vector3(this.playerMesh.position.x, this.playerMesh.position.y + 0.6, this.playerMesh.position.z),
      velocity: () => this.playerVel,
      ignore: (): readonly AbstractMesh[] => [this.playerMesh],
    };
    this.rig.setTarget(follow);
    this.rig.setVolumes(this.demoVolumes());

    return scene;
  }

  override enter(): void {
    const canvas = this.ctx.engine.getRenderingCanvas();
    if (canvas) this.input = new CameraInputController(canvas);

    // Camera-relative WASD/arrow driver for the reference player + the
    // number-key context / `[` `]` variant switches.
    this.onKeyDown = (e) => {
      this.held.add(e.key.toLowerCase());
      this.handleSwitchKey(e.key);
    };
    this.onKeyUp = (e) => this.held.delete(e.key.toLowerCase());
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Motor physics: ray-pick works immediately; upgrade to Havok when (if) the
    // WASM loads. Either backend grounds the same pure motor core.
    this.physics = new RaypickMotorPhysics(this.scene, () => [this.playerMesh]);
    void this.initPhysics();

    this.installDebugApi();
  }

  private async initPhysics(): Promise<void> {
    const plugin = await initHavok();
    if (!plugin || this.disposed) return;
    enableScenePhysics(this.scene, plugin);
    // Ground plane (MESH) + static box colliders on the standable/obstacle kit
    // meshes so the Havok wall/step/ground rays hit terrain (032). Decorative +
    // flat tile meshes are skipped to keep the collider count modest.
    this.groundBody = new PhysicsAggregate(this.groundMesh, PhysicsShapeType.MESH, { mass: 0 }, this.scene);
    for (const m of this.scene.meshes) {
      if (m.getClassName() !== 'Mesh') continue;
      if (!isColliderMesh(m.name)) continue;
      this.colliderBodies.push(new PhysicsAggregate(m as Mesh, PhysicsShapeType.BOX, { mass: 0 }, this.scene));
    }
    this.physics = new HavokMotorPhysics(this.scene);
  }

  override update(dt: number): void {
    if (dt <= 0) return;
    this.stepMotorFrame(dt);
    this.stepInteraction(dt);
    const camInput = this.input ? this.input.consume(dt) : { ...ZERO_INPUT };
    const merged = mergeInput(camInput, this.drainInjected());
    this.rig.update(dt, merged);
  }

  override dispose(): void {
    this.disposed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.input?.dispose();
    this.physics?.dispose();
    this.groundBody?.dispose();
    for (const b of this.colliderBodies) b.dispose();
    this.rig?.dispose();
    delete (window as unknown as { sturdyVolleyLab?: unknown }).sturdyVolleyLab;
    super.dispose();
  }

  // --- Camera profile / switching ------------------------------------------
  private currentProfile(): CameraProfile {
    const ctx = CAMERA_CONTEXTS[this.contextIndex];
    const variants = variantsForContext(ctx);
    return variants[Math.min(this.variantIndex, variants.length - 1)];
  }

  private applyProfile(): void {
    this.rig.setProfile(this.currentProfile());
  }

  private setContext(id: CameraContextId): void {
    const idx = CAMERA_CONTEXTS.indexOf(id);
    if (idx < 0) return;
    this.contextIndex = idx;
    this.applyProfile();
  }

  private cycleVariant(): string {
    const variants = variantsForContext(CAMERA_CONTEXTS[this.contextIndex]);
    this.variantIndex = (this.variantIndex + 1) % variants.length;
    this.applyProfile();
    return this.currentProfile().id;
  }

  private reducedMotion = false;
  private obstructionMode: ObstructionMode = 'fade';

  private handleSwitchKey(key: string): void {
    const n = Number(key);
    if (n >= 1 && n <= CAMERA_CONTEXTS.length) {
      this.contextIndex = n - 1;
      this.applyProfile();
    } else if (key === '[' || key === ']') {
      this.cycleVariant();
    } else if (key === 'm' || key === 'M') {
      this.reducedMotion = !this.reducedMotion;
      this.rig.setReducedMotion(this.reducedMotion);
    } else if (key === 'c' || key === 'C') {
      this.obstructionMode = this.obstructionMode === 'fade' ? 'cutaway' : 'fade';
      this.rig.setObstructionMode(this.obstructionMode);
    } else if (key === 'e' || key === 'E') {
      this.tryTraversal(); // contextual climb link (no free jump)
    } else if (key === 'f' || key === 'F') {
      this.commitAction(); // one-button interact
    } else if (key === 'x' || key === 'X') {
      this.cancelCurrentAction();
    } else if (key === 't' || key === 'T') {
      this.heldToolIndex = (this.heldToolIndex + 1) % CameraLabScene.TOOL_CYCLE.length;
    }
  }

  // --- Kinematic motor step (camera-relative) -------------------------------
  private stepMotorFrame(dt: number): void {
    const fwd = (this.held.has('w') || this.held.has('arrowup') ? 1 : 0) - (this.held.has('s') || this.held.has('arrowdown') ? 1 : 0);
    const str = (this.held.has('d') || this.held.has('arrowright') ? 1 : 0) - (this.held.has('a') || this.held.has('arrowleft') ? 1 : 0);
    const sprint = this.held.has('shift');

    // Camera-relative move direction (normalised) from the held keys.
    let mx = 0;
    let mz = 0;
    if (fwd !== 0 || str !== 0) {
      const alpha = this.rig.camera.alpha;
      const forward: Planar = { x: -Math.cos(alpha), z: -Math.sin(alpha) };
      const right: Planar = { x: -Math.sin(alpha), z: Math.cos(alpha) };
      mx = right.x * str + forward.x * fwd;
      mz = right.z * str + forward.z * fwd;
      const len = Math.hypot(mx, mz) || 1;
      mx /= len;
      mz /= len;
      this.lastMoveDir = { x: mx, z: mz };
    }

    this.advancePlatform(dt);

    // Stamina/gait + accel/brake speed from the existing controller.
    this.controllerState = stepController(this.controllerState, { dir: { x: mx, z: mz }, sprint }, dt);
    const speed = this.controllerState.speed;
    // Keep gliding along the last heading while braking to a stop.
    const dir = speed > 0.01 ? this.lastMoveDir : { x: 0, z: 0 };

    // Assemble the full terrain environment (ground + wall + step + ceiling),
    // then advance the pure motor core.
    const env = this.buildEnvironment(dir, speed * dt);
    this.motorState = stepMotor(this.motorState, { moveDir: dir, speed }, env, dt);

    // Keep the player on the lab footprint.
    this.motorState.position.x = clampGround(this.motorState.position.x);
    this.motorState.position.z = clampGround(this.motorState.position.z);

    this.playerMesh.position.set(this.motorState.position.x, this.motorState.position.y, this.motorState.position.z);
    this.playerMesh.rotation.y = this.motorState.facing;
    this.playerVel = { x: dir.x * speed, z: dir.z * speed };
  }

  private placePlayer(x: number, z: number): void {
    this.motorState = createMotorState({ x: clampGround(x), y: PLAYER_HEIGHT / 2, z: clampGround(z) }, this.motorState.facing);
    this.controllerState = createControllerState();
    this.playerVel = { x: 0, z: 0 };
    this.playerMesh.position.set(this.motorState.position.x, this.motorState.position.y, this.motorState.position.z);
  }

  private heldTool(): string | undefined {
    return CameraLabScene.TOOL_CYCLE[this.heldToolIndex];
  }

  /** Interaction candidates drawn from the kit stations (034). */
  private interactionCandidates(): TargetCandidate[] {
    return [
      { id: 'crate', kind: 'prop', position: { x: 10, y: 0.5, z: 28 }, priority: 1, reach: 2.5 },
      { id: 'door', kind: 'door', position: { x: -28, y: 1, z: 28 }, priority: 2, reach: 2.5 },
      { id: 'npc', kind: 'npc', position: { x: -14, y: 1, z: 28 }, priority: 2, reach: 2.5 },
      { id: 'animal', kind: 'animal', position: { x: -2, y: 0.5, z: 28 }, priority: 2, reach: 2.5 },
      { id: 'soil', kind: 'farm-cell', position: { x: -10, y: 0, z: -24 }, priority: 1, reach: 2.5, requiresTool: 'hoe', cell: { col: 0, row: 0 } },
      { id: 'ore', kind: 'ore-node', position: { x: 4, y: 1, z: 12 }, priority: 1, reach: 2.5, requiresTool: 'pick' },
      { id: 'water', kind: 'water-entry', position: { x: 22, y: 0, z: 12 }, priority: 1, reach: 3 },
      { id: 'climb', kind: 'climb', position: { x: 16, y: 0, z: -12.2 }, priority: 1, reach: 2.5 },
    ];
  }

  /** Resolve the focus target + advance the action lifecycle (034). */
  private stepInteraction(dt: number): void {
    const ctx = { position: this.motorState.position, facing: this.motorState.facing, heldTool: this.heldTool() };
    const cands = this.interactionCandidates();
    const res = resolveTarget(cands, ctx, this.chosenTargetId);
    this.chosenTargetId = res.chosenId;

    const chosen = res.chosenId ? cands.find((c) => c.id === res.chosenId) : undefined;
    if (this.focusRing) {
      if (chosen) {
        this.focusRing.visibility = 1;
        this.focusRing.position.set(chosen.position.x, 0.06, chosen.position.z);
      } else {
        this.focusRing.visibility = 0;
      }
    }

    if (this.action.phase !== 'idle') {
      const target = cands.find((c) => c.id === this.action.targetId);
      if (target) {
        this.motorState.facing = faceTarget(this.motorState.facing, headingTo(ctx.position, target.position), 14, dt);
        this.playerMesh.rotation.y = this.motorState.facing;
      }
      const targetId = this.action.targetId;
      const r = stepAction(this.action, dt);
      this.action = r.state;
      if (r.impactFired) this.lastImpactId = targetId;
    }
  }

  private commitAction(): boolean {
    if (this.action.phase !== 'idle' || !this.chosenTargetId) return false;
    this.action = beginAction(this.chosenTargetId);
    return true;
  }

  private cancelCurrentAction(): boolean {
    if (!canCancel(this.action)) return false;
    this.action = cancelAction();
    return true;
  }

  /** Oscillate the demo platform along X and record its velocity. */
  private advancePlatform(dt: number): void {
    if (!this.platformMesh) return;
    const p = this.platform;
    p.t += dt;
    const prevX = p.cx;
    p.cx = 12 + Math.sin(p.t * 0.6) * p.amp;
    p.vel = dt > 0 ? (p.cx - prevX) / dt : 0;
    this.platformMesh.position.x = p.cx;
  }

  /** Deep swim pool geometry + the climb-link ledge (033). */
  private buildWaterAndLinks(scene: Scene): void {
    // Deep swim pool: a sunken bed + translucent surface (the second water vol).
    const pool = this.waters[1];
    const poolBed = MeshBuilder.CreateBox('lab-swim-bed', { width: pool.hx * 2, height: 0.3, depth: pool.hz * 2 }, scene);
    poolBed.position.set(pool.cx, pool.bedY, pool.cz);
    poolBed.material = flatMaterial(scene, 'lab-swim-bed', PALETTE.cliff, 0.16);
    poolBed.isPickable = false; // grounded via the water model
    const poolWater = MeshBuilder.CreateBox('lab-swim-water', { width: pool.hx * 2, height: pool.surfaceY - pool.bedY, depth: pool.hz * 2 }, scene);
    poolWater.position.set(pool.cx, (pool.surfaceY + pool.bedY) / 2, pool.cz);
    poolWater.material = flatMaterial(scene, 'lab-swim-water', PALETTE.sea, 0.4);
    poolWater.visibility = 0.5;
    poolWater.isPickable = false;

    // Climb-link ledge: a 2 m wall too tall to step, climbed via the link.
    const ledge = MeshBuilder.CreateBox('lab-climb-ledge', { width: 4, height: 2, depth: 3 }, scene);
    ledge.position.set(this.climbLink.x, 1, -10);
    ledge.material = flatMaterial(scene, 'lab-climb-ledge', PALETTE.quarry, 0.16);
  }

  /** Water column at (x,z) if over a water volume (highest surface wins). */
  private waterAt(x: number, z: number): { surfaceY: number; bedY: number } | undefined {
    let best: { surfaceY: number; bedY: number } | undefined;
    for (const w of this.waters) {
      if (x >= w.cx - w.hx && x <= w.cx + w.hx && z >= w.cz - w.hz && z <= w.cz + w.hz) {
        if (!best || w.surfaceY > best.surfaceY) best = { surfaceY: w.surfaceY, bedY: w.bedY };
      }
    }
    return best;
  }

  /** Begin the climb traversal if the player is within range of the link. */
  private tryTraversal(): boolean {
    if (this.motorState.traversal) return false;
    const p = this.motorState.position;
    const d = Math.hypot(p.x - this.climbLink.x, p.z - this.climbLink.z);
    if (d > this.climbLink.range) return false;
    this.motorState = beginTraversal(this.motorState, this.climbLink.to, 'climb', this.climbLink.duration, true);
    return true;
  }

  /** Assemble the ground/wall/step/ceiling probes the motor core consumes. */
  private buildEnvironment(moveDir: Planar, mag: number): MotorEnvironment {
    const cfg = DEFAULT_MOTOR_CONFIG;
    const half = cfg.capsuleHeight / 2;
    const r = cfg.capsuleRadius;
    const pos = this.motorState.position;
    const feetY = pos.y - half;

    // Ground straight down (with the moving-platform override).
    const ground = this.platformGround(
      this.physics.groundProbe(pos.x, pos.y, pos.z, cfg.capsuleHeight + 1),
      pos,
    );

    // Wall in the move direction, cast above the step height so low steps are
    // not seen as walls; plus the step-ground probe just beyond it.
    let wall = NO_WALL;
    let stepGround: GroundHit = NO_GROUND;
    if (mag > 1e-4) {
      const wallFromY = feetY + cfg.stepOffset + 0.1;
      const wallLen = r + mag + cfg.skinOffset + 0.05;
      const wr = this.physics.raycast({ x: pos.x, y: wallFromY, z: pos.z }, { x: moveDir.x, y: 0, z: moveDir.z }, wallLen);
      if (wr.hit) {
        wall = { hit: true, distance: wr.distance - r, normal: wr.normal };
        const ahead = r + 0.15;
        const sx = pos.x + moveDir.x * ahead;
        const sz = pos.z + moveDir.z * ahead;
        const sr = this.physics.raycast({ x: sx, y: feetY + cfg.stepOffset + 0.3, z: sz }, { x: 0, y: -1, z: 0 }, cfg.stepOffset + 0.5);
        if (sr.hit) stepGround = { hit: true, groundY: sr.point.y, normal: sr.normal };
      }
    }

    // Ceiling above the head.
    let ceiling = NO_CEILING;
    const cr = this.physics.raycast({ x: pos.x, y: pos.y + half - 0.05, z: pos.z }, { x: 0, y: 1, z: 0 }, cfg.stepOffset + 0.4);
    if (cr.hit) ceiling = { hit: true, ceilingY: cr.point.y };

    return { ground, wall, stepGround, ceiling, water: this.waterAt(pos.x, pos.z) };
  }

  /** Override the ground hit with the moving platform when the player is over it. */
  private platformGround(ground: GroundHit, pos: { x: number; y: number; z: number }): GroundHit {
    const p = this.platform;
    const half = DEFAULT_MOTOR_CONFIG.capsuleHeight / 2;
    const feetY = pos.y - half;
    if (
      pos.x >= p.cx - p.hx &&
      pos.x <= p.cx + p.hx &&
      pos.z >= p.cz - p.hz &&
      pos.z <= p.cz + p.hz &&
      feetY <= p.topY + 0.5 &&
      feetY >= p.topY - 0.6
    ) {
      return { hit: true, groundY: p.topY, normal: { x: 0, y: 1, z: 0 }, platformVel: { x: p.vel, z: 0 } };
    }
    return ground;
  }

  private drainInjected(): CameraInput {
    const out = this.injected;
    this.injected = { ...ZERO_INPUT };
    return out;
  }

  /** A handful of authored volumes proving the volume override (full kit: 036). */
  private demoVolumes(): CameraVolume[] {
    return [
      vol('v-small-room', 26, -24, 2.5, 2, 'smallInterior:standard', 10, 30),
      vol('v-large-room', -28, -6, 6, 4.5, 'largeInterior:standard', 10, 60),
      vol('v-water', 22, 12, 4, 4, 'water:standard', 5),
      vol('v-cave', 26, 28, 2, 4, 'cave:standard', 10, 45),
    ];
  }

  /** Builds every kit station as a parented group with a stable id. */
  private buildKit(scene: Scene): void {
    // Reference player capsule at origin so each obstruction is sized against it.
    this.player(scene, new Vector3(0, 0, 0));

    this.openGround(scene, this.station('open-ground', 'Open ground', -28, -24));
    this.farmGrid(scene, this.station('farm-grid', 'Farm grid (1 m cells)', -10, -24));
    this.narrowLane(scene, this.station('narrow-lane', 'Narrow lane', 8, -24));
    this.smallRoom(scene, this.station('small-room', 'Small room', 26, -24));

    this.largeRoom(scene, this.station('large-room', 'Large room', -28, -6));
    this.roof(scene, this.station('roof', 'Roof', -10, -6));
    this.treeCanopy(scene, this.station('tree-canopy', 'Tree canopy', 8, -6));
    this.wallCorner(scene, this.station('wall-corner', 'Wall corner', 26, -6));

    this.slope(scene, this.station('slope', 'Slope', -28, 12));
    this.stairs(scene, this.station('stairs', 'Stairs', -12, 12));
    this.cliff(scene, this.station('cliff', 'Cliff', 4, 12));
    this.shallowWater(scene, this.station('shallow-water', 'Shallow water', 22, 12));

    this.doorway(scene, this.station('doorway', 'Doorway', -28, 28));
    this.npcCapsule(scene, this.station('npc-capsule', 'NPC capsule', -14, 28));
    this.animalBody(scene, this.station('animal-body', 'Animal body', -2, 28));
    this.interactionProp(scene, this.station('interaction-prop', 'Interaction prop', 10, 28));
    this.caveCorridor(scene, this.station('cave-corridor', 'Cave corridor', 26, 28));
  }

  private station(id: string, label: string, x: number, z: number): TransformNode {
    const node = new TransformNode(`lab-${id}`, this.scene);
    node.position.set(x, 0, z);
    this.stations.push({ id, label, at: new Vector3(x, 0, z) });
    return node;
  }

  private box(
    scene: Scene,
    parent: TransformNode,
    name: string,
    size: { w: number; h: number; d: number },
    pos: Vector3,
    color: Color3,
    emissive = 0.22,
  ): Mesh {
    const m = MeshBuilder.CreateBox(name, { width: size.w, height: size.h, depth: size.d }, scene);
    m.material = flatMaterial(scene, name, color, emissive);
    m.parent = parent;
    m.position.copyFrom(pos);
    return m;
  }

  // --- Reference player -----------------------------------------------------
  private player(scene: Scene, at: Vector3): void {
    const cap = MeshBuilder.CreateCapsule('lab-player', { height: PLAYER_HEIGHT, radius: PLAYER_RADIUS }, scene);
    cap.position.set(at.x, PLAYER_HEIGHT / 2, at.z);
    cap.material = flatMaterial(scene, 'lab-player', PALETTE.player, 0.35);
    cap.isPickable = false; // never an occluder for its own camera
    this.playerMesh = cap;
  }

  // --- Kit stations ---------------------------------------------------------
  private openGround(scene: Scene, p: TransformNode): void {
    // A bare reference cube (1 m) for scale calibration on open terrain.
    this.box(scene, p, 'lab-open-ref', { w: 1, h: 1, d: 1 }, new Vector3(0, 0.5, 0), PALETTE.accent, 0.4);
  }

  private farmGrid(scene: Scene, p: TransformNode): void {
    // 6×6 of 1 m tilled cells, 0.12 m proud of the ground.
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const tile = this.box(
          scene,
          p,
          `lab-cell-${r}-${c}`,
          { w: 0.94, h: 0.12, d: 0.94 },
          new Vector3((c - 2.5) * 1, 0.06, (r - 2.5) * 1),
          (r + c) % 2 === 0 ? PALETTE.soil : PALETTE.grassAlt,
          0.2,
        );
        tile.metadata = { kit: 'farm-grid' };
      }
    }
  }

  private narrowLane(scene: Scene, p: TransformNode): void {
    // Two parallel 3.4 m walls 2 m apart — a corridor the camera must keep legible.
    this.box(scene, p, 'lab-lane-l', { w: 0.4, h: WALL_HEIGHT, d: 10 }, new Vector3(-1.2, WALL_HEIGHT / 2, 0), PALETTE.wood);
    this.box(scene, p, 'lab-lane-r', { w: 0.4, h: WALL_HEIGHT, d: 10 }, new Vector3(1.2, WALL_HEIGHT / 2, 0), PALETTE.wood);
  }

  private smallRoom(scene: Scene, p: TransformNode): void {
    this.enclosure(scene, p, 'small', 5, 4, WALL_HEIGHT);
  }

  private largeRoom(scene: Scene, p: TransformNode): void {
    this.enclosure(scene, p, 'large', 12, 9, WALL_HEIGHT + 0.4);
  }

  /** Four walls + ceiling with a doorway gap on the +Z side. */
  private enclosure(scene: Scene, p: TransformNode, tag: string, w: number, d: number, h: number): void {
    const t = 0.3;
    this.box(scene, p, `lab-${tag}-back`, { w, h, d: t }, new Vector3(0, h / 2, -d / 2), PALETTE.stone, 0.18);
    this.box(scene, p, `lab-${tag}-left`, { w: t, h, d }, new Vector3(-w / 2, h / 2, 0), PALETTE.stone, 0.18);
    this.box(scene, p, `lab-${tag}-right`, { w: t, h, d }, new Vector3(w / 2, h / 2, 0), PALETTE.stone, 0.18);
    // Front wall split around a doorway.
    const side = (w - DOOR_W) / 2;
    this.box(scene, p, `lab-${tag}-front-l`, { w: side, h, d: t }, new Vector3(-(DOOR_W / 2 + side / 2), h / 2, d / 2), PALETTE.stone, 0.18);
    this.box(scene, p, `lab-${tag}-front-r`, { w: side, h, d: t }, new Vector3(DOOR_W / 2 + side / 2, h / 2, d / 2), PALETTE.stone, 0.18);
    this.box(scene, p, `lab-${tag}-lintel`, { w: DOOR_W, h: h - DOOR_H, d: t }, new Vector3(0, DOOR_H + (h - DOOR_H) / 2, d / 2), PALETTE.stone, 0.18);
    this.box(scene, p, `lab-${tag}-ceil`, { w, h: t, d }, new Vector3(0, h, 0), PALETTE.interior, 0.16);
  }

  private roof(scene: Scene, p: TransformNode): void {
    // A pitched roof — the camera must fade/cut when the player passes beneath.
    this.box(scene, p, 'lab-roof-wall', { w: 5, h: WALL_HEIGHT, d: 5 }, new Vector3(0, WALL_HEIGHT / 2, 0), PALETTE.wood, 0.2);
    const roof = MeshBuilder.CreateCylinder('lab-roof', { height: 5.6, diameterTop: 0, diameterBottom: 4.6, tessellation: 4 }, scene);
    roof.rotation.x = Math.PI / 2;
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, WALL_HEIGHT + 1.2, 0);
    roof.material = flatMaterial(scene, 'lab-roof-mat', PALETTE.roof, 0.22);
    roof.parent = p;
  }

  private treeCanopy(scene: Scene, p: TransformNode): void {
    const trunk = MeshBuilder.CreateCylinder('lab-trunk', { height: 4, diameter: 0.6 }, scene);
    trunk.position.set(0, 2, 0);
    trunk.material = flatMaterial(scene, 'lab-trunk-mat', PALETTE.wood, 0.2);
    trunk.parent = p;
    const canopy = MeshBuilder.CreateSphere('lab-canopy', { diameter: 5, segments: 6 }, scene);
    canopy.position.set(0, 5, 0);
    canopy.scaling.y = 0.7;
    canopy.material = flatMaterial(scene, 'lab-canopy-mat', PALETTE.grass, 0.18);
    canopy.parent = p;
  }

  private wallCorner(scene: Scene, p: TransformNode): void {
    this.box(scene, p, 'lab-corner-a', { w: 6, h: WALL_HEIGHT, d: 0.4 }, new Vector3(0, WALL_HEIGHT / 2, -3), PALETTE.cliff, 0.16);
    this.box(scene, p, 'lab-corner-b', { w: 0.4, h: WALL_HEIGHT, d: 6 }, new Vector3(-3, WALL_HEIGHT / 2, 0), PALETTE.cliff, 0.16);
  }

  private slope(scene: Scene, p: TransformNode): void {
    // ~22° ramp, 8 m run, 1 m tall stop block at the top.
    const ramp = this.box(scene, p, 'lab-ramp', { w: 4, h: 0.3, d: 8 }, new Vector3(0, 1.6, 0), PALETTE.cliff, 0.16);
    ramp.rotation.x = -Math.atan2(3.2, 8);
    this.box(scene, p, 'lab-ramp-top', { w: 4, h: 1, d: 1 }, new Vector3(0, 3.7, 4.2), PALETTE.stone, 0.18);
  }

  private stairs(scene: Scene, p: TransformNode): void {
    // Eight 0.2 m steps — step-offset proving for the motor.
    for (let i = 0; i < 8; i++) {
      this.box(
        scene,
        p,
        `lab-step-${i}`,
        { w: 3, h: 0.2 * (i + 1), d: 0.6 },
        new Vector3(0, 0.1 * (i + 1), i * 0.6 - 2),
        PALETTE.stone,
        0.18,
      );
    }
  }

  private cliff(scene: Scene, p: TransformNode): void {
    // A 4 m drop edge — a fall hazard the camera must keep the horizon stable over.
    this.box(scene, p, 'lab-cliff-top', { w: 8, h: 4, d: 6 }, new Vector3(0, 2, -3), PALETTE.cliff, 0.16);
    this.box(scene, p, 'lab-cliff-low', { w: 8, h: 0.3, d: 6 }, new Vector3(0, 0.15, 4), PALETTE.sand, 0.2);
  }

  private shallowWater(scene: Scene, p: TransformNode): void {
    this.box(scene, p, 'lab-wade-bed', { w: 8, h: 0.2, d: 8 }, new Vector3(0, -0.2, 0), PALETTE.sand, 0.2);
    const water = this.box(scene, p, 'lab-water', { w: 8, h: 0.5, d: 8 }, new Vector3(0, 0.05, 0), PALETTE.sea, 0.4);
    water.visibility = 0.6;
    water.isPickable = false; // wade on the bed, not the surface (water motor is 033)
  }

  private doorway(scene: Scene, p: TransformNode): void {
    // A free-standing doorway frame at the ≥1.0 m × ≥1.8 m clearance minimum.
    const side = 0.3;
    this.box(scene, p, 'lab-door-l', { w: side, h: DOOR_H, d: 0.4 }, new Vector3(-(DOOR_W / 2 + side / 2), DOOR_H / 2, 0), PALETTE.wood);
    this.box(scene, p, 'lab-door-r', { w: side, h: DOOR_H, d: 0.4 }, new Vector3(DOOR_W / 2 + side / 2, DOOR_H / 2, 0), PALETTE.wood);
    this.box(scene, p, 'lab-door-top', { w: DOOR_W + side * 2, h: 0.3, d: 0.4 }, new Vector3(0, DOOR_H + 0.15, 0), PALETTE.wood);
  }

  private npcCapsule(scene: Scene, p: TransformNode): void {
    const cap = MeshBuilder.CreateCapsule('lab-npc', { height: PLAYER_HEIGHT, radius: PLAYER_RADIUS }, scene);
    cap.position.set(0, PLAYER_HEIGHT / 2, 0);
    cap.material = flatMaterial(scene, 'lab-npc-mat', PALETTE.accent, 0.3);
    cap.parent = p;
    const head = MeshBuilder.CreateSphere('lab-npc-head', { diameter: 0.5, segments: 6 }, scene);
    head.position.set(0, PLAYER_HEIGHT - 0.1, 0);
    head.material = flatMaterial(scene, 'lab-npc-head-mat', PALETTE.warmLight, 0.25);
    head.parent = p;
  }

  private animalBody(scene: Scene, p: TransformNode): void {
    // ~0.9 m grazing-livestock body proxy (goat/sheep scale).
    const body = MeshBuilder.CreateCapsule('lab-animal', { height: 1.1, radius: 0.35, orientation: Vector3.Right() }, scene);
    body.position.set(0, 0.55, 0);
    body.material = flatMaterial(scene, 'lab-animal-mat', PALETTE.wood, 0.25);
    body.parent = p;
    [
      [-0.4, 0.3],
      [0.4, 0.3],
      [-0.4, -0.3],
      [0.4, -0.3],
    ].forEach(([x, z], i) => {
      const leg = this.box(scene, p, `lab-animal-leg-${i}`, { w: 0.12, h: 0.55, d: 0.12 }, new Vector3(x, 0.27, z), PALETTE.cliff, 0.2);
      leg.metadata = { kit: 'animal' };
    });
  }

  private interactionProp(scene: Scene, p: TransformNode): void {
    // A waist-high crate — a representative one-button interaction target.
    this.box(scene, p, 'lab-crate', { w: 1, h: 1, d: 1 }, new Vector3(0, 0.5, 0), PALETTE.wood, 0.28);
    this.box(scene, p, 'lab-crate-lid', { w: 1.05, h: 0.12, d: 1.05 }, new Vector3(0, 1.06, 0), PALETTE.roof, 0.3);
  }

  private caveCorridor(scene: Scene, p: TransformNode): void {
    // A low, dark tunnel into an open chamber — tight-then-open camera framing.
    this.box(scene, p, 'lab-cave-l', { w: 0.5, h: 2.6, d: 8 }, new Vector3(-1.6, 1.3, 0), PALETTE.quarry, 0.12);
    this.box(scene, p, 'lab-cave-r', { w: 0.5, h: 2.6, d: 8 }, new Vector3(1.6, 1.3, 0), PALETTE.quarry, 0.12);
    this.box(scene, p, 'lab-cave-roof', { w: 3.7, h: 0.4, d: 8 }, new Vector3(0, 2.4, 0), PALETTE.quarry, 0.1);
    this.box(scene, p, 'lab-cave-room', { w: 7, h: 0.3, d: 6 }, new Vector3(0, 0.15, 6.5), PALETTE.quarry, 0.14);
  }

  /** Debug/e2e introspection: confirms the kit built and exercises the camera
   *  rig deterministically. Mirrors `window.sturdyVolleyDebug` of the play scenes. */
  private installDebugApi(): void {
    const api = {
      kit: (): string[] => this.stations.map((s) => s.id),
      meshCount: (): number => this.scene.meshes.length,
      /** Teleport the framed player to a station (camera follows it there). */
      focus: (id: string): boolean => {
        const s = this.stations.find((st) => st.id === id);
        if (!s) return false;
        this.placePlayer(s.at.x, s.at.z);
        return true;
      },
      player: (): { x: number; z: number } => ({ x: this.motorState.position.x, z: this.motorState.position.z }),
      setPlayer: (x: number, z: number): void => this.placePlayer(x, z),
      /** Drop the player from a height (airborne) — exercises gravity/landing. */
      dropPlayer: (x: number, y: number, z: number): void => {
        this.motorState = createMotorState({ x: clampGround(x), y, z: clampGround(z) }, this.motorState.facing);
        this.controllerState = createControllerState();
        this.playerVel = { x: 0, z: 0 };
        this.playerMesh.position.set(this.motorState.position.x, y, this.motorState.position.z);
      },
      motor: (): { x: number; y: number; z: number; grounded: boolean; sliding: boolean; medium: string; traversing: boolean; velocityY: number; facingDeg: number } => ({
        x: this.motorState.position.x,
        y: this.motorState.position.y,
        z: this.motorState.position.z,
        grounded: this.motorState.grounded,
        sliding: this.motorState.sliding,
        medium: this.motorState.medium,
        traversing: this.motorState.traversal !== null,
        velocityY: this.motorState.velocityY,
        facingDeg: (this.motorState.facing * 180) / Math.PI,
      }),
      /** Begin the contextual climb traversal if in range (no free jump). */
      triggerTraversal: (): boolean => this.tryTraversal(),
      interaction: (): { chosenId: string | null; heldTool: string | null; actionPhase: string; lastImpactId: string | null } => ({
        chosenId: this.chosenTargetId,
        heldTool: this.heldTool() ?? null,
        actionPhase: this.action.phase,
        lastImpactId: this.lastImpactId,
      }),
      setHeldTool: (tool: string | null): void => {
        const idx = CameraLabScene.TOOL_CYCLE.indexOf(tool ?? undefined);
        if (idx >= 0) this.heldToolIndex = idx;
      },
      act: (): boolean => this.commitAction(),
      cancelAct: (): boolean => this.cancelCurrentAction(),
      /** Simulate a save→load / region entry: recover to a grounded pose + anchor. */
      reload: (): void => {
        const p = this.motorState.position;
        const probe = this.physics.groundProbe(p.x, p.y + 1, p.z, 50);
        this.motorState = groundedPoseAt(p.x, p.z, probe.hit ? probe.groundY : 0, this.motorState.facing);
        this.controllerState = createControllerState();
        this.playerVel = { x: 0, z: 0 };
        this.playerMesh.position.set(this.motorState.position.x, this.motorState.position.y, this.motorState.position.z);
      },
      controller: (): { stamina: number; gait: string; speed: number } => ({
        stamina: this.controllerState.stamina,
        gait: this.controllerState.gait,
        speed: this.controllerState.speed,
      }),
      physicsBackend: (): string => this.physics.backend,
      /** Force the player below the out-of-bounds floor (keeps lastSafe). */
      sink: (): void => {
        this.motorState.position.y = DEFAULT_MOTOR_CONFIG.recoverMinY - 10;
      },
      platform: (): { x: number; z: number; topY: number; vel: number } => ({
        x: this.platform.cx,
        z: this.platform.cz,
        topY: this.platform.topY,
        vel: this.platform.vel,
      }),
      setPlayerVelocity: (vx: number, vz: number): void => {
        this.playerVel = { x: vx, z: vz };
      },
      cameraState: () => this.rig.getState(),
      contexts: (): readonly string[] => CAMERA_CONTEXTS,
      variants: (ctx: string): string[] => variantsForContext(ctx as CameraContextId).map((p) => p.id),
      setContext: (ctx: string): void => this.setContext(ctx as CameraContextId),
      cycleVariant: (): string => this.cycleVariant(),
      /** Inject a manual orbit yaw delta (rad) for the next frame. */
      nudgeYaw: (rad: number): void => {
        this.injected = mergeInput(this.injected, { yawDelta: rad, pitchDelta: 0, recenter: false });
      },
      recenter: (): void => this.rig.requestRecenter(),
      setReducedMotion: (on: boolean): void => this.rig.setReducedMotion(on),
      setObstructionMode: (mode: ObstructionMode): void => this.rig.setObstructionMode(mode),
      baselines: (): Readonly<Record<string, string>> => CAMERA_BASELINES,
      /** Normalised viewport position of the framed player (0..1) + on-screen flag. */
      playerScreen: (): { x: number; y: number; onScreen: boolean } => {
        const cam = this.rig.camera;
        const engine = this.ctx.engine;
        const w = engine.getRenderWidth();
        const h = engine.getRenderHeight();
        const world = new Vector3(this.playerMesh.position.x, this.playerMesh.position.y + 0.6, this.playerMesh.position.z);
        const p = Vector3.Project(world, Matrix.Identity(), this.scene.getTransformMatrix(), cam.viewport.toGlobal(w, h));
        const nx = p.x / w;
        const ny = p.y / h;
        const onScreen = p.z > 0 && p.z < 1 && nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1;
        return { x: nx, y: ny, onScreen };
      },
    };
    (window as unknown as { sturdyVolleyLab?: typeof api }).sturdyVolleyLab = api;
  }
}

/** Authored demo volume centred at (cx,cz) with XZ half-extents hx,hz. */
function vol(
  id: string,
  cx: number,
  cz: number,
  hx: number,
  hz: number,
  profileId: string,
  priority: number,
  yawLimitDeg?: number,
): CameraVolume {
  return {
    id,
    min: { x: cx - hx, y: 0, z: cz - hz },
    max: { x: cx + hx, y: 5, z: cz + hz },
    profileId,
    priority,
    ...(yawLimitDeg === undefined ? {} : { yawLimitDeg }),
  };
}

function clampGround(v: number): number {
  return Math.max(-GROUND_HALF, Math.min(GROUND_HALF, v));
}

/** Kit meshes that get a static Havok box collider (032): standable surfaces +
 *  obstacles, skipping decorative meshes + the flat farm tiles + special meshes. */
const COLLIDER_SKIP = new Set([
  'lab-ground',
  'lab-player',
  'lab-water',
  'lab-platform',
  'lab-swim-water',
  'lab-swim-bed',
  'lab-focus-ring',
  'lab-canopy',
  'lab-roof',
  'lab-trunk',
  'lab-npc-head',
  'lab-open-ref',
]);
function isColliderMesh(name: string): boolean {
  if (!name.startsWith('lab-')) return false;
  if (COLLIDER_SKIP.has(name)) return false;
  if (name.startsWith('lab-cell-')) return false; // flat farm tiles
  return true;
}
