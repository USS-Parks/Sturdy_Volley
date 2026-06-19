import {
  Scene,
  ArcRotateCamera,
  MeshBuilder,
  Vector3,
  type AbstractMesh,
} from '@babylonjs/core';
import { GameScene } from './GameScene';
import {
  makeScene,
  addFog,
  addLights,
  flatMaterial,
  PALETTE,
} from '../render/scene-helpers';
import { getActiveSave, persistActiveSave, clearActiveSave } from '../engine/gameState';
import { writeSave } from '../engine/save';
import { formatSaveStatus } from '../engine/format';
import { computeMoveVector, type MoveInput } from '../engine/movement';
import { FarmGrid, FARM_CELL_SIZE } from '../engine/farmGrid';
import type { SaveData } from '../engine/saveModel';

const WALK_SPEED = 6; // world units / second
const FARM_HALF = 20; // half-extent of the farm ground (units)

interface DebugApi {
  player: () => { x: number; z: number };
}

/**
 * Breakpoint Farm — the first playable 3D scene (Prompt 004). Placeholder
 * low-poly terrain + props, a grid-aware tilled plot (FarmGrid), a third-person
 * player walkable by keyboard + touch with Babylon ellipsoid collisions, a
 * follow camera, and Theme-3 fog/lighting. Real .glb models swap in at polish.
 */
export class FarmScene extends GameScene {
  private camera!: ArcRotateCamera;
  private player!: AbstractMesh;
  private readonly grid = new FarmGrid(8, 6, 'tilled');
  private readonly pressed = new Set<string>();
  private menuOpen = false;
  private touch: { active: boolean; dx: number; dy: number; ox: number; oy: number } = {
    active: false,
    dx: 0,
    dy: 0,
    ox: 0,
    oy: 0,
  };
  private readonly onKeyDown = (e: KeyboardEvent) => this.pressed.add(e.key.toLowerCase());
  private readonly onKeyUp = (e: KeyboardEvent) => this.pressed.delete(e.key.toLowerCase());

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    scene.collisionsEnabled = true;
    addFog(scene, PALETTE.fog, 0.014);
    addLights(scene);

    this.camera = new ArcRotateCamera('farm-cam', -Math.PI / 2 + 0.6, Math.PI / 3.2, 14, Vector3.Zero(), scene);
    this.camera.fov = 0.8;

    // Ground
    const ground = MeshBuilder.CreateGround('ground', { width: FARM_HALF * 2, height: FARM_HALF * 2 }, scene);
    ground.material = flatMaterial(scene, 'ground', PALETTE.grass, 0.25);
    ground.checkCollisions = true;

    this.buildTilledPlot(scene);
    this.buildProps(scene);
    this.buildBounds(scene);

    // Player
    const player = MeshBuilder.CreateCapsule('player', { height: 1.8, radius: 0.4 }, scene);
    player.position.set(0, 0.9, 6);
    player.material = flatMaterial(scene, 'player', PALETTE.player, 0.35);
    player.checkCollisions = true;
    player.ellipsoid = new Vector3(0.4, 0.9, 0.4);
    this.player = player;
    this.camera.lockedTarget = player;

    this.scene = scene;
    return scene;
  }

  private buildTilledPlot(scene: Scene): void {
    // Visualize the FarmGrid as a raised soil plot near the farmhouse.
    const origin = new Vector3(-6, 0, -4);
    const soil = flatMaterial(scene, 'soil', PALETTE.soil, 0.22);
    this.grid.forEach((cell) => {
      if (cell.state === 'untilled') return;
      const local = this.grid.cellToWorld(cell.col, cell.row);
      const tile = MeshBuilder.CreateBox(`cell-${cell.col}-${cell.row}`, {
        width: FARM_CELL_SIZE * 0.94,
        depth: FARM_CELL_SIZE * 0.94,
        height: 0.12,
      }, scene);
      tile.position.set(origin.x + local.x, 0.06, origin.z + local.z);
      tile.material = soil;
    });
  }

  private buildProps(scene: Scene): void {
    const house = MeshBuilder.CreateBox('farmhouse', { width: 4, depth: 4, height: 3 }, scene);
    house.position.set(-10, 1.5, -8);
    house.material = flatMaterial(scene, 'farmhouse', PALETTE.wood, 0.25);
    house.checkCollisions = true;
    const roof = MeshBuilder.CreateCylinder('farmroof', { height: 1.6, diameterTop: 0, diameterBottom: 6.2, tessellation: 4 }, scene);
    roof.position.set(-10, 3.8, -8);
    roof.rotation.y = Math.PI / 4;
    roof.material = flatMaterial(scene, 'farmroof', PALETTE.roof, 0.25);

    ([[8, -6], [11, 4], [-2, 9], [6, 10]] as const).forEach(([x, z], i) => {
      const trunk = MeshBuilder.CreateCylinder(`trunk${i}`, { height: 2, diameter: 0.6 }, scene);
      trunk.position.set(x, 1, z);
      trunk.material = flatMaterial(scene, `trunk${i}`, PALETTE.wood, 0.18);
      trunk.checkCollisions = true;
      const canopy = MeshBuilder.CreateCylinder(`canopy${i}`, { height: 3, diameterTop: 0, diameterBottom: 3.2, tessellation: 7 }, scene);
      canopy.position.set(x, 3.4, z);
      canopy.material = flatMaterial(scene, `canopy${i}`, PALETTE.grassAlt, 0.22);
    });

    // Tide-fed pond: a visible water disc + an invisible collider so the player can't walk in.
    const pond = MeshBuilder.CreateDisc('pond', { radius: 3, tessellation: 24 }, scene);
    pond.rotation.x = Math.PI / 2;
    pond.position.set(10, 0.05, -2);
    pond.material = flatMaterial(scene, 'pond', PALETTE.sea, 0.35);
    const pondWall = MeshBuilder.CreateCylinder('pondWall', { height: 2, diameter: 6 }, scene);
    pondWall.position.set(10, 1, -2);
    pondWall.checkCollisions = true;
    pondWall.isVisible = false;
  }

  private buildBounds(scene: Scene): void {
    const t = 1;
    const specs: Array<[number, number, number, number]> = [
      [0, FARM_HALF, FARM_HALF * 2, t],
      [0, -FARM_HALF, FARM_HALF * 2, t],
      [FARM_HALF, 0, t, FARM_HALF * 2],
      [-FARM_HALF, 0, t, FARM_HALF * 2],
    ];
    specs.forEach(([x, z, w, d], i) => {
      const wall = MeshBuilder.CreateBox(`bound${i}`, { width: w, depth: d, height: 4 }, scene);
      wall.position.set(x, 2, z);
      wall.checkCollisions = true;
      wall.isVisible = false;
    });
  }

  override enter(): void {
    const save = getActiveSave();
    if (!save) {
      this.goTo('Title', undefined, false);
      return;
    }
    save.location.sceneKey = 'Farm';
    writeSave(save);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.attachTouch();
    this.showHud(save);

    (window as unknown as { sturdyVolleyDebug?: DebugApi }).sturdyVolleyDebug = {
      player: () => ({ x: this.player.position.x, z: this.player.position.z }),
    };
  }

  override update(dt: number): void {
    if (!this.player || this.menuOpen) return;
    const vec = computeMoveVector(this.readInput());
    if (vec.x === 0 && vec.y === 0) return;

    const forward = this.player.position.subtract(this.camera.position);
    forward.y = 0;
    if (forward.lengthSquared() < 1e-4) return;
    forward.normalize();
    const right = new Vector3(forward.z, 0, -forward.x);
    const move = right.scale(vec.x).add(forward.scale(-vec.y));
    const disp = move.scale(WALK_SPEED * dt);
    this.player.moveWithCollisions(new Vector3(disp.x, 0, disp.z));
  }

  private readInput(): MoveInput {
    const p = this.pressed;
    return {
      up: p.has('w') || p.has('arrowup'),
      down: p.has('s') || p.has('arrowdown'),
      left: p.has('a') || p.has('arrowleft'),
      right: p.has('d') || p.has('arrowright'),
      pointer: this.touch.active ? { dx: this.touch.dx, dy: this.touch.dy, active: true } : undefined,
    };
  }

  private attachTouch(): void {
    const canvas = this.ctx.engine.getRenderingCanvas();
    if (!canvas) return;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
  }

  private readonly onPointerDown = (e: PointerEvent) => {
    this.touch = { active: true, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
  };
  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.touch.active) return;
    this.touch.dx = e.clientX - this.touch.ox;
    this.touch.dy = e.clientY - this.touch.oy;
  };
  private readonly onPointerUp = () => {
    this.touch = { active: false, dx: 0, dy: 0, ox: 0, oy: 0 };
  };

  private showHud(save: SaveData): void {
    this.menuOpen = false;
    this.ctx.overlay.showHud('Breakpoint Farm', formatSaveStatus(save), () => this.openMenu(save));
  }

  private openMenu(save: SaveData): void {
    this.menuOpen = true;
    this.ctx.overlay.showMenu(
      'Paused',
      [
        { id: 'resume', label: 'Resume', enabled: true, testId: 'pause-resume' },
        { id: 'town', label: 'Walk to Ballast Bay', enabled: true, testId: 'nav-town' },
        { id: 'beach', label: 'Driftwood Beach', enabled: true, testId: 'nav-beach' },
        { id: 'mine', label: 'Ironroot Quarry', enabled: true, testId: 'nav-mine' },
        { id: 'save-quit', label: 'Save & quit to title', enabled: true, testId: 'nav-save-quit' },
      ],
      (id) => this.onMenu(id, save),
      formatSaveStatus(save),
    );
  }

  private onMenu(id: string, save: SaveData): void {
    switch (id) {
      case 'resume':
        this.showHud(save);
        break;
      case 'town':
        this.goTo('Town');
        break;
      case 'beach':
        this.goTo('Beach');
        break;
      case 'mine':
        this.goTo('Mine');
        break;
      case 'save-quit':
        persistActiveSave();
        clearActiveSave();
        this.goTo('Title');
        break;
    }
  }

  override dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    const canvas = this.ctx.engine.getRenderingCanvas();
    if (canvas) {
      canvas.removeEventListener('pointerdown', this.onPointerDown);
      canvas.removeEventListener('pointermove', this.onPointerMove);
      canvas.removeEventListener('pointerup', this.onPointerUp);
      canvas.removeEventListener('pointercancel', this.onPointerUp);
    }
    super.dispose();
  }
}
