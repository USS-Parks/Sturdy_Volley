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
  recordSkillXp,
} from '../engine/gameState';
import { writeSave } from '../engine/save';
import { formatWorldStatus } from '../engine/format';
import { computeMoveVector, type MoveInput } from '../engine/movement';
import { createControllerState, stepController, type ControllerState } from '../engine/controller';
import { resolveInteraction, type InteractTarget } from '../engine/interaction';
import type { SaveData } from '../engine/saveModel';
import { loadGameContent } from '../data/content';
import { forecastFor } from '../engine/weather';
import { isLowTide, tideStateAt, type TideState } from '../engine/tide';
import { getGameTime } from '../engine/dayResolution';
import { createTimeClock, pauseClock, tickClock, type TimeClockState } from '../engine/timeClock';
import type { Weather } from '../data/schemas';
import { collect, type WorldEntity } from '../engine/forage';
import { addItem, countItem, removeItem } from '../engine/inventory';
import {
  BEACH_ENTITY_ANCHORS,
  beachAnchorFor,
  beachEntityLabel,
  beachEntitySuffix,
  buildBeachEntityMesh,
} from '../render/beach-entities';
import {
  FISH_CATALOG,
  baitPot,
  collectPot,
  markFirstCatch,
  nextBite,
  startMinigame,
  stepMinigame,
  type MinigameState,
  type WeatherKind,
} from '../engine/fishing';
import { absoluteDay } from '../engine/timeSystem';

/**
 * Driftwood Beach (RF-10). Promoted from a 25-line PlaceScene to a walkable
 * GameScene: sand ground, an aqua tide strip that visibly recedes when
 * `isLowTide` is true, a dock with two driftwood props, and forage entities
 * (3 shells on the tide line + 2 driftwood sticks on the dry sand) drawn from
 * `save.worldEntities` keyed `Beach:*`. Tide-line shells fade below the sand
 * at high/rising tide and are not interactable then.
 */
interface BeachDebugApi {
  openFishing: () => void;
  cast: (withBait: boolean) => void;
  fishingPhase: () => string;
  pendingResolvedId: () => string | null;
  forceBite: () => void;
  forceCatch: () => void;
  forceLoss: () => void;
  grantItem: (itemId: string, qty: number) => void;
  toggleAssist: () => void;
  firstCatchSeen: () => Record<string, boolean>;
}

export class BeachScene extends GameScene {
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
  private ePrev = false;
  private readonly pressed = new Set<string>();
  private readonly onKeyDown = (e: KeyboardEvent) => this.pressed.add(e.key.toLowerCase());
  private readonly onKeyUp = (e: KeyboardEvent) => this.pressed.delete(e.key.toLowerCase());

  private readonly entityMeshes = new Map<string, AbstractMesh>();
  private tideStrip: AbstractMesh | null = null;
  // Fishing state (Prompt 021).
  private fishingOpen = false;
  private fishingPhase: 'cast' | 'waiting' | 'reel' | 'caught' | 'lost' = 'cast';
  private fishingWaitTimer = 0;
  private fishingPendingResolvedId: string | null = null;
  private fishingPendingIsTreasure = false;
  private fishingMinigame: MinigameState | null = null;
  private fishingReelHeld = false;
  private fishingLastCatch = '';
  private fishingSeed = 1;

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    scene.collisionsEnabled = true;
    addFog(scene, PALETTE.fog, 0.02);
    addLights(scene);

    this.camera = new ArcRotateCamera(
      'beach-cam',
      -Math.PI / 2 + 0.6,
      Math.PI / 3.2,
      16,
      Vector3.Zero(),
      scene,
    );
    this.camera.fov = 0.8;

    const sand = MeshBuilder.CreateGround('sand', { width: 50, height: 30 }, scene);
    sand.material = flatMaterial(scene, 'sand', PALETTE.sand, 0.25);

    // Sea — large water plane to the north.
    const sea = MeshBuilder.CreateGround('sea', { width: 50, height: 24 }, scene);
    sea.position.set(0, 0.02, -8);
    sea.material = flatMaterial(scene, 'sea', PALETTE.sea, 0.35);

    // Tide-line strip — moves between visible (low tide) and hidden (high).
    const strip = MeshBuilder.CreateGround('tide-strip', { width: 30, height: 2.4 }, scene);
    strip.position.set(0, 0.03, 3.5);
    strip.material = flatMaterial(scene, 'tide-strip', PALETTE.accent, 0.32);
    this.tideStrip = strip;

    const dock = MeshBuilder.CreateBox('dock', { width: 3, depth: 10, height: 0.4 }, scene);
    dock.position.set(0, 0.2, -6);
    dock.material = flatMaterial(scene, 'dock', PALETTE.wood, 0.25);
    dock.checkCollisions = true;

    ([[-5, -3], [7, -2]] as const).forEach(([x, z], i) => {
      const wood = MeshBuilder.CreateBox(`driftwood${i}`, { width: 1.6, depth: 0.5, height: 0.4 }, scene);
      wood.position.set(x, 0.2, z);
      wood.rotation.y = i;
      wood.material = flatMaterial(scene, `driftwood${i}`, PALETTE.wood, 0.2);
    });

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

  override enter(): void {
    const save = getActiveSave();
    if (!save) {
      this.goTo('Title', undefined, false);
      return;
    }
    this.save = save;
    save.location.sceneKey = 'Beach';
    writeSave(save);
    this.controller = createControllerState();
    this.clock = createTimeClock(getGameTime(save));
    this.refreshWorldState();
    this.refreshEntityMeshes();
    this.rebuildTargets();
    this.refreshTideStrip();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.menuOpen = false;
    this.refreshHud();

    // Prompt 021: debug seam for the fishing e2e.
    (window as unknown as { sturdyVolleyBeach?: BeachDebugApi }).sturdyVolleyBeach = {
      openFishing: () => this.openFishing(),
      cast: (withBait: boolean) => this.beginCast(withBait),
      fishingPhase: () => this.fishingPhase,
      pendingResolvedId: () => this.fishingPendingResolvedId,
      forceBite: () => {
        this.fishingWaitTimer = 0;
        this.tickFishing(0.05);
      },
      forceCatch: () => {
        if (!this.fishingMinigame) return;
        this.fishingMinigame = { ...this.fishingMinigame, progress: 1 };
        this.collectFishingResult();
      },
      forceLoss: () => {
        this.fishingPhase = 'lost';
        this.fishingMinigame = null;
        this.fishingPendingResolvedId = null;
        this.renderFishingPanel();
      },
      grantItem: (itemId: string, qty: number) => {
        const r = addItem(this.save.inventory, itemId, qty, 0);
        this.save.inventory = r.container;
        persistActiveSave();
      },
      toggleAssist: () => {
        this.save.fishingAssist = !(this.save.fishingAssist ?? false);
        persistActiveSave();
        this.renderFishingPanel();
      },
      firstCatchSeen: () => ({ ...(this.save.firstCatchSeen ?? {}) }),
    };
  }

  override update(dt: number): void {
    if (!this.save) return;
    if (this.menuOpen || this.fishingOpen) {
      this.clock = pauseClock(this.clock, true);
      this.controller = stepController(this.controller, { dir: { x: 0, z: 0 }, sprint: false }, dt);
      if (this.fishingOpen) this.tickFishing(dt);
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
      if (this.nearest.id.startsWith('entity:')) this.handleEntityInteract(this.nearest.id.slice('entity:'.length));
      else if (this.nearest.id === 'surf-line') this.openFishing();
      else if (this.nearest.id.startsWith('pot:')) this.handleCrabPotInteract(this.nearest.id.slice('pot:'.length));
      else {
        this.actionLabel = this.nearest.label;
        this.actionTimer = 1.6;
      }
    }
    this.ePrev = interact;

    // Prompt 021: spacebar held while the minigame is up reels the cursor up.
    this.fishingReelHeld = this.fishingOpen && this.fishingPhase === 'reel' && (this.pressed.has(' ') || this.pressed.has('e'));
    if (this.actionTimer > 0) this.actionTimer -= dt;

    const tick = tickClock(this.clock, dt);
    this.clock = tick.state;
    if (tick.advancedMinutes > 0) {
      this.save.calendar.timeMinutes = this.clock.time.minutes;
      this.refreshWorldState();
      this.refreshTideStrip();
      this.rebuildTargets();
    }
    if (tick.collapsed) {
      this.goTo('Farm', { entry: 'farmhouse-door' });
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

  private refreshTideStrip(): void {
    if (!this.tideStrip) return;
    // Low / falling tide → strip rises to visible; high / rising → strip dips below the sand.
    const exposed = isLowTide(this.clock.time);
    this.tideStrip.position.y = exposed ? 0.03 : -0.2;
    this.tideStrip.isVisible = exposed;
  }

  private rebuildTargets(): void {
    const base: InteractTarget[] = [];
    const exposed = isLowTide(this.clock.time);
    for (const [key, entity] of Object.entries(this.save.worldEntities)) {
      const suffix = beachEntitySuffix(key);
      if (!suffix) continue;
      const anchor = beachAnchorFor(suffix);
      if (!anchor) continue;
      if (anchor.tideLine && !exposed) continue; // shells submerge at high tide
      base.push({
        id: `entity:${suffix}`,
        kind: 'pickup',
        label: beachEntityLabel(entity),
        x: anchor.x,
        z: anchor.z,
        radius: anchor.radius ?? 1.4,
        priority: 3,
      });
    }
    // Prompt 021: surf line cast target — stand near the tide strip.
    base.push({
      id: 'surf-line',
      kind: 'water-entry',
      label: 'Cast a line',
      x: 0,
      z: -8,
      radius: 3.0,
      priority: 4,
    });
    // Live crab pots interactable.
    for (const pot of Object.values(this.save.crabPots ?? {})) {
      if (pot.sceneKey !== 'Beach') continue;
      base.push({
        id: `pot:${pot.id}`,
        kind: 'prop',
        label: pot.baited ? 'Check the crab pot' : 'Re-bait the crab pot',
        x: pot.x,
        z: pot.z,
        radius: 1.4,
        priority: 3,
      });
    }
    this.targets = base;
  }

  private refreshEntityMeshes(): void {
    if (!this.scene) return;
    const exposed = isLowTide(this.clock.time);
    const seen = new Set<string>();
    for (const [key, entity] of Object.entries(this.save.worldEntities)) {
      const suffix = beachEntitySuffix(key);
      if (!suffix) continue;
      const anchor = beachAnchorFor(suffix);
      if (!anchor) continue;
      seen.add(suffix);
      const existing = this.entityMeshes.get(suffix);
      if (!existing) {
        const mesh = buildBeachEntityMesh(this.scene, suffix, entity, anchor);
        this.entityMeshes.set(suffix, mesh);
      }
      const mesh = this.entityMeshes.get(suffix)!;
      mesh.isVisible = !anchor.tideLine || exposed;
    }
    for (const [suffix, mesh] of this.entityMeshes) {
      if (seen.has(suffix)) continue;
      mesh.dispose();
      this.entityMeshes.delete(suffix);
    }
  }

  private absoluteMinutesNow(): number {
    return absoluteDay(this.clock.time) * 1440 + this.clock.time.minutes;
  }

  private mapWeatherForFishing(): WeatherKind {
    const id = this.weather?.id ?? 'sunny';
    if (id === 'rain' || id === 'sea-fog' || id === 'windstorm') return id as WeatherKind;
    return 'sunny';
  }

  private openFishing(): void {
    this.fishingOpen = true;
    this.fishingPhase = 'cast';
    this.fishingMinigame = null;
    this.fishingPendingResolvedId = null;
    this.fishingWaitTimer = 0;
    this.renderFishingPanel();
  }

  private renderFishingPanel(): void {
    const fishItem = this.fishingPendingResolvedId
      ? FISH_CATALOG.find((f) => f.id === this.fishingPendingResolvedId)
      : undefined;
    const lastCatchLabel = fishItem?.name ?? (this.fishingLastCatch || undefined);
    this.ctx.overlay.showFishingPanel({
      baitCount: countItem(this.save.inventory, 'bait'),
      assist: this.save.fishingAssist ?? false,
      phase: this.fishingPhase,
      lastCatchLabel,
      minigame: this.fishingMinigame
        ? {
            fishPos: this.fishingMinigame.fishPos,
            cursorPos: this.fishingMinigame.cursorPos,
            cursorWidth: this.fishingMinigame.cursorWidth,
            progress: this.fishingMinigame.progress,
          }
        : undefined,
      onCast: (withBait) => this.beginCast(withBait),
      onToggleAssist: () => {
        this.save.fishingAssist = !(this.save.fishingAssist ?? false);
        persistActiveSave();
        this.renderFishingPanel();
      },
      onDropPot: () => this.deployCrabPot(),
      onClose: () => {
        this.fishingOpen = false;
        this.fishingPhase = 'cast';
        this.fishingMinigame = null;
        this.refreshHud();
      },
    });
  }

  private beginCast(withBait: boolean): void {
    this.fishingSeed = this.absoluteMinutesNow() + Math.floor(Math.random() * 1000);
    if (withBait) {
      const r = removeItem(this.save.inventory, 'bait', 1);
      if (r.removed === 1) this.save.inventory = r.container;
      else withBait = false;
    }
    const roll = nextBite({
      timeMinutes: this.clock.time.minutes,
      season: this.save.calendar.season,
      weather: this.mapWeatherForFishing(),
      tide: this.tide,
      location: 'beach',
      seed: this.fishingSeed,
      withBait,
    });
    this.fishingPhase = 'waiting';
    this.fishingWaitTimer = roll.waitSeconds;
    this.fishingPendingResolvedId = roll.resolvedId;
    this.fishingPendingIsTreasure = roll.isTreasure;
    this.renderFishingPanel();
  }

  private tickFishing(dt: number): void {
    if (this.fishingPhase === 'waiting') {
      this.fishingWaitTimer -= dt;
      if (this.fishingWaitTimer <= 0) {
        if (this.fishingPendingIsTreasure) {
          this.collectFishingResult();
        } else {
          const def = FISH_CATALOG.find((f) => f.id === this.fishingPendingResolvedId);
          this.fishingMinigame = startMinigame({
            difficulty: def?.difficulty ?? 1,
            assist: this.save.fishingAssist ?? false,
          });
          this.fishingPhase = 'reel';
          this.renderFishingPanel();
        }
      } else if (Math.floor(this.fishingWaitTimer * 10) % 5 === 0) {
        // Re-render every ~0.5s to refresh the panel.
        this.renderFishingPanel();
      }
      return;
    }
    if (this.fishingPhase === 'reel' && this.fishingMinigame) {
      const intent: -1 | 0 | 1 = this.fishingReelHeld ? 1 : -1;
      this.fishingSeed += 1;
      const step = stepMinigame({
        state: this.fishingMinigame,
        dt,
        intent,
        seed: this.fishingSeed,
        assist: this.save.fishingAssist ?? false,
      });
      this.fishingMinigame = step.state;
      if (step.caught) {
        this.collectFishingResult();
      } else if (step.lost) {
        this.fishingPhase = 'lost';
        this.fishingMinigame = null;
        this.fishingPendingResolvedId = null;
        this.renderFishingPanel();
      } else {
        this.renderFishingPanel();
      }
    }
  }

  private collectFishingResult(): void {
    const id = this.fishingPendingResolvedId;
    if (!id) return;
    const added = addItem(this.save.inventory, id, 1, 0);
    this.save.inventory = added.container;
    if (!this.fishingPendingIsTreasure) {
      const r = markFirstCatch(this.save.firstCatchSeen ?? {}, id);
      this.save.firstCatchSeen = r.seen;
      if (r.isFirst) {
        const fish = FISH_CATALOG.find((f) => f.id === id);
        this.fishingLastCatch = `First catch! ${fish?.name ?? id}`;
      } else {
        this.fishingLastCatch = FISH_CATALOG.find((f) => f.id === id)?.name ?? id;
      }
      recordSkillXp('angling', 6);
    } else {
      this.fishingLastCatch = id;
    }
    persistActiveSave();
    this.fishingPhase = 'caught';
    this.fishingMinigame = null;
    this.renderFishingPanel();
  }

  private deployCrabPot(): void {
    const id = `Beach:pot:${Object.keys(this.save.crabPots ?? {}).length + 1}`;
    if (!this.save.crabPots) this.save.crabPots = {};
    this.save.crabPots[id] = baitPot(
      { id, sceneKey: 'Beach', x: 0, z: -6, baited: false, startedAt: null, catchItemId: null },
      this.absoluteMinutesNow(),
      this.fishingSeed + Object.keys(this.save.crabPots).length,
    );
    persistActiveSave();
    this.fishingLastCatch = 'Dropped a crab pot.';
    this.fishingPhase = 'caught';
    this.rebuildTargets();
    this.renderFishingPanel();
  }

  private handleCrabPotInteract(id: string): void {
    const pot = this.save.crabPots?.[id];
    if (!pot) return;
    const now = this.absoluteMinutesNow();
    const result = collectPot(pot, now);
    if (result.itemId) {
      const added = addItem(this.save.inventory, result.itemId, 1, 0);
      this.save.inventory = added.container;
      this.save.crabPots![id] = result.pot;
      this.actionLabel = `Pot yielded ${result.itemId}`;
      this.actionTimer = 1.6;
    } else {
      // Re-bait if not ready and not currently baited.
      this.save.crabPots![id] = baitPot(pot, now, this.fishingSeed + id.length);
      this.actionLabel = 'Re-baited the pot';
      this.actionTimer = 1.6;
    }
    persistActiveSave();
    this.rebuildTargets();
  }

  private handleEntityInteract(suffix: string): void {
    const key = `Beach:${suffix}`;
    const entity: WorldEntity | undefined = this.save.worldEntities[key];
    if (!entity) return;
    const result = collect(entity, 1);
    if (!result.reward && result.next === entity) return;
    if (result.reward) {
      const added = addItem(this.save.inventory, result.reward.itemId, result.reward.qty, 0);
      this.save.inventory = added.container;
    }
    const next = { ...this.save.worldEntities };
    if (result.next) next[key] = result.next;
    else delete next[key];
    this.save.worldEntities = next;
    recordSkillXp('foraging', entity.kind === 'forage' ? 3 : 2);
    this.actionLabel = beachEntityLabel(entity);
    this.actionTimer = 1.6;
    this.refreshEntityMeshes();
    this.rebuildTargets();
    persistActiveSave();
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
    this.ctx.overlay.showHud('Driftwood Beach', line, () => this.openMenu());
  }

  private openMenu(): void {
    this.menuOpen = true;
    this.ctx.overlay.showMenu(
      'Paused',
      [
        { id: 'resume', label: 'Resume', enabled: true, testId: 'pause-resume' },
        { id: 'farm', label: 'Back to the farm', enabled: true, testId: 'nav-farm' },
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
    super.dispose();
  }
}

/** Re-export for tests + debug API consumers. */
export { BEACH_ENTITY_ANCHORS };
