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
  unlockRecipes,
} from '../engine/crafting';
import { writeSave } from '../engine/save';
import { formatWorldStatus } from '../engine/format';
import { computeMoveVector, type MoveInput } from '../engine/movement';
import { createControllerState, stepController, type ControllerState } from '../engine/controller';
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
}

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
  private readonly workbenchAnchor = new Vector3(2.4, 0, -3.6);
  private readonly placementRoot = new Vector3(-2.5, 0, -4.8);
  private placementMeshes: AbstractMesh[] = [];

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

    // Four walls — north has a 1.2m doorway gap centered on x=0.
    const wall = (name: string, w: number, d: number, x: number, z: number, h = 3.0) => {
      const mesh = MeshBuilder.CreateBox(name, { width: w, depth: d, height: h }, scene);
      mesh.position.set(x, h / 2, z);
      mesh.material = flatMaterial(scene, name, PALETTE.cliff, 0.18);
      mesh.checkCollisions = true;
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
    };
  }

  override update(dt: number): void {
    if (!this.player || !this.save) return;
    if (this.menuOpen || this.dayResolving || this.shopOpen || this.craftingOpen) {
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

  private spawnPlacementMesh(p: { id: string; itemId: string; x: number; z: number }): void {
    if (!this.scene) return;
    const mesh = buildPlacementMesh(this.scene, p);
    this.placementMeshes.push(mesh);
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
    super.dispose();
  }
}
