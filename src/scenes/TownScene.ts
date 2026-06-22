import {
  Scene,
  ArcRotateCamera,
  MeshBuilder,
  Vector3,
  type AbstractMesh,
  type Color3,
} from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, PALETTE } from '../render/scene-helpers';
import {
  getActiveSave,
  persistActiveSave,
  clearActiveSave,
} from '../engine/gameState';
import { writeSave } from '../engine/save';
import { recordActiveQuestEvent } from '../engine/quest-tracking';
import {
  activeProjectBoardRows,
  activeCompletedProjectFlags,
  contributeActive,
  reconcileActiveProjects,
} from '../engine/civic-tracking';
import {
  activeFestival,
  activeFestivalStallRows,
  buyFestivalStallItem,
  claimActiveFestivalRelationship,
  festivalBestScore,
  festivalMinigameSeed,
  isFestivalActiveNowOnSave,
  markActiveFestivalAttended,
  recordActiveMinigameRun,
} from '../engine/festival-tracking';
import {
  canClaimMinigame,
  canClaimRelationship,
  festivalWindowLabel,
  minigameRewardSummary,
  relationshipRewardSummary,
  startFestivalMinigame,
  tapFestivalSlot,
  type FestivalMinigameState,
} from '../engine/festival';
import { playFestivalChime } from '../audio/cues';
import { applySceneAudio, bindSceneAudioSettings } from '../audio/scene-audio';
import { buildActiveNoticeBoard } from '../engine/notice-tracking';
import type { CivicProject, Festival, Season } from '../data/schemas';
import { formatWorldStatus } from '../engine/format';
import { computeMoveVector, type MoveInput } from '../engine/movement';
import { createControllerState, stepController, type ControllerState } from '../engine/controller';
import { resolveInteraction, type InteractTarget } from '../engine/interaction';
import type { SaveData } from '../engine/saveModel';
import { loadGameContent } from '../data/content';
import { forecastFor } from '../engine/weather';
import { tideStateAt, type TideState } from '../engine/tide';
import { getGameTime } from '../engine/dayResolution';
import { createTimeClock, pauseClock, tickClock, type TimeClockState } from '../engine/timeClock';
import type { Weather } from '../data/schemas';
import { activeWaypoint, liveStep, type Waypoint } from '../engine/npcSchedule';
import { loadSchedule } from '../engine/schedules';
import { buildNpcGraybox, faceTo, type NpcGrayboxHandles } from '../render/npc-graybox';
import {
  pickChoice,
  run as runDialogue,
  type DialogueChoice,
  type DialogueGraph,
  type DialogueState,
  type RunResult,
} from '../engine/dialogue';
import {
  applyGift,
  buildTastingTable,
  isBirthdayToday,
  relationshipLevel,
  type TastingTable,
} from '../engine/friendship';
import { recordRelationshipChange } from '../engine/gameState';
import { addItem, removeItem } from '../engine/inventory';
import { hoursFor, isShopOpen, type ShopHours } from '../engine/shops';
import {
  activeBehaviorFor as npcActiveBehaviorFor,
  pickMoment as npcPickMoment,
  profileFor as npcProfileFor,
  reactiveGreeting as npcReactiveGreeting,
} from '../engine/npcLifeBehaviors';

interface TownBuilding {
  id: string;
  label: string;
  position: [number, number];
  width: number;
  depth: number;
  height: number;
  color: Color3;
  roofColor: Color3;
}

const BUILDINGS: TownBuilding[] = [
  { id: 'market-bakery', label: 'Bakery', position: [-12, -4], width: 4, depth: 3.6, height: 3.0, color: PALETTE.wood, roofColor: PALETTE.roof },
  { id: 'market-clinic', label: 'Clinic', position: [-7, -4], width: 4, depth: 3.6, height: 3.0, color: PALETTE.stone, roofColor: PALETTE.roof },
  { id: 'market-library', label: 'Library', position: [-2, -4], width: 4.5, depth: 4, height: 3.4, color: PALETTE.wood, roofColor: PALETTE.roof },
  { id: 'market-gear', label: 'Gear Shop', position: [3, -4], width: 4, depth: 3.6, height: 3.0, color: PALETTE.wood, roofColor: PALETTE.roof },
  { id: 'fishmonger', label: 'Fishmonger', position: [8, -4], width: 4, depth: 3.6, height: 2.8, color: PALETTE.wood, roofColor: PALETTE.sea },
  { id: 'community-hall', label: 'Community Hall', position: [-5, 3], width: 7, depth: 5, height: 4.0, color: PALETTE.stone, roofColor: PALETTE.roof },
  { id: 'schoolhouse', label: 'Schoolhouse', position: [4, 4], width: 5, depth: 4, height: 3.2, color: PALETTE.wood, roofColor: PALETTE.roof },
  { id: 'blacksmith', label: 'Blacksmith', position: [11, 3], width: 4.5, depth: 4, height: 3.0, color: PALETTE.cliff, roofColor: PALETTE.roof },
  { id: 'apartments', label: 'Apartments', position: [-12, 4], width: 4, depth: 4.5, height: 4.0, color: PALETTE.wood, roofColor: PALETTE.roof },
];

interface LiveNpc {
  id: string;
  name: string;
  handles: NpcGrayboxHandles;
  position: Vector3;
  currentWaypoint: Waypoint | null;
}

const NPC_WALK_SPEED = 1.6; // m/s; deliberately slower than the player

interface NpcSeed {
  id: string;
  name: string;
  bodyColor: Color3;
  /** CSS color string used for the dialogue portrait — derived from bodyColor. */
  portraitCss: string;
  graph: DialogueGraph;
}

function buildGreetGraph(npcId: string, greet: string, followUp: string): DialogueGraph {
  return {
    startNodeId: 'greet',
    nodes: {
      greet: {
        id: 'greet',
        speakerNpcId: npcId,
        body: greet,
        choices: [
          { id: 'tell-more', label: 'Tell me more', next: 'more' },
          { id: 'wave-off', label: 'See you around' },
        ],
      },
      more: {
        id: 'more',
        speakerNpcId: npcId,
        body: followUp,
      },
    },
  };
}

const NPC_SEEDS: NpcSeed[] = [
  {
    id: 'mara-vale',
    name: 'Mara Vale',
    bodyColor: PALETTE.player,
    portraitCss: '#2e5c8a',
    graph: buildGreetGraph(
      'mara-vale',
      'Morning, neighbor. The harbor winch is still rattling — come find me when you have a spare hour.',
      'Once the lighthouse beacon is back lit, the whole harbor schedule clicks. Take your time getting there.',
    ),
  },
  {
    id: 'jun-park',
    name: 'Jun Park',
    bodyColor: PALETTE.roof,
    portraitCss: '#8c402f',
    graph: buildGreetGraph(
      'jun-park',
      "Loaves are on the rack at noon — drop in if the day gets long.",
      'Try a thumb of harborlime in your bread water sometime. Brightens the crumb.',
    ),
  },
  {
    id: 'sol-aranda',
    name: 'Sol Aranda',
    bodyColor: PALETTE.grass,
    portraitCss: '#3d7e48',
    graph: buildGreetGraph(
      'sol-aranda',
      'I logged a thaw-stripe in the bluff seeds — best planted before the next windstorm.',
      "Bring me a Bell Pea pod and I'll show you the press notes from the storm year.",
    ),
  },
  {
    id: 'lio-marin',
    name: 'Lio Marin',
    bodyColor: PALETTE.accent,
    portraitCss: '#54b9ac',
    graph: buildGreetGraph(
      'lio-marin',
      'Tide pulled three crab pots loose last night. Storm season is early this year.',
      'Watch the pier at low tide tomorrow — I might let you help reset the pots.',
    ),
  },
];

/**
 * Ballast Bay (VS-A4). Promoted from a placeholder PlaceScene into a full
 * walkable GameScene with player movement, camera, interaction, and one live
 * NPC (Mara Vale) walking her schedule across the Town waypoints. Interacting
 * with her opens a minimal dialogue bubble. The other 3 NPCs ship at RF-11.
 */
export class TownScene extends GameScene {
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
  private dialogueOpen = false;
  private ePrev = false;
  private readonly pressed = new Set<string>();
  private readonly onKeyDown = (e: KeyboardEvent) => this.pressed.add(e.key.toLowerCase());
  private readonly onKeyUp = (e: KeyboardEvent) => this.pressed.delete(e.key.toLowerCase());

  private flag: AbstractMesh | null = null;
  private flagAge = 0;
  private readonly npcs = new Map<string, LiveNpc>();
  private tastingTable: TastingTable = {};
  /** Prompt 055: per-project graybox meshes shown when that project completes. */
  private readonly civicMeshes = new Map<string, AbstractMesh[]>();
  /** Prompt 056: today's festival (null on an ordinary day) + festival dressing meshes. */
  private festival: Festival | null = null;
  private readonly festivalMeshes: AbstractMesh[] = [];
  /** Prompt 057: commemorative dressing raised only on a year-two+ festival. */
  private readonly festivalYearTwoMeshes: AbstractMesh[] = [];
  private festivalMinigame: FestivalMinigameState | null = null;
  private festivalMinigameResult: string | null = null;

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    scene.collisionsEnabled = true;
    addFog(scene, PALETTE.fog, 0.018);
    addLights(scene);

    this.camera = new ArcRotateCamera(
      'town-cam',
      -Math.PI / 2 + 0.6,
      Math.PI / 3.2,
      18,
      Vector3.Zero(),
      scene,
    );
    this.camera.fov = 0.8;

    const ground = MeshBuilder.CreateGround('ground', { width: 60, height: 60 }, scene);
    ground.material = flatMaterial(scene, 'ground', PALETTE.sand, 0.25);

    this.buildMarketLane(scene);
    this.buildBuildings(scene);
    this.buildHarbor(scene);
    this.buildLanternPoles(scene);
    this.buildCivicBoard(scene);
    this.buildCivicAssets(scene);
    this.buildFestivalDressing(scene);
    this.buildNoticeBoard(scene);

    const player = MeshBuilder.CreateCapsule('player', { height: 1.8, radius: 0.4 }, scene);
    player.position.set(0, 0.9, 8);
    player.material = flatMaterial(scene, 'player', PALETTE.player, 0.35);
    player.checkCollisions = true;
    player.ellipsoid = new Vector3(0.4, 0.9, 0.4);
    this.player = player;
    this.camera.lockedTarget = player;

    this.scene = scene;
    return scene;
  }

  private buildMarketLane(scene: Scene): void {
    const lane = MeshBuilder.CreateGround('market-lane', { width: 36, height: 4.2 }, scene);
    lane.position.set(-2, 0.01, 0);
    lane.material = flatMaterial(scene, 'market-lane', PALETTE.cliff, 0.18);
  }

  private buildBuildings(scene: Scene): void {
    for (const b of BUILDINGS) {
      const [x, z] = b.position;
      const body = MeshBuilder.CreateBox(`town-${b.id}-body`, {
        width: b.width,
        depth: b.depth,
        height: b.height,
      }, scene);
      body.position.set(x, b.height / 2, z);
      body.material = flatMaterial(scene, `mat-${b.id}-body`, b.color, 0.22);
      body.checkCollisions = true;
      const roof = MeshBuilder.CreateCylinder(`town-${b.id}-roof`, {
        height: 1.4,
        diameterTop: 0,
        diameterBottom: Math.max(b.width, b.depth) + 0.6,
        tessellation: 4,
      }, scene);
      roof.position.set(x, b.height + 0.7, z);
      roof.rotation.y = Math.PI / 4;
      roof.material = flatMaterial(scene, `mat-${b.id}-roof`, b.roofColor, 0.22);
      const door = MeshBuilder.CreateBox(`town-${b.id}-door`, { width: 0.9, depth: 0.1, height: 1.6 }, scene);
      door.position.set(x, 0.8, z + b.depth / 2 + 0.05);
      door.material = flatMaterial(scene, `mat-${b.id}-door`, PALETTE.interior, 0.22);
    }
  }

  private buildHarbor(scene: Scene): void {
    const water = MeshBuilder.CreateGround('harbor-water', { width: 40, height: 16 }, scene);
    water.position.set(0, 0.02, -16);
    water.material = flatMaterial(scene, 'harbor-water', PALETTE.sea, 0.32);

    const pier = MeshBuilder.CreateBox('harbor-pier', { width: 12, depth: 1.6, height: 0.4 }, scene);
    pier.position.set(0, 0.2, -10);
    pier.material = flatMaterial(scene, 'harbor-pier', PALETTE.wood, 0.22);
    pier.checkCollisions = true;

    const boatA = MeshBuilder.CreateBox('harbor-boatA', { width: 3, depth: 1.2, height: 0.7 }, scene);
    boatA.position.set(-4, 0.45, -13);
    boatA.material = flatMaterial(scene, 'boat-a', PALETTE.wood, 0.22);

    const boatB = MeshBuilder.CreateBox('harbor-boatB', { width: 3.5, depth: 1.4, height: 0.7 }, scene);
    boatB.position.set(4, 0.45, -14);
    boatB.material = flatMaterial(scene, 'boat-b', PALETTE.wood, 0.22);

    const flagPole = MeshBuilder.CreateCylinder('flag-pole', { height: 5, diameter: 0.2 }, scene);
    flagPole.position.set(-5, 2.5, 3);
    flagPole.material = flatMaterial(scene, 'flag-pole', PALETTE.cliff, 0.22);
    const flag = MeshBuilder.CreateBox('flag', { width: 1.4, depth: 0.05, height: 0.8 }, scene);
    flag.position.set(-4.2, 4.5, 3);
    flag.material = flatMaterial(scene, 'flag', PALETTE.accent, 0.3);
    this.flag = flag;
  }

  private buildLanternPoles(scene: Scene): void {
    const offsets: Array<[number, number]> = [
      [-14, 0], [-9, 0], [-3, 0], [3, 0], [9, 0], [14, 0],
    ];
    offsets.forEach(([x, z], i) => {
      const pole = MeshBuilder.CreateCylinder(`lantern-pole-${i}`, { height: 3, diameter: 0.18 }, scene);
      pole.position.set(x, 1.5, z);
      pole.material = flatMaterial(scene, `lantern-pole-${i}`, PALETTE.cliff, 0.18);
      const lamp = MeshBuilder.CreateSphere(`lantern-lamp-${i}`, { diameter: 0.55 }, scene);
      lamp.position.set(x, 3.05, z);
      lamp.material = flatMaterial(scene, `lantern-lamp-${i}`, PALETTE.warmLight, 0.45);
    });
  }

  /** Prompt 058: a public notice board by the lane — forecast, requests, and town news. */
  private buildNoticeBoard(scene: Scene): void {
    const post = MeshBuilder.CreateBox('notice-board-post', { width: 0.16, depth: 0.16, height: 1.5 }, scene);
    post.position.set(-9, 0.75, 3.6);
    post.material = flatMaterial(scene, 'notice-board-post', PALETTE.cliff, 0.2);
    const board = MeshBuilder.CreateBox('notice-board', { width: 1.6, depth: 0.12, height: 1.1 }, scene);
    board.position.set(-9, 1.55, 3.6);
    board.material = flatMaterial(scene, 'notice-board', PALETTE.sand, 0.2);
    const cap = MeshBuilder.CreateBox('notice-board-cap', { width: 1.8, depth: 0.2, height: 0.18 }, scene);
    cap.position.set(-9, 2.2, 3.6);
    cap.material = flatMaterial(scene, 'notice-board-cap', PALETTE.roof, 0.2);
  }

  /** Prompt 055: a rope-bound notice board near the market lane — opens the civic project board. */
  private buildCivicBoard(scene: Scene): void {
    const post = MeshBuilder.CreateBox('civic-board-post', { width: 0.16, depth: 0.16, height: 1.6 }, scene);
    post.position.set(3, 0.8, 4);
    post.material = flatMaterial(scene, 'civic-board-post', PALETTE.wood, 0.2);
    const board = MeshBuilder.CreateBox('civic-board', { width: 1.5, depth: 0.12, height: 1.0 }, scene);
    board.position.set(3, 1.5, 4);
    board.material = flatMaterial(scene, 'civic-board', PALETTE.sand, 0.2);
  }

  /**
   * Prompt 055: per-project completion meshes, built hidden. `applyCivicState()`
   * reveals them once `save.projects[id].complete` — the visible map change.
   */
  private buildCivicAssets(scene: Scene): void {
    // The Netlight Beacon — a warm lamp atop the harbor flag pole.
    const beaconLamp = MeshBuilder.CreateSphere('civic-beacon-lamp', { diameter: 0.9 }, scene);
    beaconLamp.position.set(-5, 5.3, 3);
    beaconLamp.material = flatMaterial(scene, 'civic-beacon-lamp', PALETTE.warmLight, 0.7);
    beaconLamp.isVisible = false;
    this.civicMeshes.set('netlight-beacon', [beaconLamp]);

    // Market Lane Canopies — salt-canvas awnings down the lane.
    const canopies: AbstractMesh[] = [];
    for (const [i, x] of [-12, -4, 4, 12].entries()) {
      const canopy = MeshBuilder.CreateBox(`civic-canopy-${i}`, { width: 3.2, depth: 2.4, height: 0.25 }, scene);
      canopy.position.set(x, 2.6, 0);
      canopy.rotation.z = 0.08;
      canopy.material = flatMaterial(scene, `civic-canopy-${i}`, PALETTE.accent, 0.28);
      canopy.isVisible = false;
      canopies.push(canopy);
    }
    this.civicMeshes.set('market-canopies', canopies);

    // Belltide Boardwalk — a plank path running out toward the marsh.
    const planks: AbstractMesh[] = [];
    for (const [i, z] of [10, 13, 16, 19].entries()) {
      const plank = MeshBuilder.CreateBox(`civic-boardwalk-${i}`, { width: 2.4, depth: 2.6, height: 0.2 }, scene);
      plank.position.set(12, 0.2, z);
      plank.material = flatMaterial(scene, `civic-boardwalk-${i}`, PALETTE.wood, 0.2);
      plank.isVisible = false;
      planks.push(plank);
    }
    this.civicMeshes.set('belltide-boardwalk', planks);
  }

  /**
   * Prompt 056: festival dressing built hidden near the market-lane common — a
   * banner arch, a small stage platform, and a string of festival lanterns.
   * `refreshFestival()` toggles them on the festival day (the visible map setup).
   * The stage at (-2, 2) is the festival interaction anchor.
   */
  private buildFestivalDressing(scene: Scene): void {
    const stage = MeshBuilder.CreateCylinder('festival-stage', { height: 0.3, diameter: 3.2, tessellation: 8 }, scene);
    stage.position.set(-2, 0.15, 2);
    stage.material = flatMaterial(scene, 'festival-stage', PALETTE.wood, 0.2);
    this.festivalMeshes.push(stage);

    // Banner arch — two posts + a bunting beam over the common.
    for (const [i, x] of [-5, 1].entries()) {
      const post = MeshBuilder.CreateCylinder(`festival-post-${i}`, { height: 3.4, diameter: 0.18 }, scene);
      post.position.set(x, 1.7, 2);
      post.material = flatMaterial(scene, `festival-post-${i}`, PALETTE.cliff, 0.2);
      this.festivalMeshes.push(post);
    }
    const banner = MeshBuilder.CreateBox('festival-banner', { width: 6.4, depth: 0.12, height: 0.7 }, scene);
    banner.position.set(-2, 3.4, 2);
    banner.material = flatMaterial(scene, 'festival-banner', PALETTE.accent, 0.32);
    this.festivalMeshes.push(banner);

    // A string of festival lanterns along the lane.
    for (const [i, x] of [-6, -3, 0, 3].entries()) {
      const lamp = MeshBuilder.CreateSphere(`festival-lantern-${i}`, { diameter: 0.5 }, scene);
      lamp.position.set(x, 3.2, 2);
      lamp.material = flatMaterial(scene, `festival-lantern-${i}`, PALETTE.warmLight, 0.5);
      this.festivalMeshes.push(lamp);
    }

    // Prompt 057: a commemorative founders' pillar raised only on year-two+
    // festivals (the visible "year-two map variation") — a taller second banner.
    const commemorative = MeshBuilder.CreateBox('festival-yeartwo-banner', { width: 5.0, depth: 0.12, height: 0.55 }, scene);
    commemorative.position.set(-2, 4.2, 2);
    commemorative.material = flatMaterial(scene, 'festival-yeartwo-banner', PALETTE.warmLight, 0.4);
    this.festivalYearTwoMeshes.push(commemorative);

    for (const mesh of [...this.festivalMeshes, ...this.festivalYearTwoMeshes]) mesh.isVisible = false;
  }

  /** Reveal the completion meshes for every finished project. */
  private applyCivicState(): void {
    const completed = new Set(
      Object.entries(this.save.projects ?? {})
        .filter(([, s]) => s.complete)
        .map(([id]) => id),
    );
    for (const [projectId, meshes] of this.civicMeshes) {
      const visible = completed.has(projectId);
      for (const mesh of meshes) mesh.isVisible = visible;
    }
  }

  override enter(): void {
    const save = getActiveSave();
    if (!save) {
      this.goTo('Title', undefined, false);
      return;
    }
    this.save = save;
    save.location.sceneKey = 'Town';
    writeSave(save);
    // Prompt 061: load the mixer settings; the Town soundtrack is applied from
    // refreshWorldState (and swaps to the festival theme on a festival day).
    bindSceneAudioSettings(save, () => persistActiveSave());
    // Prompt 054: arriving credits "visit Ballast Bay" exploration objectives.
    recordActiveQuestEvent({ kind: 'visit', target: 'Town' });
    this.controller = createControllerState();
    this.clock = createTimeClock(getGameTime(save));
    this.refreshWorldState();
    const content = loadGameContent();
    this.tastingTable = buildTastingTable(content.npcs);

    // RF-11: build all four NPCs at scene-enter; off-Town ones spawn parked
    // below the ground and surface only when their schedule routes them here.
    for (const seed of NPC_SEEDS) {
      const schedule = loadSchedule(seed.id);
      if (!schedule) continue;
      const wp = activeWaypoint(schedule, this.scheduleContext());
      const onTown = wp?.sceneKey === 'Town';
      const start = onTown
        ? new Vector3(wp.x, 0.9, wp.z)
        : new Vector3(-8, -10, -3); // off-stage; raise on schedule-tick
      const handles = buildNpcGraybox({
        scene: this.scene,
        npcId: seed.id,
        position: { x: start.x, z: start.z },
        bodyColor: seed.bodyColor,
      });
      if (!onTown) handles.root.position.y = -10;
      this.npcs.set(seed.id, {
        id: seed.id,
        name: seed.name,
        handles,
        position: start.clone(),
        currentWaypoint: wp,
      });
    }

    // Prompt 055: advance projects whose relationship gates are now met, then
    // reveal the completion meshes for every finished project (visible map change).
    reconcileActiveProjects();
    this.applyCivicState();

    // Prompt 056: if today is a festival, raise the dressing, play the festival
    // cue, and mark attendance (the schedule + shop changes flow from `festival`).
    this.refreshFestival(true);

    this.rebuildTargets();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.menuOpen = false;
    this.dialogueOpen = false;
    this.refreshHud();

    // RF-11 debug surface — the e2e + a curious developer can read live state.
    (window as unknown as {
      sturdyVolleyTown?: {
        npcs: () => Array<{ id: string; pos: { x: number; z: number }; sceneKey: string }>;
        targets: () => Array<{ id: string; label: string; x: number; z: number; radius: number }>;
        nearest: () => string | null;
        projects: () => Array<{ id: string; name: string; complete: boolean; phaseIndex: number; phaseCount: number }>;
        openCivicBoard: () => void;
        contributeProject: (id: string, reqIndex: number) => { accepted: number; completed: string | null };
        completedFlags: () => string[];
        civicMeshVisible: (id: string) => boolean;
        grantItem: (itemId: string, qty: number) => void;
        setRelationship: (npcId: string, points: number) => void;
        // Prompt 056 — festivals.
        setDate: (season: string, day: number) => void;
        festivalToday: () => { id: string; name: string } | null;
        festivalActiveNow: () => boolean;
        festivalScheduleId: () => string | null;
        festivalDressingVisible: () => boolean;
        openFestival: () => void;
        minigameState: () => { round: number; rounds: number; score: number; goal: number; activeSlot: number; finished: boolean; won: boolean } | null;
        playMinigameToWin: () => { won: boolean; score: number; granted: boolean; rewardSummary: string | null };
        stallRows: () => Array<{ itemId: string; name: string; price: number }>;
        buyStall: (itemId: string) => { bought: boolean; reason?: string; price: number };
        shareMoment: () => { claimed: boolean; npcId: string | null; rewardSummary: string | null };
        walletGold: () => number;
        // Prompt 057 — phase two: gating + year-two.
        festivalYearTwoDressingVisible: () => boolean;
        completeRestoration: () => void;
        setYear: (year: number) => void;
        // Prompt 058 — notice board.
        openNoticeBoard: () => void;
        noticeBoard: () => { forecast: string[]; requests: string[]; news: string[]; summary: string } | null;
      };
    }).sturdyVolleyTown = {
      npcs: () => {
        const out: Array<{ id: string; pos: { x: number; z: number }; sceneKey: string }> = [];
        for (const npc of this.npcs.values()) {
          out.push({
            id: npc.id,
            pos: { x: npc.position.x, z: npc.position.z },
            sceneKey: npc.currentWaypoint?.sceneKey ?? '—',
          });
        }
        return out;
      },
      targets: () =>
        this.targets.map((t) => ({ id: t.id, label: t.label, x: t.x, z: t.z, radius: t.radius })),
      nearest: () => this.nearest?.id ?? null,
      // Prompt 055 — civic project board.
      projects: () =>
        activeProjectBoardRows().map((r) => ({
          id: r.id,
          name: r.name,
          complete: r.complete,
          phaseIndex: r.phaseIndex,
          phaseCount: r.phaseCount,
        })),
      openCivicBoard: () => this.openCivicBoard(),
      contributeProject: (id: string, reqIndex: number) => {
        const result = this.handleContributionForDebug(id, reqIndex);
        return result;
      },
      completedFlags: () => activeCompletedProjectFlags(),
      civicMeshVisible: (id: string) => (this.civicMeshes.get(id) ?? []).every((m) => m.isVisible) && (this.civicMeshes.get(id)?.length ?? 0) > 0,
      grantItem: (itemId: string, qty: number) => {
        this.save.inventory = addItem(this.save.inventory, itemId, qty, 0).container;
        persistActiveSave();
      },
      setRelationship: (npcId: string, points: number) => {
        this.save.relationships[npcId] = points;
        persistActiveSave();
      },
      // Prompt 056 — festivals.
      setDate: (season: string, day: number) => this.debugSetDate(season as Season, day),
      festivalToday: () => (this.festival ? { id: this.festival.id, name: this.festival.name } : null),
      festivalActiveNow: () => isFestivalActiveNowOnSave(),
      festivalScheduleId: () => this.scheduleContext().festivalId,
      festivalDressingVisible: () => this.festivalMeshes.length > 0 && this.festivalMeshes.every((m) => m.isVisible),
      openFestival: () => this.openFestival(),
      minigameState: () => {
        const s = this.festivalMinigame;
        return s
          ? { round: s.round, rounds: s.rounds, score: s.score, goal: s.goal, activeSlot: s.activeSlot, finished: s.finished, won: s.won }
          : null;
      },
      playMinigameToWin: () => this.debugPlayMinigameToWin(),
      stallRows: () => activeFestivalStallRows(),
      buyStall: (itemId: string) => {
        const id = this.festival?.id ?? '';
        const r = buyFestivalStallItem(id, itemId);
        return { bought: r.bought, reason: r.reason, price: r.price };
      },
      shareMoment: () => {
        const id = this.festival?.id ?? '';
        const r = claimActiveFestivalRelationship(id);
        return { claimed: r.claimed, npcId: r.npcId, rewardSummary: r.rewardSummary };
      },
      walletGold: () => this.save.wallet.gold,
      festivalYearTwoDressingVisible: () =>
        this.festivalYearTwoMeshes.length > 0 && this.festivalYearTwoMeshes.every((m) => m.isVisible),
      completeRestoration: () => this.debugCompleteRestoration(),
      setYear: (year: number) => {
        this.save.calendar.year = year;
        this.clock.time.year = year;
        persistActiveSave();
        this.refreshFestival(false);
        this.rebuildTargets();
      },
      openNoticeBoard: () => this.openNoticeBoard(),
      noticeBoard: () => {
        const b = buildActiveNoticeBoard();
        return b
          ? { forecast: b.forecast.map((r) => r.text), requests: b.requests.map((r) => r.text), news: b.news.map((r) => r.text), summary: b.summary }
          : null;
      },
    };
  }

  /**
   * Debug/e2e: force every civic restoration project complete (sets the
   * `civic:<id>` flags the Founders Harvest Fair gates on), reveal their meshes,
   * and persist. Pairs with `setRelationship` to satisfy the festival's gate.
   */
  private debugCompleteRestoration(): void {
    const defs = loadGameContent().projects;
    for (const def of defs) {
      this.save.projects[def.id] = {
        phase: def.phases.length,
        contributed: def.phases.map((ph) => ph.requirements.map(() => 0)),
        complete: true,
        completedDay: 0,
      };
    }
    persistActiveSave();
    this.applyCivicState();
    this.refreshFestival(false);
    this.rebuildTargets();
  }

  /** Debug/e2e: jump the active save to a season + day, then re-resolve the festival. */
  private debugSetDate(season: Season, day: number): void {
    this.save.calendar.season = season;
    this.save.calendar.day = day;
    this.clock.time.season = season;
    this.clock.time.day = day;
    persistActiveSave();
    this.refreshFestival(true);
    this.rebuildTargets();
  }

  /** Debug/e2e: start the festival minigame and tap the lit slot every round to win, then record it. */
  private debugPlayMinigameToWin(): { won: boolean; score: number; granted: boolean; rewardSummary: string | null } {
    if (!this.festival || !this.festival.minigame) return { won: false, score: 0, granted: false, rewardSummary: null };
    const seed = festivalMinigameSeed(this.festival);
    let state = startFestivalMinigame(this.festival, seed);
    if (!state) return { won: false, score: 0, granted: false, rewardSummary: null };
    while (!state.finished) {
      state = tapFestivalSlot(state, state.activeSlot, seed).state;
    }
    this.festivalMinigame = state;
    const outcome = recordActiveMinigameRun(this.festival.id, state.score, state.won);
    return { won: state.won, score: state.score, granted: outcome.granted, rewardSummary: outcome.rewardSummary };
  }

  /** Debug-only contribution that also applies the map change + ceremony, returning a serializable result. */
  private handleContributionForDebug(projectId: string, reqIndex: number): { accepted: number; completed: string | null } {
    const result = contributeActive(projectId, reqIndex);
    if (result.completed) {
      this.applyCivicState();
      this.rebuildTargets();
      this.showCeremony(result.completed);
    }
    return { accepted: result.accepted, completed: result.completed?.id ?? null };
  }

  private scheduleContext() {
    return {
      minutes: this.clock.time.minutes,
      season: this.save.calendar.season,
      weatherId: this.weather?.id ?? null,
      // Prompt 056: on a festival day the `byFestival` schedule layer routes NPCs
      // to the festival grounds instead of their ordinary day.
      festivalId: this.festival?.id ?? null,
      relationshipLevel: 0,
      // Prompt 055: completed projects activate `byEvent` schedule layers
      // (e.g. Mara tends the relit beacon in the evening instead of leaving town).
      activeEventFlags: activeCompletedProjectFlags(),
    };
  }

  private npcName(npcId: string): string | undefined {
    return NPC_SEEDS.find((s) => s.id === npcId)?.name;
  }

  private openCivicBoard(): void {
    this.menuOpen = true;
    this.renderCivicBoard();
  }

  /** Prompt 058: the town notice board — forecast, reasons to visit, and town news. */
  private openNoticeBoard(): void {
    const board = buildActiveNoticeBoard();
    if (!board) return;
    this.menuOpen = true;
    this.ctx.overlay.showNoticeBoardPanel({
      forecast: board.forecast.map((r) => r.text),
      requests: board.requests.map((r) => r.text),
      news: board.news.map((r) => r.text),
      summary: board.summary,
      onClose: () => {
        this.menuOpen = false;
        this.refreshHud();
      },
    });
  }

  private renderCivicBoard(): void {
    const rows = activeProjectBoardRows().map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      unlocks: r.unlocks,
      complete: r.complete,
      phaseLabel: `Phase ${r.phaseIndex + 1}/${r.phaseCount} · ${r.phaseName}`,
      phaseDescription: r.phaseDescription,
      requirements: r.requirements.map((req) => ({
        label: req.label,
        kind: req.kind,
        current: req.current,
        target: req.target,
        met: req.met,
        contributable: req.contributable,
      })),
      rewardSummary: r.rewardSummary,
      giver: r.giverNpcId ? this.npcName(r.giverNpcId) ?? r.giverNpcId : null,
    }));
    const inProgress = rows.filter((r) => !r.complete).length;
    const restored = rows.filter((r) => r.complete).length;
    this.ctx.overlay.showCivicBoardPanel({
      rows,
      summary: `${inProgress} in progress · ${restored} restored`,
      onContribute: (projectId, reqIndex) => this.handleContribution(projectId, reqIndex),
      onClose: () => {
        this.menuOpen = false;
        this.refreshHud();
      },
    });
  }

  private handleContribution(projectId: string, reqIndex: number): void {
    const result = contributeActive(projectId, reqIndex);
    if (result.completed) {
      this.applyCivicState();
      this.rebuildTargets();
      this.showCeremony(result.completed);
    } else {
      this.renderCivicBoard();
    }
  }

  private showCeremony(project: CivicProject): void {
    this.menuOpen = true;
    this.ctx.overlay.showCeremony({
      projectName: project.name,
      unlocks: project.unlocks,
      reactions: project.ceremony.map((c) => ({
        speaker: this.npcName(c.npcId) ?? c.npcId,
        line: c.line,
      })),
      // Return to the board so the player sees the project marked "Restored".
      onClose: () => this.renderCivicBoard(),
    });
  }

  /* Prompt 056 — festivals ------------------------------------------- */

  /**
   * Resolve today's festival for the active save and toggle the festival
   * dressing. On a festival day (`playCue`) it also plays the festival cue and
   * marks attendance. Called on scene-enter and on a debug date jump.
   */
  private refreshFestival(playCue: boolean): void {
    this.festival = activeFestival();
    const visible = this.festival !== null;
    for (const mesh of this.festivalMeshes) mesh.isVisible = visible;
    // Prompt 057: the commemorative dressing is up only on a year-two+ festival
    // whose `yearTwo.extraDressing` is set.
    const yearTwoUp = visible && this.save.calendar.year >= 2 && this.festival?.yearTwo?.extraDressing === true;
    for (const mesh of this.festivalYearTwoMeshes) mesh.isVisible = yearTwoUp;
    if (this.festival && playCue) {
      markActiveFestivalAttended(this.festival.id);
      playFestivalChime();
    }
  }

  private openFestival(): void {
    if (!this.festival) return;
    this.menuOpen = true;
    markActiveFestivalAttended(this.festival.id);
    this.renderFestivalPanel();
  }

  private festivalRewardNames() {
    const content = loadGameContent();
    const items = new Map(content.items.map((i) => [i.id, i.name] as const));
    return {
      item: (id: string) => items.get(id) ?? id,
      npc: (id: string) => this.npcName(id) ?? id,
    };
  }

  private renderFestivalPanel(): void {
    const festival = this.festival;
    if (!festival) {
      this.menuOpen = false;
      this.refreshHud();
      return;
    }
    this.menuOpen = true;
    const names = this.festivalRewardNames();
    const year = this.save.calendar.year;
    this.ctx.overlay.showFestivalPanel({
      name: festival.name,
      description: festival.description,
      windowLabel: festivalWindowLabel(festival),
      activeNow: isFestivalActiveNowOnSave(),
      minigame: festival.minigame
        ? {
            name: festival.minigame.name,
            description: festival.minigame.description,
            rewardSummary: minigameRewardSummary(festival, names),
            bestScore: festivalBestScore(festival.id),
            goal: festival.minigame.goalScore,
            claimedThisYear: !canClaimMinigame(this.save.festivals, festival, year),
          }
        : null,
      stallName: festival.stall?.name ?? null,
      relationship: festival.relationship
        ? {
            npcName: this.npcName(festival.relationship.npcId) ?? festival.relationship.npcId,
            rewardSummary: relationshipRewardSummary(festival, names),
            claimedThisYear: !canClaimRelationship(this.save.festivals, festival, year),
          }
        : null,
      onPlayMinigame: () => this.startFestivalMinigame(),
      onVisitStall: () => this.openFestivalStall(),
      onShareMoment: () => this.shareFestivalMoment(),
      onClose: () => {
        this.menuOpen = false;
        this.refreshHud();
      },
    });
  }

  private startFestivalMinigame(): void {
    if (!this.festival || !this.festival.minigame) return;
    const seed = festivalMinigameSeed(this.festival);
    this.festivalMinigame = startFestivalMinigame(this.festival, seed);
    this.festivalMinigameResult = null;
    this.renderFestivalMinigame();
  }

  private renderFestivalMinigame(): void {
    const festival = this.festival;
    const state = this.festivalMinigame;
    if (!festival || !festival.minigame || !state) {
      this.renderFestivalPanel();
      return;
    }
    const phase: 'play' | 'won' | 'lost' = !state.finished ? 'play' : state.won ? 'won' : 'lost';
    this.ctx.overlay.showFestivalMinigame({
      title: festival.minigame.name,
      instruction: festival.minigame.description,
      targetLabel: state.targetLabel,
      slots: state.slots,
      activeSlot: state.activeSlot,
      round: state.round,
      rounds: state.rounds,
      score: state.score,
      goal: state.goal,
      phase,
      resultSummary: this.festivalMinigameResult,
      onTap: (slot) => this.tapFestivalMinigame(slot),
      onReplay: () => this.startFestivalMinigame(),
      onClose: () => this.renderFestivalPanel(),
    });
  }

  private tapFestivalMinigame(slot: number): void {
    const festival = this.festival;
    const state = this.festivalMinigame;
    if (!festival || !state || state.finished) return;
    const seed = festivalMinigameSeed(festival);
    const result = tapFestivalSlot(state, slot, seed);
    this.festivalMinigame = result.state;
    if (result.finished) {
      const outcome = recordActiveMinigameRun(festival.id, result.state.score, result.state.won);
      this.festivalMinigameResult = outcome.rewardSummary;
      if (result.won) playFestivalChime();
    }
    this.renderFestivalMinigame();
  }

  private openFestivalStall(): void {
    const festival = this.festival;
    if (!festival || !festival.stall) {
      this.renderFestivalPanel();
      return;
    }
    const rows = activeFestivalStallRows();
    this.ctx.overlay.showShopPanel({
      shopName: festival.stall.name,
      walletGold: this.save.wallet.gold,
      entries: rows.map((r) => ({ itemId: r.itemId, itemName: r.name, price: r.price, remaining: -1 })),
      onBuy: (itemId) => {
        buyFestivalStallItem(festival.id, itemId);
        this.openFestivalStall(); // re-render with the updated wallet
      },
      onClose: () => this.renderFestivalPanel(),
    });
  }

  private shareFestivalMoment(): void {
    const festival = this.festival;
    if (!festival || !festival.relationship) {
      this.renderFestivalPanel();
      return;
    }
    const result = claimActiveFestivalRelationship(festival.id);
    const speaker = this.npcName(festival.relationship.npcId) ?? festival.relationship.npcId;
    if (!result.claimed) {
      this.renderFestivalPanel();
      return;
    }
    this.ctx.overlay.showDialoguePanel({
      speaker,
      body: result.line ?? festival.relationship.line,
      tierFlash: result.rewardSummary ? { tier: 'love', deltaText: result.rewardSummary } : undefined,
      onDismiss: () => this.renderFestivalPanel(),
    });
  }

  private rebuildTargets(): void {
    const base: InteractTarget[] = [];
    for (const npc of this.npcs.values()) {
      // Only interactable while she's actually on the Town map.
      const wp = npc.currentWaypoint;
      if (!wp || wp.sceneKey !== 'Town') continue;
      base.push({
        id: `npc:${npc.id}`,
        kind: 'npc',
        label: `Talk to ${npc.name}`,
        x: npc.position.x,
        z: npc.position.z,
        radius: 1.8,
        priority: 4,
      });
    }
    // RF-15: building doors. Each shop door appears as an interaction target
    // labeled with the building name and an open/closed badge based on
    // `engine/shops.ts` hours.
    const minutes = this.clock?.time?.minutes ?? this.save.calendar.timeMinutes;
    // Prompt 056: regular storefronts close on a festival day — the stalls move
    // to the festival grounds instead.
    const festivalActive = this.festival !== null;
    for (const b of BUILDINGS) {
      const [x, z] = b.position;
      const doorZ = z + b.depth / 2 + 0.4;
      const hours = hoursFor(b.id);
      const open = hours ? isShopOpen(hours, minutes, festivalActive) : !festivalActive;
      const closedLabel = festivalActive ? `${b.label} — closed for the festival` : `${b.label} — closed today`;
      base.push({
        id: `door:${b.id}`,
        kind: 'door',
        label: open ? `Enter the ${b.label}` : closedLabel,
        x,
        z: doorZ,
        radius: 1.2,
        priority: 3,
      });
    }
    // Prompt 055: the civic project board.
    base.push({
      id: 'civic-board',
      kind: 'prop',
      label: 'Read the restoration board',
      x: 3,
      z: 4.6,
      radius: 1.5,
      priority: 3,
    });
    // Prompt 058: the town notice board.
    base.push({
      id: 'notice-board',
      kind: 'prop',
      label: 'Read the notice board',
      x: -9,
      z: 4.2,
      radius: 1.6,
      priority: 3,
    });
    // Prompt 056: the festival stage anchor (only present on a festival day).
    if (this.festival) {
      base.push({
        id: 'festival-stage',
        kind: 'prop',
        label: `Join the ${this.festival.name}`,
        x: -2,
        z: 2,
        radius: 2.0,
        priority: 5,
      });
    }
    this.targets = base;
  }

  override update(dt: number): void {
    if (!this.save) return;
    super.update(dt);

    if (this.menuOpen || this.dialogueOpen) {
      this.clock = pauseClock(this.clock, true);
      this.controller = stepController(this.controller, { dir: { x: 0, z: 0 }, sprint: false }, dt);
      if (this.flag) {
        this.flagAge += dt * 0.2;
        this.flag.rotation.y = Math.sin(this.flagAge * 1.6) * 0.25;
      }
      return;
    }
    if (this.clock.paused) this.clock = pauseClock(this.clock, false);

    // Player movement.
    const dir = this.cameraRelativeDir(computeMoveVector(this.readInput()));
    const sprint = this.pressed.has('shift');
    this.controller = stepController(this.controller, { dir, sprint }, dt);
    if (this.controller.speed > 0.01 && (dir.x !== 0 || dir.z !== 0)) {
      this.player.moveWithCollisions(new Vector3(dir.x, 0, dir.z).scale(this.controller.speed * dt));
    }

    // NPC tick — walk every live NPC toward their active waypoint or park
    // them off-stage when their schedule routes them elsewhere.
    const ctx = this.scheduleContext();
    for (const npc of this.npcs.values()) {
      const schedule = loadSchedule(npc.id);
      if (!schedule) continue;
      const wp = activeWaypoint(schedule, ctx);
      npc.currentWaypoint = wp ?? null;
      if (wp && wp.sceneKey === 'Town') {
        const stepResult = liveStep({
          position: { x: npc.position.x, z: npc.position.z },
          target: wp,
          speed: NPC_WALK_SPEED,
          dt,
        });
        npc.position.set(stepResult.x, 0.9, stepResult.z);
        npc.handles.root.position.set(stepResult.x, 0.85, stepResult.z);
        faceTo(npc.handles.root, wp);
      } else {
        npc.handles.root.position.y = -10;
      }
    }
    this.rebuildTargets();

    this.nearest = resolveInteraction(this.targets, this.player.position.x, this.player.position.z);

    // Interaction.
    const interact = this.pressed.has('e') || this.pressed.has(' ');
    if (interact && !this.ePrev && this.nearest) {
      if (this.nearest.id.startsWith('npc:')) this.openNpcGreeting(this.nearest.id.slice('npc:'.length));
      else if (this.nearest.id.startsWith('door:')) this.handleDoor(this.nearest.id.slice('door:'.length));
      else if (this.nearest.id === 'civic-board') this.openCivicBoard();
      else if (this.nearest.id === 'notice-board') this.openNoticeBoard();
      else if (this.nearest.id === 'festival-stage') this.openFestival();
      else {
        this.actionLabel = this.nearest.label;
        this.actionTimer = 1.6;
      }
    }
    this.ePrev = interact;
    if (this.actionTimer > 0) this.actionTimer -= dt;

    // If a dialogue just opened, bail before the trailing HUD refresh — its
    // showHud() calls clear() which would wipe the bubble in the same frame.
    if (this.dialogueOpen) return;

    // Time tick — Town has no day-summary path of its own (sleep happens at
    // the farmhouse bed); time still advances, and a 2-AM collapse here
    // shuttles the player home via the PlaceScene-style collapse path.
    const tick = tickClock(this.clock, dt);
    this.clock = tick.state;
    if (tick.advancedMinutes > 0) {
      this.save.calendar.timeMinutes = this.clock.time.minutes;
      this.refreshWorldState();
    }
    if (tick.collapsed) {
      // Walk home — the Farm scene's own collapse handler picks up the resolved day.
      this.goTo('Farm', { entry: 'farmhouse-door' });
      return;
    }

    if (this.flag) {
      this.flagAge += dt;
      this.flag.rotation.y = Math.sin(this.flagAge * 1.6) * 0.25;
      this.flag.position.y = 4.5 + Math.sin(this.flagAge * 2.2) * 0.05;
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
    // Prompt 061: Town music — market lane by day, festival theme on a festival.
    if (this.save) {
      applySceneAudio('Town', this.save, {
        weatherId: this.weather?.id ?? null,
        event: isFestivalActiveNowOnSave() ? 'festival' : null,
      });
    }
  }

  private refreshHud(): void {
    const stamina = Math.round(this.controller.stamina);
    const status = formatWorldStatus(this.save, {
      weather: this.weather,
      tide: this.tide,
      gold: this.save.wallet.gold,
    });
    let line = `${status} · energy ${stamina}%`;
    // Prompt 056: a festival-day banner so the player knows the town has changed.
    if (this.festival) {
      line = `🎏 ${this.festival.name} today${isFestivalActiveNowOnSave() ? ' — happening now' : ''} · ${line}`;
    }
    if (this.actionTimer > 0) line += ` · ✔ ${this.actionLabel}`;
    else if (this.nearest) line += ` · [E] ${this.nearest.label}`;
    // Prompt 024: rotate a small "unscripted moment" line behind the
    // status so the town reads as inhabited.
    const moment = npcPickMoment(this.clock.time.minutes);
    if (moment) line += ` · ${moment}`;
    this.ctx.overlay.showHud('Ballast Bay', line, () => this.openMenu());
  }

  private openMenu(): void {
    this.menuOpen = true;
    this.ctx.overlay.showMenu(
      'Paused',
      [
        { id: 'resume', label: 'Resume', enabled: true, testId: 'pause-resume' },
        { id: 'farm', label: 'Back to the farm', enabled: true, testId: 'nav-farm' },
        { id: 'interior', label: 'Enter the bakery', enabled: true, testId: 'nav-interior' },
        { id: 'beach', label: 'Driftwood Beach', enabled: true, testId: 'nav-beach' },
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
      case 'farm':
        this.goTo('Farm', { entry: 'farmhouse-door' });
        break;
      case 'interior':
        this.goTo('Interior');
        break;
      case 'beach':
        this.goTo('Beach');
        break;
      case 'save-quit':
        persistActiveSave();
        clearActiveSave();
        this.goTo('Title');
        break;
    }
  }

  private handleDoor(buildingId: string): void {
    const minutes = this.clock.time.minutes;
    const hours = hoursFor(buildingId);
    const festivalActive = this.festival !== null;
    const open = hours ? isShopOpen(hours, minutes, festivalActive) : !festivalActive;
    if (!open) {
      const building = BUILDINGS.find((b) => b.id === buildingId);
      this.actionLabel = festivalActive
        ? `${building?.label ?? 'Shop'} is closed for the ${this.festival?.name ?? 'festival'} — visit the stalls!`
        : `${building?.label ?? 'Shop'} is closed (${this.formatHours(hours)}).`;
      this.actionTimer = 1.8;
      return;
    }
    this.goTo('Interior', { entry: 'inside-door', shopId: buildingId });
  }

  private formatHours(hours: ShopHours | null): string {
    if (!hours) return 'always open';
    const fmt = (m: number): string => {
      const h24 = Math.floor(m / 60) % 24;
      const ampm = h24 < 12 ? 'AM' : 'PM';
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      return `${h12} ${ampm}`;
    };
    return `${fmt(hours.open)}–${fmt(hours.close)}`;
  }

  private openNpcGreeting(npcId: string): void {
    const seed = NPC_SEEDS.find((s) => s.id === npcId);
    const npc = this.npcs.get(npcId);
    if (!seed || !npc) return;
    this.dialogueOpen = true;
    const startState = this.makeDialogueState();
    const run = runDialogue(seed.graph, startState);
    this.renderDialogueRun(seed, run);
  }

  private makeDialogueState(): DialogueState {
    return {
      flags: {},
      relationships: {},
      lineSeenToday: {},
      lineSeenEver: {},
      inventoryCount: (itemId) => {
        let total = 0;
        for (const slot of this.save.inventory.slots) {
          if (slot?.itemId === itemId) total += slot.qty;
        }
        return total;
      },
      now: {
        season: this.save.calendar.season,
        day: this.save.calendar.day,
        weatherId: this.weather?.id ?? null,
      },
    };
  }

  private renderDialogueRun(
    seed: NpcSeed,
    run: RunResult,
    tierFlash?: { tier: string; deltaText: string },
  ): void {
    // Find the most recent "line" event and the awaiting choice (if any).
    let lastLine: string | null = null;
    for (const evt of run.events) {
      if (evt.kind === 'line') lastLine = evt.body;
    }
    if (!lastLine) {
      this.dialogueOpen = false;
      this.refreshHud();
      return;
    }
    const baseChoices = (run.awaitChoice ?? []).map((c: DialogueChoice) => ({ id: c.id, label: c.label }));

    // RF-13: append a "Give <item>" choice when the player has a giftable
    // stack in the active hotbar slot AND the dialogue is at a choice node.
    const giftEntry = this.activeGiftStack();
    if (baseChoices.length > 0 && giftEntry) {
      baseChoices.push({ id: '__gift__', label: `Give ${giftEntry.label}` });
    }

    const points = this.save.relationships[seed.id] ?? 0;
    // Prompt 024: prepend a reactive greeting + active-behavior banner to
    // the dialogue body so NPCs feel responsive to recent actions and
    // present at their daily-life task.
    const greeting = npcReactiveGreeting(seed.id, {
      visitedReefToday: false,
      visitedMineToday: this.save.location.sceneKey === 'Mine',
      pettedAnimalToday: this.save.pet?.pettedToday ?? false,
      caughtFirstFishToday: Object.keys(this.save.firstCatchSeen ?? {})[0],
      matchedSeason: this.save.calendar.season,
    });
    const activeBehavior = npcActiveBehaviorFor(seed.id, this.clock.time.minutes, this.save.calendar.season);
    const profile = npcProfileFor(seed.id);
    const lifeBanner = activeBehavior && profile
      ? `[${profile.workTrade}] `
      : '';
    const decoratedBody = greeting ? `${lifeBanner}${greeting}\n\n${lastLine}` : `${lifeBanner}${lastLine}`;
    this.ctx.overlay.showDialoguePanel({
      speaker: seed.name,
      portraitColor: seed.portraitCss,
      body: decoratedBody,
      rapportLevel: relationshipLevel(points),
      rapportMaxLevel: 10,
      tierFlash,
      choices: baseChoices.length > 0 ? baseChoices : undefined,
      onSelect: (choiceId) => {
        if (choiceId === '__gift__' && giftEntry) {
          this.handleGiftHandoff(seed, giftEntry, run);
          return;
        }
        const choice = (run.awaitChoice ?? []).find((c) => c.id === choiceId);
        if (!choice) return;
        const next = pickChoice(seed.graph, choice, run.state);
        this.renderDialogueRun(seed, next);
      },
      onDismiss: () => {
        this.dialogueOpen = false;
        this.refreshHud();
      },
    });
  }

  private activeGiftStack(): { itemId: string; label: string } | null {
    const stack = this.save.inventory.slots[0]; // hotbar slot 0 is canonical
    if (!stack) return null;
    const content = loadGameContent();
    const item = content.items.find((i) => i.id === stack.itemId);
    return { itemId: stack.itemId, label: item?.name ?? stack.itemId };
  }

  private handleGiftHandoff(
    seed: NpcSeed,
    giftEntry: { itemId: string; label: string },
    run: RunResult,
  ): void {
    const content = loadGameContent();
    const npc = content.npcs.find((n) => n.id === seed.id);
    const isBirthday = npc ? isBirthdayToday(npc, this.save.calendar) : false;
    const giftsThisWeek = this.save.giftsThisWeek[seed.id] ?? 0;
    const result = applyGift(this.tastingTable, {
      npcId: seed.id,
      itemId: giftEntry.itemId,
      isBirthday,
      giftsThisWeek,
    });
    let flash: { tier: string; deltaText: string };
    if (!result.accepted) {
      flash = { tier: 'neutral', deltaText: 'gift limit reached this week' };
    } else {
      this.save.relationships[seed.id] =
        Math.max(0, (this.save.relationships[seed.id] ?? 0) + result.delta);
      this.save.giftsThisWeek[seed.id] = giftsThisWeek + 1;
      const removed = removeItem(this.save.inventory, giftEntry.itemId, 1);
      this.save.inventory = removed.container;
      recordRelationshipChange(result.delta);
      const sign = result.delta >= 0 ? '+' : '';
      flash = { tier: result.tier, deltaText: `${sign}${result.delta} rapport` };
      persistActiveSave();
      this.refreshHotbarVoid();
    }
    this.renderDialogueRun(seed, run, flash);
  }

  /** No-op stub for the hotbar refresh — TownScene doesn't render the
   * hotbar (FarmScene owns it), but persisting + clearing the active stack
   * means re-entering the Farm will see the updated state. */
  private refreshHotbarVoid(): void {
    // intentionally empty
  }

  override dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    super.dispose();
  }
}
