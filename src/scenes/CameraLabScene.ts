import {
  Scene,
  ArcRotateCamera,
  MeshBuilder,
  TransformNode,
  Vector3,
  Color3,
  type Mesh,
} from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, PALETTE } from '../render/scene-helpers';

/**
 * Camera proving ground (WEF-01a, master Prompt 028).
 *
 * A single scene holding the full camera/motor test-geometry kit at true meter
 * scale (1 unit = 1 m, per docs/SCALE_AND_PERFORMANCE.md). It is the fixed stage
 * the data-driven camera profiles (Prompt 029) and the kinematic motor
 * (Prompt 031+) are tuned against, so every camera context — exterior, farm,
 * interiors, lane, cave, water, slopes — has a representative obstruction to
 * frame. Reachable via the Title "Dev · Camera Lab" item (dev builds) or the
 * `?scene=CameraLab` direct-boot route (works in the production preview build).
 *
 * The camera here is a plain orbit camera for inspection only; the authored
 * camera rig + profiles land in Prompt 029.
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

export class CameraLabScene extends GameScene {
  private camera!: ArcRotateCamera;
  private readonly stations: KitStation[] = [];

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    this.scene = scene; // station()/box() build against this.scene below
    addFog(scene, PALETTE.fog, 0.012);
    addLights(scene);

    // Reference ground — 80 m across so every station sits on solid floor.
    const ground = MeshBuilder.CreateGround('lab-ground', { width: 80, height: 80 }, scene);
    ground.material = flatMaterial(scene, 'lab-ground', PALETTE.grass, 0.22);

    this.buildKit(scene);

    // Inspection camera: orbit, framed on the kit centre. Authored rig is 029.
    this.camera = new ArcRotateCamera(
      'lab-cam',
      -Math.PI / 2 + 0.7,
      Math.PI / 3.1,
      34,
      new Vector3(0, 1.2, 0),
      scene,
    );
    this.camera.fov = 0.8;
    this.camera.minZ = 0.1;
    this.camera.lowerRadiusLimit = 4;
    this.camera.upperRadiusLimit = 60;
    this.camera.wheelDeltaPercentage = 0.02;
    const canvas = this.ctx.engine.getRenderingCanvas();
    if (canvas) this.camera.attachControl(canvas, true);

    this.scene = scene;
    return scene;
  }

  override enter(): void {
    // Reference-player capsule the camera kit is sized around, parked at origin.
    this.installDebugApi();
  }

  override dispose(): void {
    this.camera?.detachControl();
    delete (window as unknown as { sturdyVolleyLab?: unknown }).sturdyVolleyLab;
    super.dispose();
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

  /** Debug/e2e introspection: confirms the kit built and lets a test frame any
   *  station. Mirrors the `window.sturdyVolleyDebug` pattern of the play scenes. */
  private installDebugApi(): void {
    const api = {
      kit: (): string[] => this.stations.map((s) => s.id),
      meshCount: (): number => this.scene.meshes.length,
      focus: (id: string): boolean => {
        const s = this.stations.find((st) => st.id === id);
        if (!s) return false;
        this.camera.setTarget(new Vector3(s.at.x, 1.2, s.at.z));
        return true;
      },
    };
    (window as unknown as { sturdyVolleyLab?: typeof api }).sturdyVolleyLab = api;
  }
}
