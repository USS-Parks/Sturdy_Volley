import {
  Scene,
  ArcRotateCamera,
  MeshBuilder,
  Vector3,
  type AbstractMesh,
} from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, PALETTE } from '../render/scene-helpers';
import {
  getActiveSave,
  persistActiveSave,
  clearActiveSave,
  getDayLedger,
  resetDayLedger,
} from '../engine/gameState';
import { writeSave } from '../engine/save';
import { formatWorldStatus } from '../engine/format';
import { computeMoveVector, type MoveInput } from '../engine/movement';
import { FarmGrid, FARM_CELL_SIZE } from '../engine/farmGrid';
import { createControllerState, stepController, type ControllerState } from '../engine/controller';
import { resolveInteraction, type InteractTarget } from '../engine/interaction';
import type { Container, SaveData } from '../engine/saveModel';
import { loadGameContent } from '../data/content';
import { forecastFor } from '../engine/weather';
import { tideStateAt, type TideState } from '../engine/tide';
import { applyGameTime, getGameTime, resolveDay } from '../engine/dayResolution';
import {
  createTimeClock,
  pauseClock,
  setClockScale,
  setClockTime,
  tickClock,
  type TimeClockState,
} from '../engine/timeClock';
import { formatClock as formatGameClock } from '../engine/timeSystem';
import type { Weather } from '../data/schemas';
import { addItem, moveBetween, placeOrMerge, clearSlot, removeItem } from '../engine/inventory';
import { buildItemCatalog, getItem, type ItemCatalog } from '../engine/itemCatalog';
import type { SlotMove } from '../ui/overlay';
import {
  buildCropIndex,
  harvest,
  isHarvestReady,
  newPlanting,
  plantingKey,
} from '../engine/soil';
import { recordIncome as _recordIncome, recordSkillXp } from '../engine/gameState';
import { aoeAt, aoeOffsets, hardnessReach, staminaCost, type ToolId } from '../engine/tools';
import type { Crop } from '../data/schemas';
import type { AbstractMesh as BabylonMesh } from '@babylonjs/core';
import { collect, type WorldEntity } from '../engine/forage';
import {
  anchorFor,
  buildEntityMesh,
  entityLabel,
  farmEntitySuffix,
  FARM_ENTITY_ANCHORS,
} from '../render/farm-entities';

const FARM_HALF = 20;
const TOOLS = ['Hoe', 'Watering Can', 'Axe', 'Pick', 'Sickle'] as const;
/** Parallel ToolId array matching the TOOLS display labels by index. */
export const FARM_TOOL_IDS: readonly ToolId[] = ['hoe', 'watering-can', 'axe', 'pick', 'sickle'];

interface DebugApi {
  player: () => { x: number; z: number };
  controller: () => { stamina: number; gait: string; target: string | null; tool: string };
  time: () => { minutes: number; paused: boolean; scale: number; clock: string };
  setTimeScale: (scale: number) => void;
  sleep: () => void;
  openInventory: () => void;
  shippingBinSlots: () => readonly (import('../engine/saveModel').InventoryStack | null)[];
  hotbarSlots: () => readonly (import('../engine/saveModel').InventoryStack | null)[];
  shipPrototypeSeeds: () => void;
  worldEntities: () => Record<string, { kind: string; itemId: string | null; age: number }>;
  warpToEntity: (suffix: string) => boolean;
  entityAnchors: () => Record<string, { x: number; z: number }>;
}

type PartnerKind = 'chest' | 'shipping-bin' | null;

/**
 * Breakpoint Farm — playable 3D scene (Prompts 004–007). Placeholder low-poly
 * terrain/props + a grid-aware tilled plot; a third-person player driven by the
 * renderer-agnostic controller + interaction resolver. Prompt 006 added the
 * live time clock + bedtime/collapse + Sleep prompt. Prompt 007 adds the
 * persistent hotbar strip, the inventory panel (player + chest/shipping-bin
 * partner + trash) with pointer-driven drag/drop, an inventory hotkey (I or
 * Tab), a starter chest on the porch, and a shipping bin that sells overnight.
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
  private selectedHotbar = 0;
  private actionTimer = 0;
  private actionLabel = '';
  private hudTimer = 0;
  private ePrev = false;
  private iPrev = false;
  private menuOpen = false;
  private inventoryOpen = false;
  private clock!: TimeClockState;
  private weather: Weather | null = null;
  private tide: TideState = 'low';
  private dayResolving = false;
  private partnerKind: PartnerKind = null;
  private partnerId: string | null = null;
  private catalog!: ItemCatalog;
  private cropIndex!: ReturnType<typeof buildCropIndex>;
  private seedToCropId: Map<string, string> = new Map();
  private readonly cellMeshes = new Map<string, BabylonMesh>();
  private readonly cropMeshes = new Map<string, BabylonMesh>();
  /** Live meshes for `Farm:*` worldEntities keyed by the bare suffix. */
  private readonly entityMeshes = new Map<string, BabylonMesh>();
  private readonly homePosition = new Vector3(-8, 0.9, -5.4);
  private readonly plotOrigin = new Vector3(-6, 0, -4);
  private static readonly SCENE_KEY = 'Farm';

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
    const origin = this.plotOrigin;
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
      this.cellMeshes.set(`${cell.col},${cell.row}`, tile);
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

    // Static decorative trees — entity trees (tree-a, tree-b) own (11,4) + (-2,9).
    ([[8, -6], [6, 10]] as const).forEach(([x, z], i) => {
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

    // Shipping bin — a chunky wooden crate next to the farmhouse porch.
    const bin = MeshBuilder.CreateBox('shipping-bin', { width: 1.6, depth: 1.2, height: 1.2 }, scene);
    bin.position.set(-6.2, 0.6, -7.6);
    bin.material = flatMaterial(scene, 'shipping-bin', PALETTE.wood, 0.22);
    bin.checkCollisions = true;
    const binLid = MeshBuilder.CreateBox('shipping-bin-lid', { width: 1.7, depth: 1.3, height: 0.1 }, scene);
    binLid.position.set(-6.2, 1.25, -7.6);
    binLid.material = flatMaterial(scene, 'shipping-bin-lid', PALETTE.roof, 0.22);

    // Porch chest — a smaller chest next to the door.
    const chest = MeshBuilder.CreateBox('porch-chest', { width: 1.1, depth: 0.75, height: 0.75 }, scene);
    chest.position.set(-12, 0.38, -6);
    chest.material = flatMaterial(scene, 'porch-chest', PALETTE.wood, 0.22);
    chest.checkCollisions = true;
    const chestLid = MeshBuilder.CreateBox('porch-chest-lid', { width: 1.2, depth: 0.85, height: 0.12 }, scene);
    chestLid.position.set(-12, 0.82, -6);
    chestLid.material = flatMaterial(scene, 'porch-chest-lid', PALETTE.roof, 0.22);
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

  override enter(data?: unknown): void {
    const save = getActiveSave();
    if (!save) {
      this.goTo('Title', undefined, false);
      return;
    }
    this.save = save;
    save.location.sceneKey = 'Farm';
    writeSave(save);

    const content = loadGameContent();
    this.catalog = buildItemCatalog(content.items, content.npcs);
    this.cropIndex = buildCropIndex(content.crops);
    this.seedToCropId = new Map(content.crops.map((c) => [c.seedItemId, c.id] as const));
    this.refreshCropMeshes();
    this.refreshEntityMeshes();

    this.controller = createControllerState();
    this.clock = createTimeClock(getGameTime(save));
    this.refreshWorldState();
    this.rebuildInteractionTargets();

    // Honor cross-scene entry handoff. Coming back from the farmhouse interior
    // spawns the player at the outside-door anchor; otherwise the build-time
    // position from build() stands.
    const entry =
      typeof data === 'object' && data !== null && 'entry' in data
        ? String((data as { entry?: unknown }).entry ?? '')
        : '';
    if (entry === 'farmhouse-door') {
      this.player.position.set(-10, 0.9, -3.5);
    }

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.attachTouch();
    this.menuOpen = false;
    this.inventoryOpen = false;
    this.dayResolving = false;
    this.partnerKind = null;
    this.partnerId = null;
    this.refreshHud();
    this.refreshHotbar();

    (window as unknown as { sturdyVolleyDebug?: DebugApi }).sturdyVolleyDebug = {
      player: () => ({ x: this.player.position.x, z: this.player.position.z }),
      controller: () => ({
        stamina: this.controller.stamina,
        gait: this.controller.gait,
        target: this.nearest?.id ?? null,
        tool: TOOLS[this.selectedTool],
      }),
      time: () => ({
        minutes: this.clock.time.minutes,
        paused: this.clock.paused,
        scale: this.clock.scale,
        clock: formatGameClock(this.clock.time.minutes),
      }),
      setTimeScale: (scale: number) => {
        this.clock = setClockScale(this.clock, scale);
      },
      sleep: () => this.triggerSleep(false),
      openInventory: () => this.openInventory(null),
      shippingBinSlots: () => this.save.shippingBin.slots,
      hotbarSlots: () =>
        this.save.inventory.slots.slice(0, this.save.hotbarSize),
      shipPrototypeSeeds: () => {
        // Debug shortcut for e2e: move the starter Bell Pea Seeds stack
        // from hotbar slot 0 to the first open shipping-bin slot.
        const result = moveBetween(this.save.inventory, this.save.shippingBin, 0);
        this.save.inventory = result.from;
        this.save.shippingBin = result.to;
        persistActiveSave();
        this.refreshHotbar();
      },
      worldEntities: () => {
        const out: Record<string, { kind: string; itemId: string | null; age: number }> = {};
        for (const [k, v] of Object.entries(this.save.worldEntities)) {
          out[k] = { kind: v.kind, itemId: v.itemId, age: v.age };
        }
        return out;
      },
      warpToEntity: (suffix: string): boolean => {
        const anchor = anchorFor(suffix);
        if (!anchor) return false;
        // Stand just inside the interaction radius.
        this.player.position.set(anchor.x - 0.5, 0.9, anchor.z - 0.5);
        return true;
      },
      entityAnchors: () => ({ ...FARM_ENTITY_ANCHORS }),
    };
  }

  override update(dt: number): void {
    if (!this.player) return;
    if (this.menuOpen || this.inventoryOpen || this.dayResolving) {
      this.clock = pauseClock(this.clock, true);
      this.controller = stepController(this.controller, { dir: { x: 0, z: 0 }, sprint: false }, dt);
      return;
    }
    if (this.clock.paused) this.clock = pauseClock(this.clock, false);

    this.updateToolSelection();
    this.updateHotbarSelection();

    const dir = this.cameraRelativeDir(computeMoveVector(this.readInput()));
    const sprint = this.pressed.has('shift');
    this.controller = stepController(this.controller, { dir, sprint }, dt);
    if (this.controller.speed > 0.01 && (dir.x !== 0 || dir.z !== 0)) {
      this.player.moveWithCollisions(new Vector3(dir.x, 0, dir.z).scale(this.controller.speed * dt));
    }

    this.nearest = resolveInteraction(this.targets, this.player.position.x, this.player.position.z);

    const interact = this.pressed.has('e') || this.pressed.has(' ');
    if (interact && !this.ePrev && this.nearest) {
      if (this.nearest.id === 'farmhouse-door') {
        this.goTo('Interior', { entry: 'inside-door' });
      } else if (this.nearest.id === 'shipping-bin') {
        this.openInventory({ kind: 'shipping-bin', id: 'shipping-bin' });
      } else if (this.nearest.id === 'porch-chest') {
        this.openInventory({ kind: 'chest', id: 'farm-porch-chest' });
      } else if (this.nearest.id === 'tilled-plot') {
        this.handlePlotInteract();
      } else if (this.nearest.id.startsWith('entity:')) {
        this.handleEntityInteract(this.nearest.id.slice('entity:'.length));
      } else {
        this.actionLabel = this.nearest.label;
        this.actionTimer = 1.6;
      }
    }
    this.ePrev = interact;

    const inventoryKey = this.pressed.has('i');
    if (inventoryKey && !this.iPrev) this.openInventory(null);
    this.iPrev = inventoryKey;

    if (this.actionTimer > 0) this.actionTimer -= dt;

    const tick = tickClock(this.clock, dt);
    this.clock = tick.state;
    if (tick.advancedMinutes > 0) {
      applyGameTime(this.save, this.clock.time);
      this.refreshWorldState();
    }
    if (tick.collapsed) {
      this.triggerSleep(true);
      return;
    }

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

  private updateHotbarSelection(): void {
    for (let i = 0; i < this.save.hotbarSize; i++) {
      if (this.pressed.has(String(i + 1))) {
        if (this.selectedHotbar !== i) {
          this.selectedHotbar = i;
          this.refreshHotbar();
        }
      }
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

  private refreshWorldState(): void {
    const content = loadGameContent();
    this.weather = forecastFor(this.clock.time, content.weather);
    this.tide = tideStateAt(this.clock.time);
  }

  private refreshHotbar(): void {
    const slots = this.save.inventory.slots.slice(0, this.save.hotbarSize);
    this.ctx.overlay.showHotbar({
      slots,
      selectedIndex: this.selectedHotbar,
      catalog: this.catalog,
      onSelect: (i) => {
        this.selectedHotbar = i;
        this.refreshHotbar();
      },
    });
  }

  private activeSlotLabel(): string {
    const stack = this.save.inventory.slots[this.selectedHotbar];
    if (!stack) return TOOLS[this.selectedTool];
    return getItem(this.catalog, stack.itemId)?.name ?? stack.itemId;
  }

  private refreshHud(): void {
    const stamina = Math.round(this.controller.stamina);
    const status = formatWorldStatus(this.save, {
      weather: this.weather,
      tide: this.tide,
      gold: this.save.wallet.gold,
    });
    let line = `${status} · energy ${stamina}% · active: ${this.activeSlotLabel()}`;
    if (this.actionTimer > 0) line += ` · ✔ ${this.actionLabel}`;
    else if (this.nearest) line += ` · [E] ${this.nearest.label}`;
    this.ctx.overlay.showHud('Breakpoint Farm', line, () => this.openMenu());
    this.refreshHotbar();
  }

  private openMenu(): void {
    this.menuOpen = true;
    this.ctx.overlay.showMenu(
      'Paused',
      [
        { id: 'resume', label: 'Resume', enabled: true, testId: 'pause-resume' },
        { id: 'inventory', label: 'Open inventory', enabled: true, testId: 'pause-inventory' },
        { id: 'sleep', label: 'Sleep until tomorrow', enabled: true, testId: 'pause-sleep' },
        { id: 'town', label: 'Walk to Ballast Bay', enabled: true, testId: 'nav-town' },
        { id: 'beach', label: 'Driftwood Beach', enabled: true, testId: 'nav-beach' },
        { id: 'mine', label: 'Ironroot Quarry', enabled: true, testId: 'nav-mine' },
        { id: 'save-quit', label: 'Save & quit to title', enabled: true, testId: 'nav-save-quit' },
      ],
      (id) => this.onMenu(id),
      formatWorldStatus(this.save, {
        weather: this.weather,
        tide: this.tide,
        gold: this.save.wallet.gold,
      }),
    );
  }

  private onMenu(id: string): void {
    switch (id) {
      case 'resume':
        this.menuOpen = false;
        this.refreshHud();
        break;
      case 'inventory':
        this.menuOpen = false;
        this.openInventory(null);
        break;
      case 'sleep':
        this.menuOpen = false;
        this.triggerSleep(false);
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

  private openInventory(partner: { kind: 'chest' | 'shipping-bin'; id: string } | null): void {
    this.inventoryOpen = true;
    this.partnerKind = partner?.kind ?? null;
    this.partnerId = partner?.id ?? null;
    this.renderInventory();
  }

  private renderInventory(): void {
    const partner = this.getPartnerContainer();
    this.ctx.overlay.showInventory({
      title: 'Inventory',
      player: this.save.inventory,
      hotbarSize: this.save.hotbarSize,
      partner: partner
        ? { id: partner.id, title: partner.title, container: partner.container }
        : undefined,
      catalog: this.catalog,
      onMove: (move) => this.applyMove(move),
      onClose: () => this.closeInventory(),
    });
  }

  private getPartnerContainer(): { id: string; title: string; container: Container } | null {
    if (this.partnerKind === 'chest' && this.partnerId) {
      const c = this.save.chests[this.partnerId];
      if (!c) return null;
      return { id: this.partnerId, title: 'Porch Chest', container: c };
    }
    if (this.partnerKind === 'shipping-bin') {
      return { id: 'shipping-bin', title: 'Shipping Bin', container: this.save.shippingBin };
    }
    return null;
  }

  private setPartnerContainer(container: Container): void {
    if (this.partnerKind === 'chest' && this.partnerId) {
      this.save.chests[this.partnerId] = container;
    } else if (this.partnerKind === 'shipping-bin') {
      this.save.shippingBin = container;
    }
  }

  private applyMove(move: SlotMove): void {
    const player = this.save.inventory;
    const partner = this.getPartnerContainer()?.container ?? null;

    if (move.toContainer === 'trash') {
      const src = move.fromContainer === 'player' ? player : partner;
      if (!src) return;
      if (move.fromContainer === 'player') this.save.inventory = clearSlot(src, move.fromIndex);
      else if (partner) this.setPartnerContainer(clearSlot(src, move.fromIndex));
    } else if (move.fromContainer === move.toContainer) {
      const src = move.fromContainer === 'player' ? player : partner;
      if (!src || move.toIndex === null) return;
      const next = placeOrMerge(src, move.fromIndex, move.toIndex);
      if (move.fromContainer === 'player') this.save.inventory = next;
      else this.setPartnerContainer(next);
    } else if (partner) {
      const from = move.fromContainer === 'player' ? player : partner;
      const to = move.toContainer === 'player' ? player : partner;
      const result = moveBetween(from, to, move.fromIndex, move.toIndex ?? undefined);
      if (move.fromContainer === 'player') {
        this.save.inventory = result.from;
        this.setPartnerContainer(result.to);
      } else {
        this.setPartnerContainer(result.from);
        this.save.inventory = result.to;
      }
    }

    persistActiveSave();
    this.renderInventory();
    this.refreshHotbar();
  }

  private closeInventory(): void {
    this.inventoryOpen = false;
    this.partnerKind = null;
    this.partnerId = null;
    this.refreshHud();
  }

  private handlePlotInteract(): void {
    const cell = this.nearestPlotCell();
    if (!cell) return;
    const key = plantingKey(FarmScene.SCENE_KEY, cell.col, cell.row);
    const planting = this.save.plantings[key];
    const stack = this.save.inventory.slots[this.selectedHotbar];
    const tool = stack ? null : TOOLS[this.selectedTool];

    if (planting) {
      const crop = this.cropIndex.get(planting.cropId);
      if (crop && isHarvestReady(crop, planting)) {
        this.doHarvest(key, crop, planting);
        return;
      }
      if (tool === 'Watering Can' && !planting.watered) {
        this.applyToolStamina('watering-can');
        this.waterArea(cell);
        return;
      }
      this.flashAction(`Growing: ${crop?.name ?? planting.cropId}`);
      return;
    }

    if (stack && this.seedToCropId.has(stack.itemId)) {
      const cropId = this.seedToCropId.get(stack.itemId)!;
      this.save.plantings = {
        ...this.save.plantings,
        [key]: newPlanting(cropId),
      };
      const after = removeItem(this.save.inventory, stack.itemId, 1);
      this.save.inventory = after.container;
      recordSkillXp('cultivation', 2);
      this.flashAction(`Planted ${this.cropIndex.get(cropId)?.name ?? cropId}`);
      this.refreshCropMeshes();
      this.refreshHotbar();
      persistActiveSave();
      return;
    }

    if (tool === 'Watering Can') {
      this.flashAction('Nothing planted here yet');
      return;
    }

    this.flashAction('Select a seed in the hotbar to plant');
  }

  private toolLevel(id: ToolId): number {
    return this.save.toolLevels[id] ?? 0;
  }

  private applyToolStamina(id: ToolId): void {
    const cost = staminaCost(id, this.toolLevel(id));
    this.controller = {
      ...this.controller,
      stamina: Math.max(0, this.controller.stamina - cost),
    };
  }

  private waterArea(center: { col: number; row: number }): void {
    const level = this.toolLevel('watering-can');
    const offsets = aoeOffsets(aoeAt('watering-can', level));
    const next = { ...this.save.plantings };
    let touched = 0;
    for (const o of offsets) {
      const k = plantingKey(FarmScene.SCENE_KEY, center.col + o.dc, center.row + o.dr);
      const p = next[k];
      if (p && !p.watered) {
        next[k] = { ...p, watered: true };
        touched += 1;
      }
    }
    this.save.plantings = next;
    this.flashAction(touched === 1 ? 'Watered the crop' : `Watered ${touched} crops`);
    this.refreshCropMeshes();
    persistActiveSave();
  }

  private nearestPlotCell(): { col: number; row: number } | null {
    const localX = this.player.position.x - this.plotOrigin.x;
    const localZ = this.player.position.z - this.plotOrigin.z;
    return this.grid.worldToCell(localX, localZ);
  }

  private doHarvest(key: string, crop: Crop, planting: import('../engine/soil').Planting): void {
    const result = harvest(crop, planting, this.save.calendar.day + this.save.calendar.year * 31);
    if (!result.harvested) return;
    const added = addItem(this.save.inventory, result.produceItemId, 1, result.quality);
    this.save.inventory = added.container;
    if (result.next) {
      this.save.plantings = { ...this.save.plantings, [key]: result.next };
    } else {
      const { [key]: _drop, ...rest } = this.save.plantings;
      void _drop;
      this.save.plantings = rest;
    }
    recordSkillXp('cultivation', 5);
    const item = getItem(this.catalog, result.produceItemId);
    this.flashAction(`Harvested ${item?.name ?? result.produceItemId}`);
    this.refreshCropMeshes();
    this.refreshHotbar();
    persistActiveSave();
  }

  private flashAction(label: string): void {
    this.actionLabel = label;
    this.actionTimer = 1.6;
  }

  private refreshCropMeshes(): void {
    if (!this.scene) return;
    const seen = new Set<string>();
    for (const [key, planting] of Object.entries(this.save.plantings)) {
      if (!key.startsWith(`${FarmScene.SCENE_KEY}:`)) continue;
      const [, coord] = key.split(':');
      const [colStr, rowStr] = (coord ?? '').split(',');
      const col = Number(colStr);
      const row = Number(rowStr);
      if (!Number.isFinite(col) || !Number.isFinite(row)) continue;
      const localKey = `${col},${row}`;
      seen.add(localKey);
      const crop = this.cropIndex.get(planting.cropId);
      const ready = crop ? isHarvestReady(crop, planting) : false;
      const stage = ready ? 1 : Math.min(0.85, 0.25 + planting.daysGrown * 0.12);
      let mesh = this.cropMeshes.get(localKey);
      if (!mesh) {
        const local = this.grid.cellToWorld(col, row);
        mesh = MeshBuilder.CreateCylinder(
          `crop-${localKey}`,
          { height: 1, diameterTop: 0, diameterBottom: 0.6, tessellation: 6 },
          this.scene,
        );
        mesh.position.set(this.plotOrigin.x + local.x, 0.55, this.plotOrigin.z + local.z);
        this.cropMeshes.set(localKey, mesh);
      }
      mesh.scaling.y = stage;
      mesh.position.y = 0.12 + (mesh.scaling.y * 1.0) / 2;
      mesh.material = flatMaterial(
        this.scene,
        `crop-mat-${localKey}-${ready ? 'r' : 'g'}`,
        ready ? PALETTE.roof : PALETTE.grassAlt,
        0.25,
      );
      // Recolor the soil tile to indicate watered state.
      const cellMesh = this.cellMeshes.get(localKey);
      if (cellMesh) {
        cellMesh.material = flatMaterial(
          this.scene,
          `soil-${localKey}-${planting.watered ? 'wet' : 'dry'}`,
          planting.watered ? PALETTE.wood : PALETTE.soil,
          0.22,
        );
      }
    }
    // Remove crop meshes that no longer have a planting (harvested / wilted).
    for (const [localKey, mesh] of this.cropMeshes) {
      if (seen.has(localKey)) continue;
      mesh.dispose();
      this.cropMeshes.delete(localKey);
      const cellMesh = this.cellMeshes.get(localKey);
      if (cellMesh) {
        cellMesh.material = flatMaterial(this.scene, `soil-${localKey}-dry`, PALETTE.soil, 0.22);
      }
    }
  }

  private rebuildInteractionTargets(): void {
    const base: InteractTarget[] = [
      { id: 'farmhouse-door', kind: 'door', label: 'Enter the farmhouse', x: -10, z: -5.6, radius: 2.6, priority: 5 },
      { id: 'shipping-bin', kind: 'prop', label: 'Open the shipping bin', x: -6.2, z: -7.6, radius: 2.2, priority: 4 },
      { id: 'porch-chest', kind: 'prop', label: 'Open the porch chest', x: -12, z: -6, radius: 2.2, priority: 4 },
      { id: 'tilled-plot', kind: 'farm-cell', label: 'Tend the soil', x: -6, z: -4, radius: 4, priority: 3 },
      { id: 'tide-pond', kind: 'water-entry', label: 'Check the tide pond', x: 10, z: -2, radius: 4.4, priority: 2 },
    ];
    // World entities (forage / tree / stump / debris / grass).
    for (const [key, entity] of Object.entries(this.save.worldEntities)) {
      const suffix = farmEntitySuffix(key);
      if (!suffix) continue;
      const anchor = anchorFor(suffix);
      if (!anchor) continue;
      base.push({
        id: `entity:${suffix}`,
        kind: entity.kind === 'forage' ? 'pickup' : 'prop',
        label: entityLabel(entity),
        x: anchor.x,
        z: anchor.z,
        radius: anchor.radius ?? 1.4,
        priority: entity.kind === 'forage' ? 3 : 2,
      });
    }
    this.targets = base;
  }

  private refreshEntityMeshes(): void {
    if (!this.scene) return;
    const seen = new Set<string>();
    for (const [key, entity] of Object.entries(this.save.worldEntities)) {
      const suffix = farmEntitySuffix(key);
      if (!suffix) continue;
      const anchor = anchorFor(suffix);
      if (!anchor) continue;
      seen.add(suffix);
      const existing = this.entityMeshes.get(suffix);
      const expectedName = `${entity.kind}-${suffix}`;
      // Reuse the mesh when its kind hasn't changed; otherwise rebuild.
      if (existing && existing.name.startsWith(`${entity.kind}-${suffix}`)) {
        continue;
      }
      existing?.dispose();
      const mesh = buildEntityMesh(this.scene, suffix, entity, anchor);
      void expectedName;
      this.entityMeshes.set(suffix, mesh);
    }
    for (const [suffix, mesh] of this.entityMeshes) {
      if (seen.has(suffix)) continue;
      mesh.dispose();
      this.entityMeshes.delete(suffix);
    }
  }

  private currentEntityToolHardness(): number {
    const stack = this.save.inventory.slots[this.selectedHotbar];
    if (stack) return 1; // forage items pop with any pickup intent
    const toolId = FARM_TOOL_IDS[this.selectedTool];
    if (!toolId) return 1;
    return hardnessReach(toolId, this.save.toolLevels[toolId] ?? 0);
  }

  private handleEntityInteract(suffix: string): void {
    const key = `Farm:${suffix}`;
    const entity: WorldEntity | undefined = this.save.worldEntities[key];
    if (!entity) return;
    const hardness = this.currentEntityToolHardness();
    const result = collect(entity, hardness);
    if (!result.reward && result.next === entity) {
      // Tool not strong enough — give a hint to the player.
      const toolId = FARM_TOOL_IDS[this.selectedTool];
      this.flashAction(
        toolId === 'axe'
          ? 'The axe needs more sharpening' // unreachable today; placeholder
          : 'Need the axe to chop this tree',
      );
      return;
    }

    // Apply stamina cost when a tool action was required.
    if (entity.kind === 'tree' || entity.kind === 'debris' || entity.kind === 'stump') {
      const toolId = FARM_TOOL_IDS[this.selectedTool];
      if (toolId) this.applyToolStamina(toolId);
    }

    // Drop the reward into the player's inventory.
    if (result.reward) {
      const added = addItem(
        this.save.inventory,
        result.reward.itemId,
        result.reward.qty,
        0,
      );
      this.save.inventory = added.container;
    }

    // Update the world entity (consumed or transformed).
    const next = { ...this.save.worldEntities };
    if (result.next) {
      next[key] = result.next;
    } else {
      delete next[key];
    }
    this.save.worldEntities = next;

    recordSkillXp(
      entity.kind === 'tree' || entity.kind === 'debris' ? 'foraging' : 'foraging',
      entity.kind === 'tree' ? 6 : entity.kind === 'debris' ? 3 : 2,
    );
    this.flashAction(entityLabel(entity));
    this.refreshEntityMeshes();
    this.rebuildInteractionTargets();
    this.refreshHotbar();
    persistActiveSave();
  }

  private triggerSleep(collapsed: boolean): void {
    if (this.dayResolving) return;
    this.dayResolving = true;
    this.clock = pauseClock(this.clock, true);

    const content = loadGameContent();
    const ledger = getDayLedger();
    const result = resolveDay({
      save: this.save,
      ledger,
      collapsed,
      festivals: content.festivals,
      npcs: content.npcs,
      items: content.items,
      crops: content.crops,
      todayWeatherId: this.weather?.id ?? null,
    });

    resetDayLedger();
    applyGameTime(this.save, result.nextTime);
    if (result.collapse) {
      this.controller = { ...this.controller, stamina: result.collapse.wakeStamina };
    } else {
      this.controller = { ...this.controller, stamina: 100 };
    }
    persistActiveSave();
    this.clock = setClockTime(this.clock, result.nextTime);
    this.player.position.copyFrom(this.homePosition);
    this.refreshWorldState();

    this.ctx.overlay.showDaySummary(result.summary, () => {
      this.dayResolving = false;
      this.menuOpen = false;
      this.clock = pauseClock(this.clock, false);
      this.refreshCropMeshes();
      this.refreshEntityMeshes();
      this.rebuildInteractionTargets();
      this.refreshHud();
    });
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
