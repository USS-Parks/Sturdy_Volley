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
  private mara: LiveNpc | null = null;
  private maraName = 'Mara Vale';

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
    this.controller = createControllerState();
    this.clock = createTimeClock(getGameTime(save));
    this.refreshWorldState();

    // Mara Vale — the one live NPC in the Town slice. Other NPCs land at RF-11.
    const maraSchedule = loadSchedule('mara-vale');
    if (maraSchedule) {
      const ctx = this.scheduleContext();
      const wp = activeWaypoint(maraSchedule, ctx);
      const start = wp?.sceneKey === 'Town'
        ? new Vector3(wp.x, 0.9, wp.z)
        : new Vector3(-8, 0.9, -3); // off-stage default
      const handles = buildNpcGraybox({
        scene: this.scene,
        npcId: 'mara-vale',
        position: { x: start.x, z: start.z },
        bodyColor: PALETTE.player,
      });
      this.mara = { id: 'mara-vale', name: this.maraName, handles, position: start.clone(), currentWaypoint: wp };
    }

    this.rebuildTargets();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.menuOpen = false;
    this.dialogueOpen = false;
    this.refreshHud();
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
    if (this.mara) {
      base.push({
        id: 'npc:mara-vale',
        kind: 'npc',
        label: `Talk to ${this.maraName}`,
        x: this.mara.position.x,
        z: this.mara.position.z,
        radius: 1.8,
        priority: 4,
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

    // NPC tick.
    if (this.mara) {
      const schedule = loadSchedule('mara-vale');
      if (schedule) {
        const ctx = this.scheduleContext();
        const wp = activeWaypoint(schedule, ctx);
        this.mara.currentWaypoint = wp ?? null;
        if (wp && wp.sceneKey === 'Town') {
          const stepResult = liveStep({
            position: { x: this.mara.position.x, z: this.mara.position.z },
            target: wp,
            speed: NPC_WALK_SPEED,
            dt,
          });
          this.mara.position.set(stepResult.x, 0.9, stepResult.z);
          this.mara.handles.root.position.set(stepResult.x, 0.85, stepResult.z);
          faceTo(this.mara.handles.root, wp);
        } else if (wp) {
          // Off-stage — hide her by parking the rig under the ground.
          this.mara.handles.root.position.y = -10;
        }
      }
    }
    this.rebuildTargets();

    this.nearest = resolveInteraction(this.targets, this.player.position.x, this.player.position.z);

    // Interaction.
    const interact = this.pressed.has('e') || this.pressed.has(' ');
    if (interact && !this.ePrev && this.nearest) {
      if (this.nearest.id === 'npc:mara-vale') this.openMaraGreeting();
      else {
        this.actionLabel = this.nearest.label;
        this.actionTimer = 1.6;
      }
    }
    this.ePrev = interact;
    if (this.actionTimer > 0) this.actionTimer -= dt;

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

  private openMaraGreeting(): void {
    this.dialogueOpen = true;
    this.ctx.overlay.showDialogue(
      this.maraName,
      'Morning, neighbor. The harbor winch is still rattling — come find me when you have a spare hour.',
      () => {
        this.dialogueOpen = false;
        this.refreshHud();
      },
    );
  }

  override dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    super.dispose();
  }
}
