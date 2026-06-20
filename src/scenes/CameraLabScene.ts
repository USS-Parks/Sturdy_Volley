import {
  Scene,
  Matrix,
  MeshBuilder,
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

const PLAYER_SPEED = 5; // m/s — proxy driver to exercise the camera; real motor is 031.
const GROUND_HALF = 38;

export class CameraLabScene extends GameScene {
  private readonly stations: KitStation[] = [];
  private rig!: CameraRig;
  private input: CameraInputController | null = null;
  private playerMesh!: Mesh;
  private playerVel: Planar = { x: 0, z: 0 };
  private contextIndex = 0; // exterior
  private variantIndex = 1; // 'standard'
  private readonly held = new Set<string>();
  private injected: CameraInput = { ...ZERO_INPUT };
  private onKeyDown!: (e: KeyboardEvent) => void;
  private onKeyUp!: (e: KeyboardEvent) => void;

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    this.scene = scene; // station()/box() build against this.scene below
    addFog(scene, PALETTE.fog, 0.012);
    addLights(scene);

    // Reference ground — 80 m across so every station sits on solid floor.
    const ground = MeshBuilder.CreateGround('lab-ground', { width: 80, height: 80 }, scene);
    ground.material = flatMaterial(scene, 'lab-ground', PALETTE.grass, 0.22);

    this.buildKit(scene);

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

    this.installDebugApi();
  }

  override update(dt: number): void {
    if (dt <= 0) return;
    this.drivePlayer(dt);
    const camInput = this.input ? this.input.consume(dt) : { ...ZERO_INPUT };
    const merged = mergeInput(camInput, this.drainInjected());
    this.rig.update(dt, merged);
  }

  override dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.input?.dispose();
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
    }
  }

  // --- Reference player driver (camera-relative) ----------------------------
  private drivePlayer(dt: number): void {
    const fwd = (this.held.has('w') || this.held.has('arrowup') ? 1 : 0) - (this.held.has('s') || this.held.has('arrowdown') ? 1 : 0);
    const str = (this.held.has('d') || this.held.has('arrowright') ? 1 : 0) - (this.held.has('a') || this.held.has('arrowleft') ? 1 : 0);
    if (fwd === 0 && str === 0) {
      this.playerVel = { x: 0, z: 0 };
      return;
    }
    const alpha = this.rig.camera.alpha;
    // Planar forward = from camera toward target (into the screen).
    const forward: Planar = { x: -Math.cos(alpha), z: -Math.sin(alpha) };
    const right: Planar = { x: -Math.sin(alpha), z: Math.cos(alpha) };
    let mx = right.x * str + forward.x * fwd;
    let mz = right.z * str + forward.z * fwd;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len;
    mz /= len;
    this.playerVel = { x: mx * PLAYER_SPEED, z: mz * PLAYER_SPEED };
    const p = this.playerMesh.position;
    p.x = clampGround(p.x + this.playerVel.x * dt);
    p.z = clampGround(p.z + this.playerVel.z * dt);
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
        this.playerMesh.position.set(s.at.x, PLAYER_HEIGHT / 2, s.at.z);
        this.playerVel = { x: 0, z: 0 };
        return true;
      },
      player: (): { x: number; z: number } => ({ x: this.playerMesh.position.x, z: this.playerMesh.position.z }),
      setPlayer: (x: number, z: number): void => {
        this.playerMesh.position.set(clampGround(x), PLAYER_HEIGHT / 2, clampGround(z));
      },
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
