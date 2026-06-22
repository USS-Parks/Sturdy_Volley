import {
  Scene,
  ArcRotateCamera,
  MeshBuilder,
  Vector3,
  Color3,
  StandardMaterial,
  PointerEventTypes,
  Tools,
  type AbstractMesh,
  type Observer,
  type PointerInfo,
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
import { buy, hoursFor, isShopOpen, restockShop } from '../engine/shops';
import { addItem, removeItem, countItem } from '../engine/inventory';
import type { Item } from '../data/schemas';
import {
  RECIPE_UNLOCK_SOURCES,
  buildCraftingPanelRecipes,
  craft,
  isPlaceable,
  listPlacements,
  loadRecipesFromContent,
  placeCrafted,
  removePlacement,
  unlockRecipes,
  type Placement,
} from '../engine/crafting';
import {
  buildDecorateRows,
  buildRenovationRows,
  buildSurfaceRows,
  earnedTrophies,
  furnitureById,
  getHomeState,
  loadFurnitureFromContent,
  purchaseRenovation,
  renovationDef,
  setSurface,
  surfaceSwatch,
  type SurfaceKind,
} from '../engine/home';
import {
  buildWardrobeParts,
  setAppearancePart,
  APPEARANCE_PARTS,
  type AppearancePart,
} from '../engine/appearance';
import { applyPlayerAppearance } from '../render/player-appearance';
import { applySceneAudio, bindSceneAudioSettings } from '../audio/scene-audio';
import { getAudioDirector } from '../audio/audio-director';
import { audioMixRows, musicTrack, type AudioCategory } from '../engine/audio-model';
import type { Furniture, GameContent } from '../data/schemas';
import type { HomeTab } from '../ui/overlay';
import { writeSave } from '../engine/save';
import { recordActiveQuestEvent } from '../engine/quest-tracking';
import { eatActiveFood, activeBuffRows } from '../engine/buff-tracking';
import { describeBuff, isEdible } from '../engine/buffs';
import { formatWorldStatus } from '../engine/format';
import { computeMoveVector, type MoveInput } from '../engine/movement';
import { createControllerState, stepController, DEFAULT_CONTROLLER_CONFIG, type ControllerState } from '../engine/controller';
import { resolveInteraction, type InteractTarget } from '../engine/interaction';
import type { SaveData } from '../engine/saveModel';
import { loadGameContent } from '../data/content';
import { forecastFor } from '../engine/weather';
import { tideStateAt, type TideState } from '../engine/tide';
import { applyGameTime, getGameTime, resolveDay } from '../engine/dayResolution';
import {
  createTimeClock,
  pauseClock,
  setClockTime,
  tickClock,
  type TimeClockState,
} from '../engine/timeClock';
import type { Weather } from '../data/schemas';

interface InteriorDebugApi {
  openCrafting: () => void;
  openShop: () => void;
  placedDecor: () => Array<{ id: string; itemId: string; x: number; z: number }>;
  grantStarterIngredients: () => void;
  grantItem: (itemId: string, qty: number) => void;
  grantRecipe: (recipeId: string) => void;
  knownRecipes: () => readonly string[];
  // Prompt 059 — cooking + buffs.
  openKitchen: () => void;
  cook: (recipeId: string) => { cooked: boolean };
  eat: (itemId: string) => { eaten: boolean; staminaRestore: number; buffLabel: string | null };
  activeBuffs: () => Array<{ effect: string; label: string; minutesLeft: number }>;
  // Prompt 060 — home, decor, and customization.
  gold: () => number;
  grantGold: (amount: number) => void;
  openHome: () => void;
  homeTab: () => HomeTab;
  setHomeTab: (tab: HomeTab) => void;
  placeFurniture: (
    furnitureId: string,
    x: number,
    z: number,
    rot?: number,
  ) => { placed: boolean };
  pickUpLastPlacement: () => { removed: boolean };
  setWallpaper: (id: string) => void;
  setFlooring: (id: string) => void;
  homeSurfaces: () => { wallpaper: string; flooring: string; renovations: string[] };
  buyRenovation: (id: string) => { built: boolean };
  setAppearancePart: (part: string, swatchId: string) => void;
  appearance: () => { body: string; beanie: string; accent: string };
  playerBodyColorHex: () => string;
  enterPhotoMode: () => void;
  exitPhotoMode: () => void;
  photoModeActive: () => boolean;
  capturePhoto: () => Promise<boolean>;
}

/**
 * Graybox colour per furniture category (Prompt 060). Faceted flat materials in
 * the Theme-3 palette so placeholders read clearly until real `.glb` art lands.
 */
const FURNITURE_CATEGORY_COLOR: Record<Furniture['category'], Color3> = {
  seat: PALETTE.wood,
  table: PALETTE.wood,
  shelf: PALETTE.wood,
  rug: PALETTE.accent,
  lamp: PALETTE.stone,
  plant: PALETTE.grass,
  banner: PALETTE.roof,
  'trophy-shelf': PALETTE.wood,
  curio: PALETTE.stone,
};

interface InteriorEntryData {
  /** Anchor id the player should spawn at on entry. */
  entry?: 'inside-door' | 'bed';
  /** When entering from a Town building, where to return on exit + title shown. */
  shopId?: string;
}

/**
 * Per-item graybox geometry for placed crafted decor (Prompt 017). Each
 * entry returns the constructed mesh; the InteriorScene tracks them so a
 * scene re-enter or dispose can clear them cleanly.
 */
function buildPlacementMesh(
  scene: Scene,
  p: { id: string; itemId: string; x: number; z: number },
): AbstractMesh {
  if (p.itemId === 'driftwood-shelf') {
    const top = MeshBuilder.CreateBox(p.id, { width: 1.2, depth: 0.45, height: 0.18 }, scene);
    top.position.set(p.x, 1.1, p.z);
    top.material = flatMaterial(scene, `${p.id}-top`, PALETTE.wood, 0.22);
    return top;
  }
  // Fallback: a small cube for unrecognised decor (kept readable in graybox).
  const box = MeshBuilder.CreateBox(p.id, { size: 0.6 }, scene);
  box.position.set(p.x, 0.3, p.z);
  box.material = flatMaterial(scene, p.id, PALETTE.accent, 0.3);
  return box;
}

const SHOP_TITLES: Record<string, string> = {
  'market-bakery': 'Bakery',
  'market-clinic': 'Clinic',
  'market-library': 'Library',
  'market-gear': 'Gear Shop',
  'fishmonger': 'Fishmonger',
  'community-hall': 'Community Hall',
  'schoolhouse': 'Schoolhouse',
  'blacksmith': 'Blacksmith',
  'apartments': 'Apartments',
};

/**
 * The farmhouse interior (VS-A3). One-room graybox: floor, four walls + a
 * doorway, a bed (sleep trigger), kitchen counter, table, hearth, chest, and
 * an exit door back to the Farm. Camera reframes closer + lower than the
 * outdoor scenes.
 */
export class InteriorScene extends GameScene {
  private camera!: ArcRotateCamera;
  private player!: AbstractMesh;
  private save!: SaveData;
  private controller: ControllerState = createControllerState();
  private clock!: TimeClockState;
  private weather: Weather | null = null;
  private tide: TideState = 'low';
  private targets: InteractTarget[] = [];
  private nearest: InteractTarget | null = null;
  private actionTimer = 0;
  private actionLabel = '';
  private hudTimer = 0;
  private menuOpen = false;
  private dayResolving = false;
  private ePrev = false;
  private readonly pressed = new Set<string>();
  private readonly onKeyDown = (e: KeyboardEvent) => this.pressed.add(e.key.toLowerCase());
  private readonly onKeyUp = (e: KeyboardEvent) => this.pressed.delete(e.key.toLowerCase());

  private readonly insideDoorAnchor = new Vector3(0, 0.9, 4.5);
  private readonly bedAnchor = new Vector3(-3, 0.9, -2);
  private returnTarget: 'Farm' | 'Town' = 'Farm';
  private title = 'Farmhouse';
  private shopId: string | null = null;
  private shopOpen = false;
  private craftingOpen = false;
  /** Prompt 059: the kitchen cooking/eating panel is open. */
  private cookingOpen = false;
  private readonly workbenchAnchor = new Vector3(2.4, 0, -3.6);
  private readonly dresserAnchor = new Vector3(-5.2, 0, -4.4);
  private readonly placementRoot = new Vector3(-2.5, 0, -4.8);
  private placementMeshes: AbstractMesh[] = [];

  /* Prompt 060 — home, decor, and customization. */
  private content!: GameContent;
  private furnitureCatalog: ReadonlyMap<string, Furniture> = new Map();
  private homeOpen = false;
  private homeTab: HomeTab = 'decorate';
  private photoMode = false;
  private audioPanelOpen = false;
  private floorMesh: AbstractMesh | null = null;
  private wallMeshes: AbstractMesh[] = [];
  private renovationMeshes: AbstractMesh[] = [];
  private placement: { furnitureId: string; ghost: AbstractMesh; rot: number } | null = null;
  private placementObserver: Observer<PointerInfo> | null = null;
  private readonly roomHalf = 5.2;

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    scene.collisionsEnabled = true;
    addFog(scene, PALETTE.interior, 0.012);
    addLights(scene);

    // Closer + lower indoor camera (per docs/SCALE_AND_PERFORMANCE.md §1).
    this.camera = new ArcRotateCamera(
      'interior-cam',
      -Math.PI / 2 + 0.4,
      Math.PI / 2.6,
      10,
      Vector3.Zero(),
      scene,
    );
    this.camera.fov = 0.85;

    this.buildShell(scene);
    this.buildFurniture(scene);

    const player = MeshBuilder.CreateCapsule('player', { height: 1.8, radius: 0.4 }, scene);
    player.position.set(0, 0.9, 4.0);
    player.material = flatMaterial(scene, 'player', PALETTE.player, 0.35);
    player.checkCollisions = true;
    player.ellipsoid = new Vector3(0.4, 0.9, 0.4);
    this.player = player;
    this.camera.lockedTarget = player;

    this.scene = scene;
    return scene;
  }

  private buildShell(scene: Scene): void {
    // Floor.
    const floor = MeshBuilder.CreateGround('floor', { width: 12, height: 12 }, scene);
    floor.material = flatMaterial(scene, 'floor', PALETTE.wood, 0.22);
    floor.checkCollisions = true;
    this.floorMesh = floor;

    // Four walls — north has a 1.2m doorway gap centered on x=0.
    this.wallMeshes = [];
    const wall = (name: string, w: number, d: number, x: number, z: number, h = 3.0) => {
      const mesh = MeshBuilder.CreateBox(name, { width: w, depth: d, height: h }, scene);
      mesh.position.set(x, h / 2, z);
      mesh.material = flatMaterial(scene, name, PALETTE.cliff, 0.18);
      mesh.checkCollisions = true;
      this.wallMeshes.push(mesh);
      return mesh;
    };
    wall('wall-s-left', 5.4, 0.3, -3.3, 6);
    wall('wall-s-right', 5.4, 0.3, 3.3, 6);
    wall('wall-n', 12, 0.3, 0, -6);
    wall('wall-w', 0.3, 12, -6, 0);
    wall('wall-e', 0.3, 12, 6, 0);

    // Doorway header (the gap between the two south wall sections).
    const header = MeshBuilder.CreateBox('wall-s-header', { width: 1.2, depth: 0.3, height: 1.2 }, scene);
    header.position.set(0, 2.4, 6);
    header.material = flatMaterial(scene, 'wall-s-header', PALETTE.cliff, 0.18);
    header.checkCollisions = true;
    this.wallMeshes.push(header);

    // Ceiling beams (optional flavor — no collision).
    ([-3, 0, 3] as const).forEach((x, i) => {
      const beam = MeshBuilder.CreateBox(`beam${i}`, { width: 0.25, depth: 12, height: 0.25 }, scene);
      beam.position.set(x, 2.85, 0);
      beam.material = flatMaterial(scene, `beam${i}`, PALETTE.wood, 0.18);
    });
  }

  private buildFurniture(scene: Scene): void {
    // Bed (south-west corner).
    const bedBase = MeshBuilder.CreateBox('bed-base', { width: 2.2, depth: 1.3, height: 0.5 }, scene);
    bedBase.position.set(-3, 0.25, -2);
    bedBase.material = flatMaterial(scene, 'bed-base', PALETTE.wood, 0.2);
    bedBase.checkCollisions = true;
    const bedQuilt = MeshBuilder.CreateBox('bed-quilt', { width: 2.0, depth: 1.15, height: 0.18 }, scene);
    bedQuilt.position.set(-3, 0.59, -2);
    bedQuilt.material = flatMaterial(scene, 'bed-quilt', PALETTE.accent, 0.3);

    // Kitchen counter (east wall).
    const counter = MeshBuilder.CreateBox('counter', { width: 0.9, depth: 4, height: 0.9 }, scene);
    counter.position.set(4.8, 0.45, -1);
    counter.material = flatMaterial(scene, 'counter', PALETTE.wood, 0.22);
    counter.checkCollisions = true;

    // Hearth (north-east).
    const hearth = MeshBuilder.CreateBox('hearth', { width: 1.6, depth: 1.0, height: 1.4 }, scene);
    hearth.position.set(4.5, 0.7, -5.0);
    hearth.material = flatMaterial(scene, 'hearth', PALETTE.cliff, 0.22);
    hearth.checkCollisions = true;
    const fire = MeshBuilder.CreateSphere('hearth-fire', { diameter: 0.6 }, scene);
    fire.position.set(4.5, 0.6, -4.6);
    fire.material = flatMaterial(scene, 'hearth-fire', PALETTE.warmLight, 0.55);

    // Table + chairs (center).
    const table = MeshBuilder.CreateBox('table', { width: 1.8, depth: 1.0, height: 0.8 }, scene);
    table.position.set(0, 0.4, 0.5);
    table.material = flatMaterial(scene, 'table', PALETTE.wood, 0.22);
    table.checkCollisions = true;

    // Interior chest (west wall).
    const chest = MeshBuilder.CreateBox('interior-chest', { width: 1.1, depth: 0.75, height: 0.75 }, scene);
    chest.position.set(-5.2, 0.38, 3);
    chest.material = flatMaterial(scene, 'interior-chest', PALETTE.wood, 0.22);
    chest.checkCollisions = true;

    // Crafting workbench (Prompt 017) — between hearth and chest along the north wall.
    const benchTop = MeshBuilder.CreateBox('workbench-top', { width: 1.8, depth: 0.9, height: 0.9 }, scene);
    benchTop.position.copyFrom(this.workbenchAnchor);
    benchTop.position.y = 0.45;
    benchTop.material = flatMaterial(scene, 'workbench-top', PALETTE.wood, 0.24);
    benchTop.checkCollisions = true;
    // A small mallet on the bench so it reads as a work surface, not a table.
    const mallet = MeshBuilder.CreateBox('workbench-mallet', { width: 0.25, depth: 0.55, height: 0.18 }, scene);
    mallet.position.set(this.workbenchAnchor.x + 0.3, 1.0, this.workbenchAnchor.z);
    mallet.material = flatMaterial(scene, 'workbench-mallet', PALETTE.accent, 0.3);

    // Wardrobe dresser (Prompt 060) — the in-world surface that opens the Home
    // (decorate / surfaces / renovate / wardrobe / photo) panel.
    const dresser = MeshBuilder.CreateBox('dresser', { width: 1.1, depth: 0.55, height: 1.2 }, scene);
    dresser.position.set(this.dresserAnchor.x, 0.6, this.dresserAnchor.z);
    dresser.material = flatMaterial(scene, 'dresser', PALETTE.wood, 0.24);
    dresser.checkCollisions = true;
    const mirror = MeshBuilder.CreateBox('dresser-mirror', { width: 0.7, depth: 0.08, height: 0.9 }, scene);
    mirror.position.set(this.dresserAnchor.x, 1.6, this.dresserAnchor.z);
    mirror.material = flatMaterial(scene, 'dresser-mirror', PALETTE.accent, 0.4);
  }

  override enter(data?: unknown): void {
    const save = getActiveSave();
    if (!save) {
      this.goTo('Title', undefined, false);
      return;
    }
    this.save = save;
    save.location.sceneKey = 'Interior';
    writeSave(save);

    this.content = loadGameContent();
    this.furnitureCatalog = furnitureById(this.content);

    this.controller = createControllerState();
    this.clock = createTimeClock(getGameTime(save));
    this.refreshWorldState();

    // Spawn at the requested anchor (defaults to inside-door).
    const entryData: InteriorEntryData =
      typeof data === 'object' && data !== null ? (data as InteriorEntryData) : {};
    const entry = entryData.entry ?? 'inside-door';
    const spawn = entry === 'bed' ? this.bedAnchor : this.insideDoorAnchor;
    this.player.position.copyFrom(spawn);
    // RF-15: pick the title + return target based on shopId.
    if (entryData.shopId) {
      // Prefer the content shop name when available; fall back to SHOP_TITLES.
      const content = loadGameContent();
      const shop = content.shops.find((s) => s.id === entryData.shopId);
      this.title = shop?.name ?? SHOP_TITLES[entryData.shopId] ?? 'Shop';
      this.returnTarget = 'Town';
      this.shopId = entryData.shopId;
    } else {
      this.title = 'Farmhouse';
      this.returnTarget = 'Farm';
      this.shopId = null;
    }

    this.targets = [
      { id: 'inside-door', kind: 'door', label: 'Step outside', x: 0, z: 5.6, radius: 1.6, priority: 5 },
      { id: 'bed', kind: 'prop', label: 'Sleep until tomorrow', x: -3, z: -2, radius: 1.7, priority: 4 },
      { id: 'kitchen', kind: 'prop', label: 'Tidy the kitchen', x: 4.8, z: -1, radius: 1.6, priority: 2 },
      { id: 'hearth', kind: 'prop', label: 'Tend the hearth', x: 4.5, z: -5, radius: 1.6, priority: 2 },
      { id: 'interior-chest', kind: 'prop', label: 'Open the chest', x: -5.2, z: 3, radius: 1.6, priority: 3 },
      {
        id: 'workbench',
        kind: 'machine',
        label: 'Craft at the workbench',
        x: this.workbenchAnchor.x,
        z: this.workbenchAnchor.z,
        radius: 1.8,
        priority: 3,
      },
      {
        id: 'dresser',
        kind: 'prop',
        label: 'Decorate your home',
        x: this.dresserAnchor.x,
        z: this.dresserAnchor.z,
        radius: 1.7,
        priority: 3,
      },
    ];
    if (this.shopId) {
      // Place a shop counter target at the kitchen counter spot.
      this.targets = this.targets.filter((t) => t.id !== 'kitchen');
      this.targets.push({
        id: 'shop-counter',
        kind: 'prop',
        label: `Browse ${this.title}`,
        x: 4.8,
        z: -1,
        radius: 1.6,
        priority: 4,
      });
    }

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.menuOpen = false;
    this.dayResolving = false;
    this.craftingOpen = false;
    this.cookingOpen = false;
    this.homeOpen = false;
    this.photoMode = false;
    this.placement = null;
    this.audioPanelOpen = false;
    // Prompt 061: load mixer settings + persist on change (audio context applied
    // from refreshWorldState, which already ran above with weather + clock set).
    bindSceneAudioSettings(save, () => persistActiveSave());
    // Prompt 060: reflect wardrobe choices + home customization on entry.
    if (this.scene) applyPlayerAppearance(this.scene, this.player, save.player.appearance);
    this.applyHomeSurfaces();
    this.applyRenovations();
    this.refreshPlacedDecor();
    this.refreshHud();

    // Prompt 017: per-scene debug hook for the crafting playwright spec.
    (window as unknown as { sturdyVolleyInterior?: InteriorDebugApi }).sturdyVolleyInterior = {
      openCrafting: () => this.openCrafting(),
      openShop: () => this.openShop(),
      placedDecor: () => listPlacements(this.save, 'Interior').map((p) => ({ ...p })),
      grantStarterIngredients: () => {
        const r = addItem(this.save.inventory, 'driftwood', 2);
        this.save.inventory = r.container;
        persistActiveSave();
      },
      grantItem: (itemId, qty) => {
        const r = addItem(this.save.inventory, itemId, qty);
        this.save.inventory = r.container;
        persistActiveSave();
      },
      grantRecipe: (recipeId) => {
        this.save.knownRecipeIds = unlockRecipes(this.save.knownRecipeIds, [recipeId]);
        persistActiveSave();
      },
      knownRecipes: () => [...this.save.knownRecipeIds],
      // Prompt 059 — cooking + buffs.
      openKitchen: () => this.openCooking(),
      cook: (recipeId: string) => ({ cooked: this.handleCookDish(recipeId) }),
      eat: (itemId: string) => this.handleEat(itemId),
      activeBuffs: () => activeBuffRows().map((b) => ({ effect: b.effect, label: b.label, minutesLeft: b.minutesLeft })),
      // Prompt 060 — home, decor, and customization.
      gold: () => this.save.wallet.gold,
      grantGold: (amount: number) => {
        this.save.wallet.gold = Math.max(0, this.save.wallet.gold + amount);
        persistActiveSave();
        if (this.homeOpen) this.renderHome();
      },
      openHome: () => this.openHome(),
      homeTab: () => this.homeTab,
      setHomeTab: (tab) => this.setHomeTab(tab),
      placeFurniture: (furnitureId, x, z, rot = 0) => ({
        placed: this.commitFurniture(furnitureId, x, z, rot) !== null,
      }),
      pickUpLastPlacement: () => {
        const placed = listPlacements(this.save, 'Interior');
        const last = placed[placed.length - 1];
        if (!last) return { removed: false };
        return { removed: this.pickUpPlacement(last.id) };
      },
      setWallpaper: (id) => this.setSurfaceChoice('wallpaper', id),
      setFlooring: (id) => this.setSurfaceChoice('flooring', id),
      homeSurfaces: () => {
        const s = getHomeState(this.save, 'Interior');
        return { wallpaper: s.wallpaper, flooring: s.flooring, renovations: [...s.renovations] };
      },
      buyRenovation: (id) => ({ built: this.buyRenovation(id) }),
      setAppearancePart: (part, swatchId) => this.changeAppearance(part, swatchId),
      appearance: () => ({ ...this.save.player.appearance }),
      playerBodyColorHex: () => this.playerBodyColorHex(),
      enterPhotoMode: () => this.enterPhotoMode(),
      exitPhotoMode: () => this.exitPhotoMode(),
      photoModeActive: () => this.photoMode,
      capturePhoto: () => this.capturePhoto(),
    };
  }

  override update(dt: number): void {
    if (!this.player || !this.save) return;
    if (
      this.menuOpen ||
      this.dayResolving ||
      this.shopOpen ||
      this.craftingOpen ||
      this.cookingOpen ||
      this.homeOpen ||
      this.photoMode ||
      this.placement ||
      this.audioPanelOpen
    ) {
      this.clock = pauseClock(this.clock, true);
      this.controller = stepController(this.controller, { dir: { x: 0, z: 0 }, sprint: false }, dt);
      return;
    }
    if (this.clock.paused) this.clock = pauseClock(this.clock, false);

    const dir = this.cameraRelativeDir(computeMoveVector(this.readInput()));
    const sprint = this.pressed.has('shift');
    this.controller = stepController(this.controller, { dir, sprint }, dt);
    if (this.controller.speed > 0.01 && (dir.x !== 0 || dir.z !== 0)) {
      this.player.moveWithCollisions(new Vector3(dir.x, 0, dir.z).scale(this.controller.speed * dt));
    }

    this.nearest = resolveInteraction(this.targets, this.player.position.x, this.player.position.z);

    const interact = this.pressed.has('e') || this.pressed.has(' ');
    if (interact && !this.ePrev && this.nearest) {
      if (this.nearest.id === 'inside-door') this.exitToFarm();
      else if (this.nearest.id === 'bed') this.triggerSleep(false);
      else if (this.nearest.id === 'shop-counter') this.openShop();
      else if (this.nearest.id === 'workbench') this.openCrafting();
      else if (this.nearest.id === 'kitchen') this.openCooking();
      else if (this.nearest.id === 'dresser') this.openHome();
      else {
        this.actionLabel = this.nearest.label;
        this.actionTimer = 1.6;
      }
    }
    this.ePrev = interact;
    if (this.actionTimer > 0) this.actionTimer -= dt;

    const tick = tickClock(this.clock, dt);
    this.clock = tick.state;
    if (tick.advancedMinutes > 0) applyGameTime(this.save, this.clock.time);
    if (tick.collapsed) {
      this.triggerSleep(true);
      return;
    }

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.3;
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

  private readInput(): MoveInput {
    const p = this.pressed;
    return {
      up: p.has('w') || p.has('arrowup'),
      down: p.has('s') || p.has('arrowdown'),
      left: p.has('a') || p.has('arrowleft'),
      right: p.has('d') || p.has('arrowright'),
    };
  }

  private refreshWorldState(): void {
    const content = loadGameContent();
    this.weather = forecastFor(this.clock.time, content.weather);
    this.tide = tideStateAt(this.clock.time);
    // Prompt 061: the farmhouse soundtrack (hearth pad + crackle ambience).
    if (this.save) applySceneAudio('Interior', this.save, { weatherId: this.weather?.id ?? null });
  }

  private refreshHud(): void {
    const stamina = Math.round(this.controller.stamina);
    const status = formatWorldStatus(this.save, {
      weather: this.weather,
      tide: this.tide,
      gold: this.save.wallet.gold,
    });
    let line = `${status} · energy ${stamina}%`;
    if (this.actionTimer > 0) line += ` · ✔ ${this.actionLabel}`;
    else if (this.nearest) line += ` · [E] ${this.nearest.label}`;
    this.ctx.overlay.showHud(this.title, line, () => this.openMenu());
  }

  private openMenu(): void {
    this.menuOpen = true;
    this.ctx.overlay.showMenu(
      'Paused',
      [
        { id: 'resume', label: 'Resume', enabled: true, testId: 'pause-resume' },
        { id: 'audio', label: 'Audio', enabled: true, testId: 'pause-audio' },
        { id: 'sleep', label: 'Sleep until tomorrow', enabled: true, testId: 'pause-sleep' },
        { id: 'farm', label: 'Step outside', enabled: true, testId: 'nav-farm' },
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
      case 'audio':
        this.menuOpen = false;
        this.openAudioSettings();
        break;
      case 'sleep':
        this.menuOpen = false;
        this.triggerSleep(false);
        break;
      case 'farm':
        this.exitToFarm();
        break;
      case 'save-quit':
        persistActiveSave();
        clearActiveSave();
        this.goTo('Title');
        break;
    }
  }

  private openShop(): void {
    if (!this.shopId) return;
    const content = loadGameContent();
    const shop = content.shops.find((s) => s.id === this.shopId);
    if (!shop) return;
    const hours = hoursFor(this.shopId);
    const minutes = this.clock.time.minutes;
    const open = hours ? isShopOpen(hours, minutes, false) : true;
    if (!open) {
      this.actionLabel = `${this.title} is closed right now.`;
      this.actionTimer = 1.6;
      return;
    }
    const itemsById = new Map<string, Item>();
    for (const item of content.items) itemsById.set(item.id, item);
    const stock = restockShop({
      shop,
      itemsById,
      season: this.save.calendar.season,
      flags: Object.fromEntries(
        Object.entries(this.save.flags).filter(([, v]) => typeof v === 'boolean'),
      ) as Record<string, boolean>,
    });
    this.shopOpen = true;
    this.renderShop(stock.entries, content.items);
  }

  private renderShop(entries: ReturnType<typeof restockShop>['entries'], items: readonly Item[]): void {
    const itemsById = new Map(items.map((i) => [i.id, i]));
    const recipeOffers = this.buildRecipeOffersForCurrentShop();
    this.ctx.overlay.showShopPanel({
      shopName: this.title,
      walletGold: this.save.wallet.gold,
      entries: entries.map((e) => ({
        itemId: e.itemId,
        itemName: itemsById.get(e.itemId)?.name ?? e.itemId,
        price: e.price,
        remaining: e.remaining,
      })),
      recipeOffers,
      onBuy: (itemId) => this.handleBuy(itemId, entries, items),
      onBuyRecipe: (recipeId) => this.handleBuyRecipe(recipeId, entries, items),
      onClose: () => {
        this.shopOpen = false;
        this.refreshHud();
      },
    });
  }

  private buildRecipeOffersForCurrentShop(): import('../ui/overlay').ShopPanelRecipeOffer[] {
    if (!this.shopId) return [];
    const offers: import('../ui/overlay').ShopPanelRecipeOffer[] = [];
    const content = loadGameContent();
    for (const [recipeId, src] of Object.entries(RECIPE_UNLOCK_SOURCES)) {
      if (src.source !== 'shop') continue;
      if (src.shopId !== this.shopId) continue;
      const recipe = content.recipes.find((r) => r.id === recipeId);
      if (!recipe) continue;
      offers.push({
        recipeId,
        recipeName: recipe.name,
        price: src.price,
        knownAlready: this.save.knownRecipeIds.includes(recipeId),
      });
    }
    return offers;
  }

  private handleBuyRecipe(
    recipeId: string,
    entries: ReturnType<typeof restockShop>['entries'],
    items: readonly Item[],
  ): void {
    const src = RECIPE_UNLOCK_SOURCES[recipeId];
    if (!src || src.source !== 'shop') return;
    if (this.save.knownRecipeIds.includes(recipeId)) return;
    if (this.save.wallet.gold < src.price) return;
    this.save.wallet.gold -= src.price;
    this.save.knownRecipeIds = unlockRecipes(this.save.knownRecipeIds, [recipeId]);
    persistActiveSave();
    this.renderShop(entries, items);
  }

  private handleBuy(
    itemId: string,
    entries: ReturnType<typeof restockShop>['entries'],
    items: readonly Item[],
  ): void {
    const idx = entries.findIndex((e) => e.itemId === itemId);
    if (idx < 0) return;
    const entry = entries[idx]!;
    const result = buy({ wallet: this.save.wallet.gold, qty: 1, entry });
    if (!result.accepted) return;
    this.save.wallet.gold -= result.cost;
    entries[idx] = result.nextEntry;
    const added = addItem(this.save.inventory, itemId, 1, 0);
    this.save.inventory = added.container;
    persistActiveSave();
    this.renderShop(entries, items);
  }

  /* Prompt 059 — kitchen cooking + eating ----------------------------- */

  private openCooking(): void {
    this.cookingOpen = true;
    this.renderCooking();
  }

  private renderCooking(): void {
    const content = loadGameContent();
    const itemsById = new Map<string, Item>(content.items.map((i) => [i.id, i] as const));
    const recipes = loadRecipesFromContent(content);
    const cookingDefs = recipes.filter((r) => r.type === 'cooking');
    const rows = buildCraftingPanelRecipes({
      knownRecipeIds: this.save.knownRecipeIds,
      recipes: cookingDefs,
      itemsById,
      container: this.save.inventory,
    });
    const recipeRows = rows.map((r) => {
      const def = cookingDefs.find((x) => x.id === r.id)!;
      const out = itemsById.get(def.outputItemId);
      return {
        id: r.id,
        name: r.name,
        outputName: r.outputName,
        outputQty: r.outputQty,
        ingredients: r.ingredients.map((i) => ({ itemName: i.itemName, need: i.need, have: i.have })),
        canCook: r.canCraft,
        buffLabel: out?.buff ? describeBuff(out.buff) : null,
      };
    });

    // Pantry — edible items the player holds, summed by id.
    const held = new Map<string, number>();
    for (const slot of this.save.inventory.slots) {
      if (slot) held.set(slot.itemId, (held.get(slot.itemId) ?? 0) + slot.qty);
    }
    const pantry = [...held.entries()]
      .map(([itemId, qty]) => ({ itemId, qty, item: itemsById.get(itemId) }))
      .filter((e): e is { itemId: string; qty: number; item: Item } => !!e.item && isEdible(e.item))
      .map((e) => {
        const parts: string[] = [];
        if ((e.item.staminaRestore ?? 0) > 0) parts.push(`+${e.item.staminaRestore} stamina`);
        if (e.item.buff) parts.push(describeBuff(e.item.buff));
        return { itemId: e.itemId, name: e.item.name, qty: e.qty, effectLabel: parts.join(' · ') || 'A simple bite' };
      });

    this.ctx.overlay.showCookingPanel({
      recipes: recipeRows,
      pantry,
      activeBuffs: activeBuffRows().map((b) => ({ label: b.label, magnitudeLabel: b.magnitudeLabel, minutesLeft: b.minutesLeft })),
      onCook: (id) => this.handleCookDish(id),
      onEat: (itemId) => this.handleEat(itemId),
      onClose: () => {
        this.cookingOpen = false;
        this.refreshHud();
      },
    });
  }

  private handleCookDish(recipeId: string): boolean {
    const recipe = loadGameContent().recipes.find((r) => r.id === recipeId);
    if (!recipe) return false;
    const result = craft({ recipe, container: this.save.inventory });
    if (result.accepted) {
      this.save.inventory = result.container;
      persistActiveSave();
    }
    if (this.cookingOpen) this.renderCooking();
    return result.accepted;
  }

  private handleEat(itemId: string): { eaten: boolean; staminaRestore: number; buffLabel: string | null } {
    const result = eatActiveFood(itemId);
    if (result.eaten && result.staminaRestore > 0) {
      this.controller = {
        ...this.controller,
        stamina: Math.min(DEFAULT_CONTROLLER_CONFIG.maxStamina, this.controller.stamina + result.staminaRestore),
      };
    }
    if (this.cookingOpen) this.renderCooking();
    return { eaten: result.eaten, staminaRestore: result.staminaRestore, buffLabel: result.buffLabel };
  }

  private openCrafting(): void {
    const content = loadGameContent();
    const recipes = loadRecipesFromContent(content);
    const itemsById = new Map<string, Item>();
    for (const item of content.items) itemsById.set(item.id, item);
    this.craftingOpen = true;
    this.renderCrafting(recipes, itemsById);
  }

  private renderCrafting(
    recipes: readonly import('../data/schemas').Recipe[],
    itemsById: ReadonlyMap<string, Item>,
  ): void {
    const rows = buildCraftingPanelRecipes({
      knownRecipeIds: this.save.knownRecipeIds,
      recipes,
      itemsById,
      container: this.save.inventory,
    });
    this.ctx.overlay.showCraftingPanel({
      title: 'Workbench',
      recipes: rows,
      onCraft: (recipeId) => this.handleCraft(recipeId, recipes, itemsById),
      onClose: () => {
        this.craftingOpen = false;
        this.refreshHud();
      },
    });
  }

  private handleCraft(
    recipeId: string,
    recipes: readonly import('../data/schemas').Recipe[],
    itemsById: ReadonlyMap<string, Item>,
  ): void {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    if (isPlaceable(recipe.outputItemId, itemsById)) {
      // Placeable craft: consume ingredients and skip the inventory — the
      // output is placed on the map instead.
      for (const ing of recipe.ingredients) {
        if (countItem(this.save.inventory, ing.itemId) < ing.qty) return;
      }
      let next = this.save.inventory;
      for (const ing of recipe.ingredients) {
        next = removeItem(next, ing.itemId, ing.qty).container;
      }
      this.save.inventory = next;
      const slot = this.placementRoot;
      const slotsTaken = listPlacements(this.save, 'Interior').length;
      const placed = placeCrafted(
        this.save,
        'Interior',
        recipe.outputItemId,
        slot.x + slotsTaken * 1.2,
        slot.z,
      );
      this.spawnPlacementMesh(placed);
      persistActiveSave();
      this.actionLabel = `Placed ${itemsById.get(recipe.outputItemId)?.name ?? recipe.outputItemId}`;
      this.actionTimer = 1.6;
    } else {
      const result = craft({ recipe, container: this.save.inventory });
      if (!result.accepted) return;
      this.save.inventory = result.container;
      persistActiveSave();
      this.actionLabel = `Crafted ${recipe.name}`;
      this.actionTimer = 1.6;
    }
    // Prompt 054: a successful craft advances crafting quest objectives.
    recordActiveQuestEvent({ kind: 'craft', target: recipe.outputItemId, qty: recipe.outputQty });
    this.renderCrafting(recipes, itemsById);
  }

  private refreshPlacedDecor(): void {
    if (!this.scene) return;
    // Clear any meshes from a prior enter().
    for (const m of this.placementMeshes) m.dispose();
    this.placementMeshes = [];
    for (const p of listPlacements(this.save, 'Interior')) {
      this.spawnPlacementMesh(p);
    }
  }

  private spawnPlacementMesh(p: Placement): void {
    if (!this.scene) return;
    const def = this.furnitureCatalog.get(p.itemId);
    const mesh = def ? this.buildFurnitureMesh(def, p) : buildPlacementMesh(this.scene, p);
    mesh.rotation.y = p.rot ?? 0;
    this.placementMeshes.push(mesh);
  }

  /**
   * Graybox furniture geometry (Prompt 060). One root mesh per placement (sized
   * by footprint, coloured by category) plus category flourishes — a glowing lamp
   * head, a potted plant's foliage, a trophy shelf that fills with a cube per
   * earned milestone, a curio cabinet's wonders. Children parent to the root so a
   * single dispose clears the whole piece. A future `.glb` swap replaces the root.
   */
  private buildFurnitureMesh(def: Furniture, p: Placement): AbstractMesh {
    const scene = this.scene!;
    const { w, d, h } = def.footprint;
    const baseColor = FURNITURE_CATEGORY_COLOR[def.category];
    const mat = (suffix: string, color: typeof baseColor, emissive = 0.24) =>
      flatMaterial(scene, `${p.id}-${suffix}`, color, emissive);

    let root: AbstractMesh;
    if (def.category === 'rug') {
      root = MeshBuilder.CreateBox(p.id, { width: w, depth: d, height: 0.04 }, scene);
      root.position.set(p.x, 0.02, p.z);
      root.material = mat('rug', baseColor, 0.18);
    } else if (def.category === 'banner') {
      root = MeshBuilder.CreateBox(p.id, { width: w, depth: 0.08, height: h }, scene);
      root.position.set(p.x, 1.5, p.z);
      root.material = mat('banner', baseColor, 0.3);
    } else if (def.category === 'lamp') {
      root = MeshBuilder.CreateBox(p.id, { width: 0.14, depth: 0.14, height: h }, scene);
      root.position.set(p.x, h / 2, p.z);
      root.material = mat('lamp', baseColor, 0.2);
      const glow = MeshBuilder.CreateSphere(`${p.id}-glow`, { diameter: 0.4, segments: 8 }, scene);
      glow.parent = root;
      glow.position.set(0, h / 2 + 0.1, 0);
      glow.material = mat('glow', PALETTE.warmLight, 0.6);
    } else if (def.category === 'plant') {
      root = MeshBuilder.CreateBox(p.id, { width: w, depth: d, height: 0.4 }, scene);
      root.position.set(p.x, 0.2, p.z);
      root.material = mat('pot', PALETTE.roof, 0.2);
      const leaf = MeshBuilder.CreateSphere(`${p.id}-leaf`, { diameter: Math.min(w, d) + 0.2, segments: 8 }, scene);
      leaf.parent = root;
      leaf.position.set(0, 0.2 + h / 2, 0);
      leaf.material = mat('leaf', PALETTE.grass, 0.22);
    } else if (def.category === 'trophy-shelf') {
      root = MeshBuilder.CreateBox(p.id, { width: w, depth: d, height: h }, scene);
      root.position.set(p.x, h / 2, p.z);
      root.material = mat('shelf', baseColor, 0.24);
      const trophies = earnedTrophies(this.save);
      const count = Math.min(trophies.length, Math.max(1, Math.floor(w / 0.28)));
      for (let i = 0; i < count; i++) {
        const cube = MeshBuilder.CreateBox(`${p.id}-trophy-${i}`, { size: 0.16 }, scene);
        cube.parent = root;
        cube.position.set(-w / 2 + (i + 0.5) * (w / count), h / 2 + 0.1, 0);
        cube.material = mat(`trophy-${i}`, PALETTE.warmLight, 0.4);
      }
    } else if (def.category === 'curio') {
      root = MeshBuilder.CreateBox(p.id, { width: w, depth: d, height: h }, scene);
      root.position.set(p.x, h / 2, p.z);
      root.material = mat('curio', baseColor, 0.22);
      ([-0.2, 0.2] as const).forEach((dx, i) => {
        const wonder = MeshBuilder.CreateSphere(`${p.id}-wonder-${i}`, { diameter: 0.16, segments: 6 }, scene);
        wonder.parent = root;
        wonder.position.set(dx, h / 2 + 0.08, 0);
        wonder.material = mat(`wonder-${i}`, PALETTE.accent, 0.4);
      });
    } else {
      // seat / table / shelf and any future category.
      root = MeshBuilder.CreateBox(p.id, { width: w, depth: d, height: h }, scene);
      root.position.set(p.x, h / 2, p.z);
      root.material = mat('body', baseColor, 0.22);
    }
    root.isPickable = false;
    return root;
  }

  /* Prompt 061 — audio settings ---------------------------------------- */

  private openAudioSettings(): void {
    this.audioPanelOpen = true;
    this.renderAudioSettings();
  }

  private renderAudioSettings(): void {
    const dir = getAudioDirector();
    const current = dir.currentMusic();
    this.ctx.overlay.showAudioSettingsPanel({
      rows: audioMixRows(this.save.audio),
      nowPlaying: current ? `Now playing: ${musicTrack(current)?.name ?? current}` : undefined,
      onVolume: (cat, v) => dir.setCategoryVolume(cat as AudioCategory, v),
      onToggleMute: (cat) => {
        dir.toggleCategoryMute(cat as AudioCategory);
        this.renderAudioSettings();
      },
      onClose: () => {
        this.audioPanelOpen = false;
        this.refreshHud();
      },
    });
  }

  /* Prompt 060 — home, decor, customization, photo mode ---------------- */

  private openHome(): void {
    this.homeOpen = true;
    this.renderHome();
  }

  private closeHome(): void {
    this.homeOpen = false;
    this.refreshHud();
  }

  private setHomeTab(tab: HomeTab): void {
    this.homeTab = tab;
    if (this.homeOpen) this.renderHome();
  }

  private renderHome(): void {
    const save = this.save;
    const furniture = loadFurnitureFromContent(this.content);
    const home = getHomeState(save, 'Interior');
    const placed = listPlacements(save, 'Interior').map((p) => ({
      id: p.id,
      name:
        this.furnitureCatalog.get(p.itemId)?.name ??
        this.content.items.find((i) => i.id === p.itemId)?.name ??
        p.itemId,
    }));
    this.ctx.overlay.showHomePanel({
      activeTab: this.homeTab,
      gold: save.wallet.gold,
      onTab: (t) => this.setHomeTab(t),
      onPhotoMode: () => this.enterPhotoMode(),
      onClose: () => this.closeHome(),
      furniture: buildDecorateRows(furniture, save.wallet.gold),
      placed,
      onPlace: (id) => this.beginPlacement(id),
      onPickUp: (id) => this.pickUpPlacement(id),
      wallpapers: buildSurfaceRows('wallpaper', home.wallpaper),
      floorings: buildSurfaceRows('flooring', home.flooring),
      onWallpaper: (id) => this.setSurfaceChoice('wallpaper', id),
      onFlooring: (id) => this.setSurfaceChoice('flooring', id),
      renovations: buildRenovationRows(save, 'Interior'),
      onRenovate: (id) => this.buyRenovation(id),
      wardrobe: buildWardrobeParts(save.player.appearance),
      onSwatch: (part, swatchId) => this.changeAppearance(part, swatchId),
    });
  }

  private setSurfaceChoice(kind: SurfaceKind, id: string): void {
    if (setSurface(this.save, 'Interior', kind, id)) {
      this.applyHomeSurfaces();
      persistActiveSave();
    }
    if (this.homeOpen) this.renderHome();
  }

  private buyRenovation(id: string): boolean {
    const result = purchaseRenovation(this.save, 'Interior', id);
    if (result.accepted) {
      this.applyRenovations();
      persistActiveSave();
      this.actionLabel = `Built ${renovationDef(id)?.name ?? id}`;
      this.actionTimer = 1.6;
    }
    if (this.homeOpen) this.renderHome();
    return result.accepted;
  }

  private changeAppearance(part: string, swatchId: string): void {
    if (!APPEARANCE_PARTS.includes(part as AppearancePart)) return;
    const next = setAppearancePart(this.save.player.appearance, part as AppearancePart, swatchId);
    this.save.player.appearance = next;
    if (this.scene) applyPlayerAppearance(this.scene, this.player, next);
    persistActiveSave();
    if (this.homeOpen) this.renderHome();
  }

  private playerBodyColorHex(): string {
    const m = this.player.material;
    return m instanceof StandardMaterial ? m.diffuseColor.toHexString() : '#000000';
  }

  private clampToRoom(x: number, z: number): { x: number; z: number } {
    const h = this.roomHalf;
    return { x: Math.max(-h, Math.min(h, x)), z: Math.max(-h, Math.min(h, z)) };
  }

  private applyHomeSurfaces(): void {
    if (!this.scene) return;
    const home = getHomeState(this.save, 'Interior');
    if (this.floorMesh) this.recolor(this.floorMesh, surfaceSwatch('flooring', home.flooring).rgb, 0.22);
    const wall = surfaceSwatch('wallpaper', home.wallpaper).rgb;
    for (const w of this.wallMeshes) this.recolor(w, wall, 0.18);
  }

  private recolor(mesh: AbstractMesh, rgb: readonly [number, number, number], emissive: number): void {
    const m = mesh.material;
    if (m instanceof StandardMaterial) {
      m.diffuseColor = new Color3(rgb[0], rgb[1], rgb[2]);
      m.emissiveColor = new Color3(rgb[0], rgb[1], rgb[2]).scale(emissive);
    }
  }

  private applyRenovations(): void {
    if (!this.scene) return;
    for (const m of this.renovationMeshes) m.dispose();
    this.renovationMeshes = [];
    for (const id of getHomeState(this.save, 'Interior').renovations) this.buildRenovationMesh(id);
  }

  private buildRenovationMesh(id: string): void {
    const scene = this.scene;
    if (!scene) return;
    if (id === 'loft-shelf') {
      const plank = MeshBuilder.CreateBox('reno-loft-shelf', { width: 0.5, depth: 6, height: 0.2 }, scene);
      plank.position.set(-5.6, 2.2, 0);
      plank.material = flatMaterial(scene, 'reno-loft-shelf-mat', PALETTE.wood, 0.22);
      this.renovationMeshes.push(plank);
    } else if (id === 'bay-window') {
      const seat = MeshBuilder.CreateBox('reno-bay-seat', { width: 2.2, depth: 0.6, height: 0.5 }, scene);
      seat.position.set(3.0, 0.25, 5.6);
      seat.material = flatMaterial(scene, 'reno-bay-seat-mat', PALETTE.wood, 0.22);
      const pane = MeshBuilder.CreateBox('reno-bay-pane', { width: 2.0, depth: 0.1, height: 1.4 }, scene);
      pane.position.set(3.0, 1.7, 5.9);
      pane.material = flatMaterial(scene, 'reno-bay-pane-mat', PALETTE.warmLight, 0.6);
      this.renovationMeshes.push(seat, pane);
    } else if (id === 'stone-hearth') {
      const surround = MeshBuilder.CreateBox('reno-hearth-stone', { width: 2.4, depth: 1.4, height: 1.8 }, scene);
      surround.position.set(4.4, 0.9, -5.3);
      surround.material = flatMaterial(scene, 'reno-hearth-stone-mat', PALETTE.stone, 0.18);
      const fire = MeshBuilder.CreateSphere('reno-hearth-fire', { diameter: 0.9, segments: 8 }, scene);
      fire.position.set(4.4, 0.9, -4.4);
      fire.material = flatMaterial(scene, 'reno-hearth-fire-mat', PALETTE.warmLight, 0.65);
      this.renovationMeshes.push(surround, fire);
    }
  }

  private beginPlacement(furnitureId: string): void {
    const def = this.furnitureCatalog.get(furnitureId);
    if (!def || !this.scene) return;
    if (this.save.wallet.gold < def.price) {
      if (this.homeOpen) this.renderHome();
      return;
    }
    this.homeOpen = false;
    const ghost = this.buildGhostMesh(def);
    const start = this.clampToRoom(this.player.position.x, this.player.position.z - 1.5);
    ghost.position.x = start.x;
    ghost.position.z = start.z;
    this.placement = { furnitureId, ghost, rot: 0 };
    this.placementObserver = this.scene.onPointerObservable.add((info) => this.onPlacementPointer(info));
    this.ctx.overlay.showPlacementBar({
      label: def.name,
      onRotate: () => this.rotateGhost(),
      onPlace: () => this.confirmPlacement(),
      onCancel: () => this.cancelPlacement(),
    });
  }

  private buildGhostMesh(def: Furniture): AbstractMesh {
    const scene = this.scene!;
    const g = MeshBuilder.CreateBox(
      'placement-ghost',
      { width: def.footprint.w, depth: def.footprint.d, height: def.footprint.h },
      scene,
    );
    g.position.y = def.footprint.h / 2;
    const m = flatMaterial(scene, 'placement-ghost-mat', PALETTE.accent, 0.4);
    m.alpha = 0.45;
    g.material = m;
    g.isPickable = false;
    return g;
  }

  private onPlacementPointer(info: PointerInfo): void {
    if (!this.placement || !this.scene || !this.floorMesh) return;
    if (info.type === PointerEventTypes.POINTERMOVE || info.type === PointerEventTypes.POINTERTAP) {
      const floor = this.floorMesh;
      const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => mesh === floor);
      if (pick?.hit && pick.pickedPoint) {
        const c = this.clampToRoom(pick.pickedPoint.x, pick.pickedPoint.z);
        this.placement.ghost.position.x = c.x;
        this.placement.ghost.position.z = c.z;
      }
    }
  }

  private rotateGhost(): void {
    if (!this.placement) return;
    this.placement.rot = (this.placement.rot + Math.PI / 4) % (Math.PI * 2);
    this.placement.ghost.rotation.y = this.placement.rot;
  }

  private confirmPlacement(): void {
    if (!this.placement) return;
    const { furnitureId, ghost, rot } = this.placement;
    const x = ghost.position.x;
    const z = ghost.position.z;
    this.endPlacement();
    this.commitFurniture(furnitureId, x, z, rot);
    this.homeOpen = true;
    this.homeTab = 'decorate';
    this.renderHome();
  }

  private cancelPlacement(): void {
    this.endPlacement();
    this.homeOpen = true;
    this.renderHome();
  }

  private endPlacement(): void {
    if (this.placementObserver) {
      this.scene?.onPointerObservable.remove(this.placementObserver);
      this.placementObserver = null;
    }
    this.placement?.ghost.dispose();
    this.placement = null;
  }

  private commitFurniture(furnitureId: string, x: number, z: number, rot = 0): Placement | null {
    const def = this.furnitureCatalog.get(furnitureId);
    if (!def) return null;
    if (this.save.wallet.gold < def.price) return null;
    this.save.wallet.gold -= def.price;
    const c = this.clampToRoom(x, z);
    const placed = placeCrafted(this.save, 'Interior', furnitureId, c.x, c.z, rot);
    this.spawnPlacementMesh(placed);
    persistActiveSave();
    this.actionLabel = `Placed ${def.name}`;
    this.actionTimer = 1.6;
    return placed;
  }

  private pickUpPlacement(id: string): boolean {
    const removed = removePlacement(this.save, 'Interior', id);
    if (removed) {
      persistActiveSave();
      this.refreshPlacedDecor();
    }
    if (this.homeOpen) this.renderHome();
    return removed;
  }

  private enterPhotoMode(): void {
    this.endPlacement();
    this.homeOpen = false;
    this.photoMode = true;
    this.ctx.overlay.showPhotoModeBar({
      note: 'UI hidden — frame your shot, then Capture.',
      onCapture: () => {
        void this.capturePhoto();
      },
      onExit: () => this.exitPhotoMode(),
    });
  }

  private exitPhotoMode(): void {
    this.photoMode = false;
    this.refreshHud();
  }

  private async capturePhoto(): Promise<boolean> {
    if (!this.scene) return false;
    try {
      const dataUrl = await Tools.CreateScreenshotUsingRenderTargetAsync(
        this.ctx.engine,
        this.camera,
        { width: 1280, height: 720 },
      );
      if (!dataUrl) return false;
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `sturdy-volley-home-${Date.now().toString(36)}.png`;
      a.click();
      return true;
    } catch {
      return false;
    }
  }

  private exitToFarm(): void {
    if (this.returnTarget === 'Town') {
      this.goTo('Town', undefined);
    } else {
      this.goTo('Farm', { entry: 'farmhouse-door' });
    }
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
      todayWeather: this.weather ?? null,
    });
    resetDayLedger();
    applyGameTime(this.save, result.nextTime);
    if (!result.collapse) {
      this.controller = { ...this.controller, stamina: 100 };
    } else {
      this.controller = { ...this.controller, stamina: result.collapse.wakeStamina };
    }
    persistActiveSave();
    this.clock = setClockTime(this.clock, result.nextTime);
    this.player.position.copyFrom(this.bedAnchor);
    this.refreshWorldState();

    this.ctx.overlay.showDaySummary(result.summary, () => {
      this.dayResolving = false;
      this.menuOpen = false;
      this.clock = pauseClock(this.clock, false);
      this.refreshHud();
    });
  }

  override dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.endPlacement();
    super.dispose();
  }
}
