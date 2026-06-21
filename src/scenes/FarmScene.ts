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
import { applyPlayerAppearance } from '../render/player-appearance';
import { formatWorldStatus } from '../engine/format';
import { computeMoveVector, type MoveInput } from '../engine/movement';
import { FarmGrid, FARM_CELL_SIZE } from '../engine/farmGrid';
import { createControllerState, stepController, DEFAULT_CONTROLLER_CONFIG, type ControllerConfig, type ControllerState } from '../engine/controller';
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
import { startCutscene } from '../render/cutscene-runner';
import { FIRST_MORNING_CUTSCENE } from '../data/content/cutscenes/first-morning';
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
  recordActiveQuestEvent,
  reconcileActiveQuests,
  acceptActiveQuest,
  cancelActiveQuest,
  activeQuestJournalRows,
} from '../engine/quest-tracking';
import {
  activeMailboxRows,
  activeUnreadMailCount,
  deliverActiveMail,
  readActiveMail,
} from '../engine/mail-tracking';
import { activeBuffEffectsNow, activeBuffRows, pruneActiveBuffs } from '../engine/buff-tracking';
import type { QuestPanelRow } from '../ui/overlay';
import type { QuestJournalRow } from '../engine/quests';
import {
  anchorFor,
  buildEntityMesh,
  entityLabel,
  farmEntitySuffix,
  FARM_ENTITY_ANCHORS,
} from '../render/farm-entities';
import { buildMachineMesh, paintMachineStatus, type MachineMesh } from '../render/farm-machines';
import { bobAnimal, buildAnimalMesh, disposeAnimal, moveAnimal, type AnimalMesh } from '../render/farm-animals';
import { buildPetMesh, disposePet, movePetMesh, refreshPetCollar, type PetMesh } from '../render/farm-pet';
import {
  PET_DEFS,
  fillBowl,
  petPet,
  playFetch,
  setCollar,
  tickPetFollow,
  unlockedPetPerk,
} from '../engine/pets';
import {
  SKILL_IDS,
  levelFromXp,
  professionOptionsFor,
  xpToNextLevel,
} from '../engine/professions';
import {
  ANIMAL_DEFS,
  feedAnimal,
  heartsOf,
  moodOf,
  petAnimal,
  shouldBeOutside,
} from '../engine/animals';
import {
  MACHINE_CATALOG,
  collectMachine,
  loadMachine,
  newlyReady,
  remainingMinutes,
  statusOf,
} from '../engine/machines';
import { absoluteDay } from '../engine/timeSystem';
import { playReadyChime } from '../audio/cues';

const FARM_HALF = 20;

function formatProcessLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
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
  machines: () => Record<string, { kind: string; status: string; recipeIndex: number | null }>;
  openMachine: (id: string) => void;
  grantItem: (itemId: string, qty: number) => void;
  fastForwardMinutes: (minutes: number) => void;
  animals: () => Record<string, { name: string; kind: string; hearts: number; fedToday: boolean; pettedToday: boolean; outside: boolean }>;
  petAnimal: (id: string) => void;
  feedAnimal: (id: string) => void;
  openAnimalPanel: () => void;
  pet: () => null | { name: string; kind: string; affection: number; pettedToday: boolean; bowlFilledToday: boolean; collar: 'red'|'kelp'|'shell'|null; x: number; z: number; perk: 'comfort'|'forage-sniff'|null };
  openPetPanel: () => void;
  setPetAffection: (value: number) => void;
  quests: () => Array<{ id: string; name: string; status: string; objectives: Array<{ current: number; target: number; done: boolean }> }>;
  openQuestPanel: () => void;
  recordQuestEvent: (kind: string, target: string | null, qty?: number) => string[];
  acceptQuest: (id: string) => void;
  cancelQuest: (id: string) => void;
  // Prompt 058 — mail.
  mailUnread: () => number;
  mailRows: () => Array<{ id: string; sender: string; subject: string; read: boolean }>;
  openMailbox: () => void;
  readMail: (id: string) => { read: boolean; attachmentSummary: string; startedQuestId: string | null };
  deliverMail: () => string[];
  setFlag: (flag: string, value: boolean) => void;
  // Test hooks that drive panel actions without a canvas-load-fragile DOM click.
  swapPetKind: () => void;
  dismissDaySummary: () => boolean;
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
  /** Prompt 058: the mailbox flag mesh, raised while unread mail waits. */
  private mailFlag: import('@babylonjs/core').AbstractMesh | null = null;
  /** Day-summary "Continue" callback, held so a test can dismiss it via debug. */
  private pendingDaySummaryContinue: (() => void) | null = null;
  private clock!: TimeClockState;
  private weather: Weather | null = null;
  private tide: TideState = 'low';
  private dayResolving = false;
  private partnerKind: PartnerKind = null;
  private partnerId: string | null = null;
  private catalog!: ItemCatalog;
  private cutsceneRunner: ReturnType<typeof startCutscene> | null = null;
  private cropIndex!: ReturnType<typeof buildCropIndex>;
  private seedToCropId: Map<string, string> = new Map();
  private readonly cellMeshes = new Map<string, BabylonMesh>();
  private readonly cropMeshes = new Map<string, BabylonMesh>();
  /** Live meshes for `Farm:*` worldEntities keyed by the bare suffix. */
  private readonly entityMeshes = new Map<string, BabylonMesh>();
  /** Live machine meshes keyed by machine id; per Prompt 018. */
  private readonly machineMeshes = new Map<string, MachineMesh>();
  private machinePanelOpen = false;
  private machinePanelId: string | null = null;
  private lastMachineCheckMinutes = 0;
  /** Live animal meshes keyed by animal id; per Prompt 019. */
  private readonly animalMeshes = new Map<string, AnimalMesh>();
  private animalsPanelOpen = false;
  private animalBobSeconds = 0;
  private petMesh: PetMesh | null = null;
  private petPanelOpen = false;
  private petSeed = 1;
  private professionsPanelOpen = false;
  private questsPanelOpen = false;
  private readonly homePosition = new Vector3(-8, 0.9, -5.4);
  private readonly plotOrigin = new Vector3(-6, 0, -4);
  private static readonly SCENE_KEY = 'Farm';

  private readonly pressed = new Set<string>();
  private touch = { active: false, dx: 0, dy: 0, ox: 0, oy: 0 };
  /** One-shot: set by a touch tap, consumed as an interact next update frame. */
  private touchInteractPending = false;
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

    // Prompt 019: coop (north-west) + barn (north-east). Each is a low
    // open-front structure with a small fenced pasture in front. The
    // animals graze in front when outside and shelter inside otherwise.
    const coop = MeshBuilder.CreateBox('coop', { width: 4, depth: 3, height: 2.2 }, scene);
    coop.position.set(-10, 1.1, 6);
    coop.material = flatMaterial(scene, 'coop', PALETTE.wood, 0.22);
    coop.checkCollisions = true;
    const coopRoof = MeshBuilder.CreateCylinder('coop-roof', { height: 0.9, diameterTop: 0, diameterBottom: 4.6, tessellation: 4 }, scene);
    coopRoof.position.set(-10, 2.6, 6);
    coopRoof.rotation.y = Math.PI / 4;
    coopRoof.material = flatMaterial(scene, 'coop-roof', PALETTE.roof, 0.22);

    const barn = MeshBuilder.CreateBox('barn', { width: 5, depth: 4, height: 2.8 }, scene);
    barn.position.set(8, 1.4, 6);
    barn.material = flatMaterial(scene, 'barn', PALETTE.cliff, 0.22);
    barn.checkCollisions = true;
    const barnRoof = MeshBuilder.CreateCylinder('barn-roof', { height: 1.1, diameterTop: 0, diameterBottom: 5.6, tessellation: 4 }, scene);
    barnRoof.position.set(8, 3.3, 6);
    barnRoof.rotation.y = Math.PI / 4;
    barnRoof.material = flatMaterial(scene, 'barn-roof', PALETTE.roof, 0.22);

    // Pasture markers — short fence-cube strips so the player can see the
    // outside grazing yards.
    const fence = (n: string, x: number, z: number, w: number, d: number) => {
      const f = MeshBuilder.CreateBox(n, { width: w, depth: d, height: 0.4 }, scene);
      f.position.set(x, 0.2, z);
      f.material = flatMaterial(scene, n, PALETTE.wood, 0.18);
    };
    fence('coop-fence-front', -10, 3.2, 4.2, 0.18);
    fence('coop-fence-left', -12.1, 4.1, 0.18, 1.8);
    fence('coop-fence-right', -7.9, 4.1, 0.18, 1.8);
    fence('barn-fence-front', 8, 3.1, 5.2, 0.18);
    fence('barn-fence-left', 5.4, 4.05, 0.18, 1.9);
    fence('barn-fence-right', 10.6, 4.05, 0.18, 1.9);

    // Prompt 020: water bowl on the porch — the pet drinks from this and
    // the player tops it up each morning.
    const bowl = MeshBuilder.CreateCylinder('pet-bowl', { height: 0.12, diameter: 0.36 }, scene);
    bowl.position.set(-9.2, 0.06, -6.0);
    bowl.material = flatMaterial(scene, 'pet-bowl', PALETTE.stone, 0.25);

    // Prompt 058: the farm mailbox — a post + box out by the west path, clear of
    // the tilled plot's interaction radius (centred at (-6,-4), r=4) so it never
    // intercepts a planting/gathering press.
    const mailPost = MeshBuilder.CreateCylinder('mailbox-post', { height: 1.1, diameter: 0.12 }, scene);
    mailPost.position.set(-14, 0.55, -2);
    mailPost.material = flatMaterial(scene, 'mailbox-post', PALETTE.wood, 0.2);
    const mailBox = MeshBuilder.CreateBox('mailbox-box', { width: 0.5, depth: 0.7, height: 0.4 }, scene);
    mailBox.position.set(-14, 1.2, -2);
    mailBox.material = flatMaterial(scene, 'mailbox-box', PALETTE.accent, 0.25);
    const mailFlag = MeshBuilder.CreateBox('mailbox-flag', { width: 0.06, depth: 0.22, height: 0.22 }, scene);
    mailFlag.position.set(-13.65, 1.32, -2);
    mailFlag.material = flatMaterial(scene, 'mailbox-flag', PALETTE.roof, 0.3);
    this.mailFlag = mailFlag;
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

    // Prompt 060: reflect the player's wardrobe choices on the outdoor capsule.
    if (this.scene) applyPlayerAppearance(this.scene, this.player, save.player.appearance);

    const content = loadGameContent();
    this.catalog = buildItemCatalog(content.items, content.npcs);
    this.cropIndex = buildCropIndex(content.crops);
    this.seedToCropId = new Map(content.crops.map((c) => [c.seedItemId, c.id] as const));
    this.refreshCropMeshes();
    this.refreshEntityMeshes();

    this.controller = createControllerState();
    this.clock = createTimeClock(getGameTime(save));
    this.refreshWorldState();
    this.refreshMachineMeshes();
    this.lastMachineCheckMinutes = this.absoluteMinutesNow();
    this.refreshAnimalMeshes();
    this.applyAnimalShelterState();
    this.refreshPetMesh();
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

    // RF-14: play the first-morning cutscene exactly once, gated by a flag.
    if (!save.flags['first-morning-seen']) this.startFirstMorningCutscene();

    // Prompt 054: seed quest states (auto-activate story quests, offer requests,
    // refresh standing objectives) and flash any quest completed off-screen.
    this.flashQuestOutcomes(reconcileActiveQuests());
    this.questsPanelOpen = false;

    // Prompt 058: deliver any due mail to the box, flash a note, and raise the flag.
    this.deliverMailAndNotify();

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
      machines: () => {
        const out: Record<string, { kind: string; status: string; recipeIndex: number | null }> = {};
        const now = this.absoluteMinutesNow();
        for (const [k, m] of Object.entries(this.save.machines ?? {})) {
          out[k] = { kind: m.kind, status: statusOf(m, now), recipeIndex: m.recipeIndex };
        }
        return out;
      },
      openMachine: (id: string) => this.openMachine(id),
      grantItem: (itemId: string, qty: number) => {
        const r = addItem(this.save.inventory, itemId, qty, 0);
        this.save.inventory = r.container;
        persistActiveSave();
        this.refreshHotbar();
      },
      fastForwardMinutes: (minutes: number) => {
        const next = { ...this.clock.time, minutes: Math.min(this.clock.time.minutes + minutes, 25 * 60) };
        this.clock = setClockTime(this.clock, next);
        applyGameTime(this.save, next);
        this.checkMachineReadyTransitions();
        this.paintAllMachines();
        this.applyAnimalShelterState();
        persistActiveSave();
      },
      animals: () => {
        const out: Record<string, { name: string; kind: string; hearts: number; fedToday: boolean; pettedToday: boolean; outside: boolean }> = {};
        for (const [k, a] of Object.entries(this.save.animals ?? {})) {
          out[k] = {
            name: a.name,
            kind: a.kind,
            hearts: heartsOf(a),
            fedToday: a.fedToday,
            pettedToday: a.pettedToday,
            outside: a.outside,
          };
        }
        return out;
      },
      petAnimal: (id: string) => {
        const a = this.save.animals?.[id];
        if (a) this.save.animals![id] = petAnimal(a);
        persistActiveSave();
        this.rebuildInteractionTargets();
      },
      feedAnimal: (id: string) => {
        const a = this.save.animals?.[id];
        if (!a) return;
        // For e2e: force fedToday = false first so feed succeeds.
        this.save.animals![id] = { ...a, fedToday: false };
        const r = feedAnimal({ animal: this.save.animals![id]!, container: this.save.inventory });
        if (r.accepted) {
          this.save.animals![id] = r.animal;
          this.save.inventory = r.container;
          persistActiveSave();
          this.refreshHotbar();
          this.rebuildInteractionTargets();
        }
      },
      openAnimalPanel: () => this.openAnimalPanel(),
      pet: () => {
        const p = this.save.pet;
        if (!p) return null;
        return {
          name: p.name,
          kind: p.kind,
          affection: p.affection,
          pettedToday: p.pettedToday,
          bowlFilledToday: p.bowlFilledToday,
          collar: p.collar,
          x: p.x,
          z: p.z,
          perk: unlockedPetPerk(p),
        };
      },
      openPetPanel: () => this.openPetPanel(),
      setPetAffection: (value: number) => {
        if (!this.save.pet) return;
        this.save.pet = { ...this.save.pet, affection: Math.max(0, Math.min(1000, value)) };
        persistActiveSave();
      },
      quests: () =>
        activeQuestJournalRows().map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          objectives: r.objectives.map((o) => ({ current: o.current, target: o.target, done: o.done })),
        })),
      openQuestPanel: () => this.openQuestPanel(),
      recordQuestEvent: (kind: string, target: string | null, qty?: number): string[] => {
        const completed = recordActiveQuestEvent({
          kind: kind as Parameters<typeof recordActiveQuestEvent>[0]['kind'],
          target,
          qty,
        });
        if (completed.length > 0) {
          this.flashQuestOutcomes({ completed, failed: [] });
          this.refreshHotbar();
        }
        return completed.map((q) => q.id);
      },
      acceptQuest: (id: string) => {
        acceptActiveQuest(id);
      },
      cancelQuest: (id: string) => {
        cancelActiveQuest(id);
      },
      // Prompt 058 — mail.
      mailUnread: () => activeUnreadMailCount(),
      mailRows: () => activeMailboxRows().map((r) => ({ id: r.id, sender: r.sender, subject: r.subject, read: r.read })),
      openMailbox: () => this.openMailbox(),
      readMail: (id: string) => readActiveMail(id),
      deliverMail: () => {
        const ids = deliverActiveMail();
        this.updateMailFlag();
        this.rebuildInteractionTargets();
        return ids;
      },
      setFlag: (flag: string, value: boolean) => {
        this.save.flags[flag] = value;
        persistActiveSave();
      },
      swapPetKind: () => {
        if (!this.save.pet) return;
        const nextKind = this.save.pet.kind === 'tide-cat' ? 'bay-dog' : 'tide-cat';
        this.save.pet = { ...this.save.pet, kind: nextKind, name: nextKind === 'tide-cat' ? 'Pixel' : 'Drift' };
        persistActiveSave();
        this.refreshPetMesh();
        if (this.petPanelOpen) this.renderPetPanel();
      },
      dismissDaySummary: () => {
        if (!this.pendingDaySummaryContinue) return false;
        this.pendingDaySummaryContinue();
        return true;
      },
    };
  }

  /**
   * Prompt 059: fold active food buffs into the locomotion config — a movement
   * buff scales the gait speeds, a stamina-regen buff adds to recovery. Returns
   * the default config untouched when no relevant buff is active.
   */
  private buffedControllerConfig(): ControllerConfig {
    const eff = activeBuffEffectsNow();
    if (eff.movementMult === 1 && eff.staminaRegenBonus === 0) return DEFAULT_CONTROLLER_CONFIG;
    return {
      ...DEFAULT_CONTROLLER_CONFIG,
      jogSpeed: DEFAULT_CONTROLLER_CONFIG.jogSpeed * eff.movementMult,
      sprintSpeed: DEFAULT_CONTROLLER_CONFIG.sprintSpeed * eff.movementMult,
      exhaustedSpeed: DEFAULT_CONTROLLER_CONFIG.exhaustedSpeed * eff.movementMult,
      staminaRecovery: DEFAULT_CONTROLLER_CONFIG.staminaRecovery + eff.staminaRegenBonus,
    };
  }

  /* Prompt 058 — mailbox -------------------------------------------- */

  /** Deliver any due mail, flash a HUD note for new letters, and raise the flag. */
  private deliverMailAndNotify(): void {
    const delivered = deliverActiveMail();
    if (delivered.length > 0) {
      this.actionLabel = `${delivered.length} new letter${delivered.length === 1 ? '' : 's'} in the mailbox`;
      this.actionTimer = 2.4;
    }
    this.updateMailFlag();
  }

  /** Raise the mailbox flag while unread mail waits; lower it when the box is read. */
  private updateMailFlag(): void {
    if (this.mailFlag) this.mailFlag.isVisible = activeUnreadMailCount() > 0;
  }

  private mailboxLabel(): string {
    const unread = activeUnreadMailCount();
    return unread > 0 ? `Read the mail (${unread} new)` : 'Check the mailbox';
  }

  private openMailbox(): void {
    this.menuOpen = true;
    this.renderMailbox();
  }

  private renderMailbox(): void {
    const rows = activeMailboxRows();
    this.ctx.overlay.showMailboxPanel({
      rows: rows.map((r) => ({ id: r.id, sender: r.sender, subject: r.subject, read: r.read, hasAttachments: r.hasAttachments })),
      summary: `${activeUnreadMailCount()} unread · ${rows.length} letter${rows.length === 1 ? '' : 's'}`,
      onOpen: (id) => this.openLetter(id),
      onClose: () => {
        this.menuOpen = false;
        this.updateMailFlag();
        this.rebuildInteractionTargets();
        this.refreshHud();
        this.refreshHotbar();
      },
    });
  }

  private openLetter(id: string): void {
    const before = activeMailboxRows().find((r) => r.id === id);
    if (!before) {
      this.renderMailbox();
      return;
    }
    // Reading grants attachments (once) + starts any quest.
    const result = readActiveMail(id);
    if (result.startedQuestId) this.flashQuestOutcomes(reconcileActiveQuests());
    const letter = activeMailboxRows().find((r) => r.id === id) ?? before;
    this.ctx.overlay.showLetterPanel({
      sender: letter.sender,
      subject: letter.subject,
      body: letter.body,
      attachmentSummary: result.read ? result.attachmentSummary : letter.attachmentSummary,
      startsQuest: letter.startsQuest,
      onBack: () => this.renderMailbox(),
    });
    this.updateMailFlag();
  }

  override update(dt: number): void {
    if (!this.player) return;
    // RF-14: cutscene ticks while it's running and blocks gameplay. The Skip
    // button finishes the runner synchronously (outside tick), so a finished
    // runner — from skip OR from a tick reaching the end — must always run
    // endCutscene(); otherwise the camera's lockedTarget is never restored and
    // it freezes at the origin while the player walks off-frame (Bug: invisible
    // player in portrait after skipping the intro).
    if (this.cutsceneRunner) {
      if (!this.cutsceneRunner.isFinished()) {
        this.cutsceneRunner.tick(dt);
      }
      if (this.cutsceneRunner.isFinished()) {
        this.endCutscene();
      } else {
        this.clock = pauseClock(this.clock, true);
        this.controller = stepController(this.controller, { dir: { x: 0, z: 0 }, sprint: false }, dt);
        return;
      }
    }
    if (this.menuOpen || this.inventoryOpen || this.dayResolving || this.machinePanelOpen || this.animalsPanelOpen || this.petPanelOpen || this.professionsPanelOpen || this.questsPanelOpen) {
      this.clock = pauseClock(this.clock, true);
      this.controller = stepController(this.controller, { dir: { x: 0, z: 0 }, sprint: false }, dt);
      return;
    }
    if (this.clock.paused) this.clock = pauseClock(this.clock, false);

    this.updateToolSelection();
    this.updateHotbarSelection();

    const dir = this.cameraRelativeDir(computeMoveVector(this.readInput()));
    const sprint = this.pressed.has('shift');
    this.controller = stepController(this.controller, { dir, sprint }, dt, this.buffedControllerConfig());
    if (this.controller.speed > 0.01 && (dir.x !== 0 || dir.z !== 0)) {
      this.player.moveWithCollisions(new Vector3(dir.x, 0, dir.z).scale(this.controller.speed * dt));
    }

    this.nearest = resolveInteraction(this.targets, this.player.position.x, this.player.position.z);

    const interact = this.pressed.has('e') || this.pressed.has(' ') || this.touchInteractPending;
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
      } else if (this.nearest.id.startsWith('machine:')) {
        this.openMachine(this.nearest.id.slice('machine:'.length));
      } else if (this.nearest.id.startsWith('animal:')) {
        this.handleAnimalInteract(this.nearest.id.slice('animal:'.length));
        this.rebuildInteractionTargets();
      } else if (this.nearest.id === 'mailbox') {
        this.openMailbox();
      } else if (this.nearest.id === 'pet-bowl') {
        this.handleFillBowl();
      } else if (this.nearest.id === 'pet') {
        this.handlePetPet();
      } else {
        this.actionLabel = this.nearest.label;
        this.actionTimer = 1.6;
      }
    }
    this.ePrev = interact;
    this.touchInteractPending = false;

    const inventoryKey = this.pressed.has('i');
    if (inventoryKey && !this.iPrev) this.openInventory(null);
    this.iPrev = inventoryKey;

    if (this.actionTimer > 0) this.actionTimer -= dt;

    const tick = tickClock(this.clock, dt);
    this.clock = tick.state;
    if (tick.advancedMinutes > 0) {
      applyGameTime(this.save, this.clock.time);
      this.refreshWorldState();
      this.checkMachineReadyTransitions();
      this.paintAllMachines();
      this.applyAnimalShelterState();
      pruneActiveBuffs(); // Prompt 059: expire lapsed food buffs as time advances.
    }

    // Animal bob animation runs every frame.
    this.animalBobSeconds += dt;
    let ai = 0;
    for (const mesh of this.animalMeshes.values()) {
      bobAnimal(mesh, this.animalBobSeconds, ai++);
    }

    // Pet follow / idle tick (Prompt 020).
    this.tickPet(dt);
    // Comfort perk: stamina regen +1/s when pet at max affection AND player still.
    if (this.save.pet && unlockedPetPerk(this.save.pet) === 'comfort' && this.controller.speed < 0.05) {
      this.controller = {
        ...this.controller,
        stamina: Math.min(100, this.controller.stamina + dt),
      };
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
    // A tap (press + release with negligible drag) is the touch "interact" —
    // it fires the same contextual action as the E key on the nearest target.
    if (this.touch.active && Math.hypot(this.touch.dx, this.touch.dy) < 12) {
      this.touchInteractPending = true;
    }
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
    // Prompt 059: surface active food buffs so the player can see what's running.
    const buffs = activeBuffRows();
    if (buffs.length > 0) line += ` · 🍲 ${buffs.map((b) => `${b.label} ${b.minutesLeft}m`).join(', ')}`;
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
        { id: 'animals', label: 'Animals', enabled: true, testId: 'pause-animals' },
        { id: 'pet', label: 'Pet', enabled: Boolean(this.save.pet), testId: 'pause-pet' },
        { id: 'skills', label: 'Skills & Professions', enabled: true, testId: 'pause-skills' },
        { id: 'quests', label: 'Quest Journal', enabled: true, testId: 'pause-quests' },
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
      case 'animals':
        this.menuOpen = false;
        this.openAnimalPanel();
        break;
      case 'pet':
        this.menuOpen = false;
        this.openPetPanel();
        break;
      case 'skills':
        this.menuOpen = false;
        this.openProfessionPanel();
        break;
      case 'quests':
        this.menuOpen = false;
        this.openQuestPanel();
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

    // Prompt 054: a harvest advances farming quest objectives.
    const completed = recordActiveQuestEvent({ kind: 'harvest', target: result.produceItemId });
    if (completed.length > 0) {
      this.flashQuestOutcomes({ completed, failed: [] });
      this.refreshHotbar();
    }
  }

  private flashAction(label: string): void {
    this.actionLabel = label;
    this.actionTimer = 1.6;
  }

  /** Surface quest completions/expiries from a reconcile or event as a HUD flash. */
  private flashQuestOutcomes(result: {
    completed: ReadonlyArray<{ name: string }>;
    failed: ReadonlyArray<{ name: string }>;
  }): void {
    if (result.completed.length > 0) {
      this.flashAction(
        result.completed.length === 1
          ? `Quest complete: ${result.completed[0]!.name}`
          : `${result.completed.length} quests complete`,
      );
    } else if (result.failed.length > 0) {
      this.flashAction(`Quest expired: ${result.failed[0]!.name}`);
    }
  }

  private openQuestPanel(): void {
    this.questsPanelOpen = true;
    // Reconcile first so standing objectives (befriend / have) can complete and
    // grant before the journal renders.
    this.flashQuestOutcomes(reconcileActiveQuests());
    this.renderQuestPanel();
  }

  private renderQuestPanel(): void {
    const npcNames = new Map(loadGameContent().npcs.map((n) => [n.id, n.name] as const));
    const toRow = (r: QuestJournalRow): QuestPanelRow => ({
      id: r.id,
      name: r.name,
      category: r.category,
      kind: r.kind,
      status: r.status === 'locked' ? 'available' : r.status,
      description: r.description,
      objectives: r.objectives.map((o) => ({
        label: o.label,
        current: o.current,
        target: o.target,
        done: o.done,
      })),
      rewardSummary: r.rewardSummary,
      giver: r.giverNpcId ? (npcNames.get(r.giverNpcId) ?? r.giverNpcId) : null,
      canAccept: r.canAccept,
      canCancel: r.canCancel,
      timeLeftLabel:
        r.timeLeftDays != null ? `${r.timeLeftDays} day${r.timeLeftDays === 1 ? '' : 's'} left` : undefined,
    });

    const rows = activeQuestJournalRows().map(toRow);
    const active = rows.filter((r) => r.status === 'active').length;
    const available = rows.filter((r) => r.status === 'available').length;
    const complete = rows.filter((r) => r.status === 'complete').length;

    this.ctx.overlay.showQuestPanel({
      rows,
      summary: `${active} active · ${available} available · ${complete} done`,
      onAccept: (id) => {
        acceptActiveQuest(id);
        this.flashQuestOutcomes(reconcileActiveQuests());
        this.refreshHotbar();
        this.renderQuestPanel();
      },
      onCancel: (id) => {
        cancelActiveQuest(id);
        reconcileActiveQuests();
        this.renderQuestPanel();
      },
      onClose: () => {
        this.questsPanelOpen = false;
        this.refreshHud();
      },
    });
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
      { id: 'mailbox', kind: 'prop', label: this.mailboxLabel(), x: -14, z: -2, radius: 2.0, priority: 4 },
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
    // Prompt 018: machine cluster on the Farm.
    for (const machine of Object.values(this.save.machines ?? {})) {
      if (machine.sceneKey !== 'Farm') continue;
      const def = MACHINE_CATALOG[machine.kind];
      base.push({
        id: `machine:${machine.id}`,
        kind: 'machine',
        label: `Use the ${def.name}`,
        x: machine.x,
        z: machine.z,
        radius: 1.5,
        priority: 3,
      });
    }
    // Prompt 020: water bowl on the porch.
    if (this.save.pet) {
      base.push({
        id: 'pet-bowl',
        kind: 'prop',
        label: this.save.pet.bowlFilledToday ? 'Bowl is full' : 'Fill the water bowl',
        x: -9.2,
        z: -6.0,
        radius: 1.4,
        priority: 2,
      });
      base.push({
        id: 'pet',
        kind: 'animal',
        label: this.save.pet.pettedToday ? `${this.save.pet.name} purrs at you` : `Pet ${this.save.pet.name}`,
        x: this.save.pet.x,
        z: this.save.pet.z,
        radius: 1.2,
        priority: 3,
      });
    }
    // Prompt 019: animal interactables follow the animal's live position.
    let i = 0;
    for (const animal of Object.values(this.save.animals ?? {})) {
      const pos = animal.outside ? this.animalOutsidePos(animal.id, i) : this.animalInsidePos(animal.id);
      const label = !animal.pettedToday
        ? `Pet ${animal.name}`
        : !animal.fedToday
        ? `Feed ${animal.name}`
        : `${animal.name} is content`;
      base.push({
        id: `animal:${animal.id}`,
        kind: 'animal',
        label,
        x: pos.x,
        z: pos.z,
        radius: 1.4,
        priority: 3,
      });
      i++;
    }
    this.targets = base;
  }

  private absoluteMinutesNow(): number {
    return absoluteDay(this.clock.time) * 1440 + this.clock.time.minutes;
  }

  private refreshMachineMeshes(): void {
    if (!this.scene) return;
    const live = this.save.machines ?? {};
    // Remove stale meshes.
    for (const [id, mesh] of [...this.machineMeshes.entries()]) {
      if (!live[id] || live[id]!.sceneKey !== 'Farm') {
        mesh.body.dispose();
        mesh.statusLight.dispose();
        this.machineMeshes.delete(id);
      }
    }
    // Spawn missing meshes.
    for (const m of Object.values(live)) {
      if (m.sceneKey !== 'Farm') continue;
      if (this.machineMeshes.has(m.id)) continue;
      this.machineMeshes.set(m.id, buildMachineMesh(this.scene, m.id, m.kind, { x: m.x, z: m.z }));
    }
    this.paintAllMachines();
  }

  private paintAllMachines(): void {
    const now = this.absoluteMinutesNow();
    for (const [id, mesh] of this.machineMeshes) {
      const state = this.save.machines?.[id];
      if (!state) continue;
      paintMachineStatus(mesh, statusOf(state, now));
    }
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

  private openProfessionPanel(): void {
    this.professionsPanelOpen = true;
    this.renderProfessionPanel();
  }

  private renderProfessionPanel(): void {
    const skillNames: Record<string, string> = {
      cultivation: 'Cultivation',
      husbandry: 'Husbandry',
      foraging: 'Foraging',
      angling: 'Angling',
      crafting: 'Crafting',
      exploring: 'Exploring',
      combat: 'Combat',
      rapport: 'Rapport',
    };
    const rows: import('../ui/overlay').ProfessionPanelSkillRow[] = SKILL_IDS.map((sid) => {
      const xp = this.save.skills?.[sid] ?? 0;
      const level = levelFromXp(xp);
      const xpToNext = xpToNextLevel(xp);
      const professionId = this.save.professions?.[sid] ?? null;
      const choices = !professionId
        ? professionOptionsFor(sid, level).map((p) => ({
            id: p.id,
            label: p.name,
            description: p.description,
          }))
        : undefined;
      return {
        skillId: sid,
        name: skillNames[sid] ?? sid,
        xp,
        level,
        xpToNext,
        professionId,
        pendingChoices: choices && choices.length > 0 ? choices : undefined,
      };
    });
    this.ctx.overlay.showProfessionPanel({
      rows,
      masteryXp: this.save.mastery?.totalMasteryXp ?? 0,
      onChoose: (skillId, professionId) => {
        if (!this.save.professions) this.save.professions = {};
        this.save.professions[skillId] = professionId;
        persistActiveSave();
        this.renderProfessionPanel();
      },
      onClose: () => {
        this.professionsPanelOpen = false;
        this.refreshHud();
      },
    });
  }

  private refreshPetMesh(): void {
    if (!this.scene) return;
    if (this.petMesh) {
      disposePet(this.petMesh);
      this.petMesh = null;
    }
    if (this.save.pet) {
      this.petMesh = buildPetMesh(this.scene, this.save.pet);
    }
  }

  private tickPet(dt: number): void {
    if (!this.save.pet || !this.petMesh) return;
    const moving = this.controller.speed > 0.05;
    this.petSeed += 1;
    const result = tickPetFollow({
      pet: this.save.pet,
      playerX: this.player.position.x,
      playerZ: this.player.position.z,
      playerMoving: moving,
      doors: [
        { x: -10, z: -5.6, radius: 1.4 }, // farmhouse-door
      ],
      dt,
      seed: this.petSeed,
    });
    this.save.pet = result.pet;
    movePetMesh(this.petMesh, this.save.pet);
  }

  private handleFillBowl(): void {
    if (!this.save.pet) return;
    const next = fillBowl(this.save.pet);
    if (next === this.save.pet) {
      this.flashAction('The bowl is already full');
      return;
    }
    this.save.pet = next;
    persistActiveSave();
    this.flashAction('Filled the water bowl');
    this.rebuildInteractionTargets();
  }

  private handlePetPet(): void {
    if (!this.save.pet) return;
    const next = petPet(this.save.pet);
    if (next === this.save.pet) {
      this.flashAction(`${this.save.pet.name} already had attention today`);
      return;
    }
    this.save.pet = next;
    persistActiveSave();
    this.flashAction(`Petted ${this.save.pet.name}`);
    this.rebuildInteractionTargets();
  }

  private openPetPanel(): void {
    if (!this.save.pet) return;
    this.petPanelOpen = true;
    this.renderPetPanel();
  }

  private renderPetPanel(): void {
    const pet = this.save.pet;
    if (!pet) return;
    const def = PET_DEFS[pet.kind];
    const perk = unlockedPetPerk(pet);
    this.ctx.overlay.showPetPanel({
      name: pet.name,
      kindLabel: def.name,
      affection: pet.affection,
      bowlFilledToday: pet.bowlFilledToday,
      pettedToday: pet.pettedToday,
      collar: pet.collar,
      perkLabel: perk === 'comfort'
        ? 'Comfort: +stamina regen when still'
        : perk === 'forage-sniff'
        ? 'Forage Sniff: extra wild spawn each night'
        : null,
      onPet: () => {
        if (!this.save.pet) return;
        this.save.pet = petPet(this.save.pet);
        persistActiveSave();
        this.renderPetPanel();
      },
      onPlayFetch: () => {
        if (!this.save.pet) return;
        this.save.pet = playFetch(this.save.pet);
        persistActiveSave();
        this.renderPetPanel();
      },
      onFillBowl: () => {
        if (!this.save.pet) return;
        this.save.pet = fillBowl(this.save.pet);
        persistActiveSave();
        this.renderPetPanel();
      },
      onSwapKind: () => {
        if (!this.save.pet) return;
        const nextKind = this.save.pet.kind === 'tide-cat' ? 'bay-dog' : 'tide-cat';
        this.save.pet = { ...this.save.pet, kind: nextKind, name: nextKind === 'tide-cat' ? 'Pixel' : 'Drift' };
        persistActiveSave();
        this.refreshPetMesh();
        this.renderPetPanel();
      },
      onSetCollar: (c) => {
        if (!this.save.pet) return;
        this.save.pet = setCollar(this.save.pet, c);
        persistActiveSave();
        if (this.petMesh) refreshPetCollar(this.petMesh, this.save.pet);
        this.renderPetPanel();
      },
      onClose: () => {
        this.petPanelOpen = false;
        this.refreshHud();
      },
    });
  }

  private animalInsidePos(id: string): { x: number; z: number } {
    // Hens go inside the coop, goats inside the barn.
    const animal = this.save.animals?.[id];
    if (!animal) return { x: 0, z: 0 };
    if (animal.habitat === 'coop') return { x: -10, z: 6 };
    return { x: 8, z: 6 };
  }

  private animalOutsidePos(id: string, index: number): { x: number; z: number } {
    const animal = this.save.animals?.[id];
    if (!animal) return { x: 0, z: 0 };
    const offset = index * 0.7;
    if (animal.habitat === 'coop') return { x: -10.5 + offset, z: 4.0 };
    return { x: 7.0 + offset, z: 4.0 };
  }

  private refreshAnimalMeshes(): void {
    if (!this.scene) return;
    const live = this.save.animals ?? {};
    for (const [id, mesh] of [...this.animalMeshes.entries()]) {
      if (!live[id]) {
        disposeAnimal(mesh);
        this.animalMeshes.delete(id);
      }
    }
    let i = 0;
    for (const animal of Object.values(live)) {
      if (this.animalMeshes.has(animal.id)) {
        i++;
        continue;
      }
      const pos = animal.outside ? this.animalOutsidePos(animal.id, i) : this.animalInsidePos(animal.id);
      this.animalMeshes.set(animal.id, buildAnimalMesh(this.scene, animal.id, animal.kind, pos));
      i++;
    }
  }

  /** Reposition animals based on weather/time + outside flag. */
  private applyAnimalShelterState(): void {
    const minutes = this.clock.time.minutes;
    const wantsOutside = shouldBeOutside(minutes, this.weather);
    let i = 0;
    for (const animal of Object.values(this.save.animals ?? {})) {
      const next = wantsOutside;
      if (animal.outside !== next) {
        this.save.animals![animal.id] = { ...animal, outside: next };
      }
      const mesh = this.animalMeshes.get(animal.id);
      if (mesh) {
        moveAnimal(mesh, next ? this.animalOutsidePos(animal.id, i) : this.animalInsidePos(animal.id));
      }
      i++;
    }
    this.rebuildInteractionTargets();
  }

  private openAnimalPanel(): void {
    this.animalsPanelOpen = true;
    const rows: import('../ui/overlay').AnimalPanelRow[] = [];
    for (const a of Object.values(this.save.animals ?? {})) {
      const def = ANIMAL_DEFS[a.kind];
      const sheltered = !a.outside;
      const mood = moodOf({ animal: a, weather: this.weather, sheltered });
      rows.push({
        id: a.id,
        name: a.name,
        kindLabel: def.name,
        habitat: a.habitat,
        hearts: heartsOf(a),
        fedToday: a.fedToday,
        pettedToday: a.pettedToday,
        mood,
        daysToProduce: Math.max(0, def.daysToMature - a.daysSinceProduce),
      });
    }
    this.ctx.overlay.showAnimalPanel({
      rows,
      onClose: () => {
        this.animalsPanelOpen = false;
        this.refreshHud();
      },
    });
  }

  private handleAnimalInteract(id: string): void {
    const animal = this.save.animals?.[id];
    if (!animal) return;
    // First: try to pet (no inventory cost).
    if (!animal.pettedToday) {
      const next = petAnimal(animal);
      this.save.animals![id] = next;
      persistActiveSave();
      this.flashAction(`Petted ${animal.name}`);
      return;
    }
    // Second: try to feed (consumes 1 hay).
    const result = feedAnimal({ animal, container: this.save.inventory });
    if (!result.accepted) {
      this.flashAction(
        result.reason === 'no-feed' ? `${animal.name} needs hay` : `${animal.name} is fine`,
      );
      return;
    }
    this.save.animals![id] = result.animal;
    this.save.inventory = result.container;
    persistActiveSave();
    this.refreshHotbar();
    this.flashAction(`Fed ${animal.name}`);
  }

  private openMachine(id: string): void {
    const state = this.save.machines?.[id];
    if (!state) return;
    this.machinePanelOpen = true;
    this.machinePanelId = id;
    this.renderMachinePanel();
  }

  private renderMachinePanel(): void {
    const id = this.machinePanelId;
    if (!id) return;
    const state = this.save.machines?.[id];
    if (!state) return;
    const def = MACHINE_CATALOG[state.kind];
    const now = this.absoluteMinutesNow();
    const status = statusOf(state, now);
    const content = loadGameContent();
    const itemsById = new Map(content.items.map((i) => [i.id, i] as const));
    const nameOf = (iid: string) => itemsById.get(iid)?.name ?? iid;
    const have = (iid: string) => {
      let total = 0;
      for (const s of this.save.inventory.slots) {
        if (s && s.itemId === iid) total += s.qty;
      }
      return total;
    };
    let statusLine: string;
    let collectLabel: string | undefined;
    let recipes: import('../ui/overlay').MachinePanelRecipeRow[] | undefined;
    if (status === 'ready') {
      const recipe = def.recipes[state.recipeIndex!]!;
      statusLine = `Ready: ${recipe.outputQty}× ${nameOf(recipe.outputItemId)}`;
      collectLabel = `Collect ${nameOf(recipe.outputItemId)}`;
    } else if (status === 'processing') {
      const recipe = def.recipes[state.recipeIndex!]!;
      const left = remainingMinutes(state, now);
      const hrs = Math.floor(left / 60);
      const min = left % 60;
      statusLine = `Processing ${nameOf(recipe.outputItemId)} · ${hrs > 0 ? `${hrs}h ` : ''}${min}m left`;
    } else {
      statusLine = 'Idle — load an input.';
      recipes = def.recipes.map((recipe, recipeIndex) => {
        const inputHave = have(recipe.inputItemId);
        const fuelHave = recipe.fuelItemId ? have(recipe.fuelItemId) : undefined;
        const inputOk = inputHave >= recipe.inputQty;
        const fuelOk = recipe.fuelItemId ? (fuelHave ?? 0) >= (recipe.fuelQty ?? 1) : true;
        const daylightOk = !def.daylightOnly || (now % 1440 >= 6 * 60 && now % 1440 < 20 * 60);
        const loadable = inputOk && fuelOk && daylightOk;
        const reason = !inputOk
          ? 'Missing input'
          : !fuelOk
          ? `Missing ${nameOf(recipe.fuelItemId!)}`
          : !daylightOk
          ? 'Needs daylight'
          : undefined;
        return {
          recipeIndex,
          inputItemName: nameOf(recipe.inputItemId),
          inputQty: recipe.inputQty,
          inputHave,
          outputItemName: nameOf(recipe.outputItemId),
          outputQty: recipe.outputQty,
          fuelItemName: recipe.fuelItemId ? nameOf(recipe.fuelItemId) : undefined,
          fuelQty: recipe.fuelQty,
          fuelHave,
          processLabel: formatProcessLabel(recipe.processMinutes),
          loadable,
          loadDisabledReason: reason,
        };
      });
    }
    this.ctx.overlay.showMachinePanel({
      title: def.name,
      statusLine,
      recipes,
      collectLabel,
      onLoad: (recipeIndex) => this.handleMachineLoad(id, recipeIndex),
      onCollect: () => this.handleMachineCollect(id),
      onClose: () => {
        this.machinePanelOpen = false;
        this.machinePanelId = null;
        this.refreshHud();
      },
    });
  }

  private handleMachineLoad(id: string, recipeIndex: number): void {
    const state = this.save.machines?.[id];
    if (!state) return;
    const def = MACHINE_CATALOG[state.kind];
    const recipe = def.recipes[recipeIndex];
    if (!recipe) return;
    const result = loadMachine({
      state,
      container: this.save.inventory,
      itemId: recipe.inputItemId,
      nowAbsoluteMinutes: this.absoluteMinutesNow(),
    });
    if (!result.accepted) return;
    this.save.machines![id] = result.state;
    this.save.inventory = result.container;
    persistActiveSave();
    this.paintAllMachines();
    this.renderMachinePanel();
  }

  private handleMachineCollect(id: string): void {
    const state = this.save.machines?.[id];
    if (!state) return;
    const result = collectMachine({
      state,
      container: this.save.inventory,
      nowAbsoluteMinutes: this.absoluteMinutesNow(),
    });
    if (!result.accepted) return;
    this.save.machines![id] = result.state;
    this.save.inventory = result.container;
    persistActiveSave();
    this.paintAllMachines();
    this.refreshHotbar();
    this.renderMachinePanel();
  }

  private checkMachineReadyTransitions(): void {
    const now = this.absoluteMinutesNow();
    const ready = newlyReady(Object.values(this.save.machines ?? {}), this.lastMachineCheckMinutes, now);
    this.lastMachineCheckMinutes = now;
    if (ready.length > 0) {
      playReadyChime();
      const def = MACHINE_CATALOG[ready[0]!.kind];
      this.flashAction(
        ready.length === 1 ? `${def.name} is ready` : `${ready.length} machines ready`,
      );
    }
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

    // Prompt 054: gathering a world item advances foraging quest objectives.
    if (result.reward) {
      const completed = recordActiveQuestEvent({
        kind: 'forage',
        target: result.reward.itemId,
        qty: result.reward.qty,
      });
      if (completed.length > 0) {
        this.flashQuestOutcomes({ completed, failed: [] });
        this.refreshHotbar();
      }
    }
  }

  private startFirstMorningCutscene(): void {
    if (this.cutsceneRunner) return;
    const previousTarget = this.camera.lockedTarget;
    this.camera.lockedTarget = null;
    const anchors: Record<string, Vector3> = {
      'farm-overview': new Vector3(0, 0.5, 0),
      'farmhouse-door': new Vector3(-10, 0.9, -5.6),
    };
    this.cutsceneRunner = startCutscene(FIRST_MORNING_CUTSCENE, {
      scene: this.scene,
      camera: this.camera,
      overlay: this.ctx.overlay,
      resolveAnchor: (id) => anchors[id]?.clone() ?? Vector3.Zero(),
      onSetFlag: (flag, value) => {
        this.save.flags[flag] = value;
        persistActiveSave();
      },
      onGiveItem: (itemId, qty, quality) => {
        const added = addItem(this.save.inventory, itemId, qty, quality ?? 0);
        this.save.inventory = added.container;
        persistActiveSave();
        this.refreshHotbar();
      },
    });
    // Restore camera target when the cutscene ends.
    this.save.flags['_cutscene-resume-target'] = JSON.stringify({
      // marker only — used by endCutscene to restore the locked target
    });
    void previousTarget; // restored via endCutscene calling lockedTarget = this.player
  }

  private endCutscene(): void {
    this.camera.lockedTarget = this.player;
    this.cutsceneRunner = null;
    this.refreshHud();
    this.refreshHotbar();
  }

  private triggerSleep(collapsed: boolean): void {
    if (this.dayResolving) return;
    this.dayResolving = true;
    this.clock = pauseClock(this.clock, true);

    const content = loadGameContent();
    const ledger = getDayLedger();
    // Prompt 054: capture what's being shipped before resolveDay drains the bin,
    // so "ship" quest objectives can credit each item.
    const shippedStacks = this.save.shippingBin.slots
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map((s) => ({ itemId: s.itemId, qty: s.qty }));
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

    // Prompt 054: credit shipped items, then run the quest day-tick (timer
    // expiry for non-story quests + standing-objective refresh). Surface any
    // completions/expiries in the bedtime summary.
    const questCompleted: Array<{ name: string }> = [];
    for (const stack of shippedStacks) {
      questCompleted.push(...recordActiveQuestEvent({ kind: 'ship', target: stack.itemId, qty: stack.qty }));
    }
    const questTick = reconcileActiveQuests(true);
    for (const quest of [...questCompleted, ...questTick.completed]) {
      result.summary.notices.push(`Quest complete: ${quest.name}`);
    }
    for (const quest of questTick.failed) {
      result.summary.notices.push(`Quest expired: ${quest.name}`);
    }
    if (result.collapse) {
      this.controller = { ...this.controller, stamina: result.collapse.wakeStamina };
    } else {
      this.controller = { ...this.controller, stamina: 100 };
    }
    persistActiveSave();
    this.clock = setClockTime(this.clock, result.nextTime);
    this.player.position.copyFrom(this.homePosition);
    this.refreshWorldState();

    const continueDay = (): void => {
      this.pendingDaySummaryContinue = null;
      this.dayResolving = false;
      this.menuOpen = false;
      this.clock = pauseClock(this.clock, false);
      this.refreshCropMeshes();
      this.refreshEntityMeshes();
      // Catch up overnight machine transitions before the next tick fires.
      this.checkMachineReadyTransitions();
      this.paintAllMachines();
      this.refreshAnimalMeshes();
      this.applyAnimalShelterState();
      this.rebuildInteractionTargets();
      this.refreshHud();
    };
    // Held so an e2e can advance the day via debug instead of a canvas-load-
    // fragile click on the day-summary "Continue" button.
    this.pendingDaySummaryContinue = continueDay;
    this.ctx.overlay.showDaySummary(result.summary, continueDay);
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
