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
import { removeItem } from '../engine/inventory';
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

  override enter(): void {
    const save = getActiveSave();
    if (!save) {
      this.goTo('Title', undefined, false);
      return;
    }
    this.save = save;
    save.location.sceneKey = 'Town';
    writeSave(save);
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
    };
  }

  private scheduleContext() {
    return {
      minutes: this.clock.time.minutes,
      season: this.save.calendar.season,
      weatherId: this.weather?.id ?? null,
      festivalId: null,
      relationshipLevel: 0,
      activeEventFlags: [] as string[],
    };
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
    for (const b of BUILDINGS) {
      const [x, z] = b.position;
      const doorZ = z + b.depth / 2 + 0.4;
      const hours = hoursFor(b.id);
      const open = hours ? isShopOpen(hours, minutes, false) : true;
      base.push({
        id: `door:${b.id}`,
        kind: 'door',
        label: open ? `Enter the ${b.label}` : `${b.label} — closed today`,
        x,
        z: doorZ,
        radius: 1.2,
        priority: 3,
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
    const open = hours ? isShopOpen(hours, minutes, false) : true;
    if (!open) {
      const building = BUILDINGS.find((b) => b.id === buildingId);
      this.actionLabel = `${building?.label ?? 'Shop'} is closed (${this.formatHours(hours)}).`;
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
