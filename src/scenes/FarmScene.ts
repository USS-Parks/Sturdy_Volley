import {
  Scene,
  ArcRotateCamera,
  MeshBuilder,
  Vector3,
  type AbstractMesh,
} from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, PALETTE } from '../render/scene-helpers';
import { getActiveSave, persistActiveSave, clearActiveSave } from '../engine/gameState';
import { writeSave } from '../engine/save';
import { formatSaveStatus } from '../engine/format';
import { computeMoveVector, type MoveInput } from '../engine/movement';
import { FarmGrid, FARM_CELL_SIZE } from '../engine/farmGrid';
import { createControllerState, stepController, type ControllerState } from '../engine/controller';
import { resolveInteraction, type InteractTarget } from '../engine/interaction';
import type { SaveData } from '../engine/saveModel';

const FARM_HALF = 20;
const TOOLS = ['Hoe', 'Watering Can', 'Axe', 'Pick', 'Sickle'] as const;

interface DebugApi {
  player: () => { x: number; z: number };
  controller: () => { stamina: number; gait: string; target: string | null; tool: string };
}

/**
 * Breakpoint Farm — playable 3D scene (Prompts 004–005). Placeholder low-poly
 * terrain/props + a grid-aware tilled plot; a third-person player driven by the
 * renderer-agnostic controller (jog/sprint, acceleration, stamina) and an
 * interaction resolver (one button → nearest, highest-priority target). Tool
 * slots cycle with the number keys. Real rigs/animations bind at the art pass.
 */
export class FarmScene extends GameScene {
  private camera!: ArcRotateCamera;
  private player!: AbstractMesh;
  private save!: SaveData;
  private readonly grid = new FarmGrid(8, 6, 'tilled');
  private controller: ControllerState = createControllerState();
  private targets: InteractTarget[] = [];
  private nearest: InteractTarget | null = null;
  private selectedTool = 0;
  private actionTimer = 0;
  private actionLabel = '';
  private hudTimer = 0;
  private ePrev = false;
  private menuOpen = false;

  private readonly pressed = new Set<string>();
  private touch = { active: false, dx: 0, dy: 0, ox: 0, oy: 0 };
  private readonly onKeyDown = (e: KeyboardEvent) => this.pressed.add(e.key.toLowerCase());
  private readonly onKeyUp = (e: KeyboardEvent) => this.pressed.delete(e.key.toLowerCase());

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    scene.collisionsEnabled = true;
    addFog(scene, PALETTE.fog, 0.014);
    addLights(scene);

    this.camera = new ArcRotateCamera('farm-cam', -Math.PI / 2 + 0.6, Math.PI / 3.2, 14, Vector3.Zero(), scene);
    this.camera.fov = 0.8;

    const ground = MeshBuilder.CreateGround('ground', { width: FARM_HALF * 2, height: FARM_HALF * 2 }, scene);
    ground.material = flatMaterial(scene, 'ground', PALETTE.grass, 0.25);
    ground.checkCollisions = true;

    this.buildTilledPlot(scene);
    this.buildProps(scene);
    this.buildBounds(scene);

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
    this.save = save;
    save.location.sceneKey = 'Farm';
    writeSave(save);

    this.controller = createControllerState();
    this.targets = [
      { id: 'farmhouse-door', kind: 'door', label: 'Enter the farmhouse', x: -10, z: -5.6, radius: 2.6, priority: 5 },
      { id: 'tilled-plot', kind: 'farm-cell', label: 'Tend the soil', x: -6, z: -4, radius: 4, priority: 3 },
      { id: 'tide-pond', kind: 'water-entry', label: 'Check the tide pond', x: 10, z: -2, radius: 4.4, priority: 2 },
      { id: 'tree-1', kind: 'prop', label: 'Inspect the tree', x: 8, z: -6, radius: 2, priority: 1 },
      { id: 'tree-2', kind: 'prop', label: 'Inspect the tree', x: -2, z: 9, radius: 2, priority: 1 },
    ];

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.attachTouch();
    this.menuOpen = false;
    this.refreshHud();

    (window as unknown as { sturdyVolleyDebug?: DebugApi }).sturdyVolleyDebug = {
      player: () => ({ x: this.player.position.x, z: this.player.position.z }),
      controller: () => ({
        stamina: this.controller.stamina,
        gait: this.controller.gait,
        target: this.nearest?.id ?? null,
        tool: TOOLS[this.selectedTool],
      }),
    };
  }

  override update(dt: number): void {
    if (!this.player) return;
    if (this.menuOpen) {
      this.controller = stepController(this.controller, { dir: { x: 0, z: 0 }, sprint: false }, dt);
      return;
    }

    this.updateToolSelection();

    const dir = this.cameraRelativeDir(computeMoveVector(this.readInput()));
    const sprint = this.pressed.has('shift');
    this.controller = stepController(this.controller, { dir, sprint }, dt);
    if (this.controller.speed > 0.01 && (dir.x !== 0 || dir.z !== 0)) {
      this.player.moveWithCollisions(new Vector3(dir.x, 0, dir.z).scale(this.controller.speed * dt));
    }

    this.nearest = resolveInteraction(this.targets, this.player.position.x, this.player.position.z);

    const interact = this.pressed.has('e') || this.pressed.has(' ');
    if (interact && !this.ePrev && this.nearest) {
      this.actionLabel = this.nearest.label;
      this.actionTimer = 1.6;
    }
    this.ePrev = interact;
    if (this.actionTimer > 0) this.actionTimer -= dt;

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.2;
      this.refreshHud();
    }
  }

  private cameraRelativeDir(vec: { x: number; y: number }): { x: number; z: number } {
    if (vec.x === 0 && vec.y === 0) return { x: 0, z: 0 };
    const forward = this.player.position.subtract(this.camera.position);
    forward.y = 0;
    if (forward.lengthSquared() < 1e-4) return { x: 0, z: 0 };
    forward.normalize();
    const right = new Vector3(forward.z, 0, -forward.x);
    const move = right.scale(vec.x).add(forward.scale(-vec.y));
    return { x: move.x, z: move.z };
  }

  private updateToolSelection(): void {
    for (let i = 0; i < TOOLS.length; i++) {
      if (this.pressed.has(String(i + 1))) this.selectedTool = i;
    }
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

  private refreshHud(): void {
    const stamina = Math.round(this.controller.stamina);
    let line = `${formatSaveStatus(this.save)} · energy ${stamina}% · tool: ${TOOLS[this.selectedTool]}`;
    if (this.actionTimer > 0) line += ` · ✔ ${this.actionLabel}`;
    else if (this.nearest) line += ` · [E] ${this.nearest.label}`;
    this.ctx.overlay.showHud('Breakpoint Farm', line, () => this.openMenu());
  }

  private openMenu(): void {
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
      (id) => this.onMenu(id),
      formatSaveStatus(this.save),
    );
  }

  private onMenu(id: string): void {
    switch (id) {
      case 'resume':
        this.menuOpen = false;
        this.refreshHud();
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
