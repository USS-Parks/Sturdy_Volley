import { Scene, MeshBuilder, type Color3 } from '@babylonjs/core';
import { GameScene } from './GameScene';
import {
  makeScene,
  addFog,
  addThreeQuarterCamera,
  addLights,
  flatMaterial,
  PALETTE,
} from '../render/scene-helpers';
import {
  getActiveSave,
  persistActiveSave,
  clearActiveSave,
  getDayLedger,
  resetDayLedger,
} from '../engine/gameState';
import { writeSave } from '../engine/save';
import { formatWorldStatus } from '../engine/format';
import { loadGameContent } from '../data/content';
import { forecastFor } from '../engine/weather';
import { tideStateAt, type TideState } from '../engine/tide';
import { applyGameTime, getGameTime, resolveDay } from '../engine/dayResolution';
import {
  createTimeClock,
  pauseClock,
  tickClock,
  type TimeClockState,
} from '../engine/timeClock';
import type { SaveData } from '../engine/saveModel';
import type { Weather } from '../data/schemas';

export interface PlaceNav {
  id: string;
  label: string;
  testId: string;
  target?: string;
  action?: 'save-quit';
}

/**
 * Placeholder gameplay scene: a colored ground + a player capsule + Theme-3
 * fog/lighting, with the HUD bar + pause menu preserving navigation and saving.
 * Time keeps flowing while the player is here (Prompt 006), pauses with the
 * menu, and collapses to a day-summary at 2 AM the same way the Farm does.
 */
export abstract class PlaceScene extends GameScene {
  protected abstract readonly sceneKey: string;
  protected abstract readonly title: string;
  protected abstract readonly ground: Color3;
  protected abstract readonly navs: PlaceNav[];

  protected save!: SaveData;
  protected clock!: TimeClockState;
  protected weather: Weather | null = null;
  protected tide: TideState = 'low';
  protected menuOpen = false;
  protected dayResolving = false;
  private hudTimer = 0;

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    addFog(scene, PALETTE.fog, 0.02);
    addThreeQuarterCamera(scene, undefined, 22);
    addLights(scene);

    const ground = MeshBuilder.CreateGround('ground', { width: 50, height: 50 }, scene);
    ground.material = flatMaterial(scene, 'ground', this.ground, 0.25);

    const player = MeshBuilder.CreateCapsule('player', { height: 1.8, radius: 0.4 }, scene);
    player.position.y = 0.9;
    player.material = flatMaterial(scene, 'player', PALETTE.player, 0.35);

    this.decorate(scene);
    this.scene = scene;
    return scene;
  }

  protected decorate(_scene: Scene): void {}

  override enter(): void {
    const save = getActiveSave();
    if (!save) {
      this.goTo('Title', undefined, false);
      return;
    }
    this.save = save;
    save.location.sceneKey = this.sceneKey;
    writeSave(save);
    this.clock = createTimeClock(getGameTime(save));
    this.refreshWorldState();
    this.menuOpen = false;
    this.dayResolving = false;
    this.refreshHud();
  }

  override update(dt: number): void {
    if (!this.save) return;
    if (this.menuOpen || this.dayResolving) {
      this.clock = pauseClock(this.clock, true);
      return;
    }
    if (this.clock.paused) this.clock = pauseClock(this.clock, false);

    const tick = tickClock(this.clock, dt);
    this.clock = tick.state;
    if (tick.advancedMinutes > 0) {
      applyGameTime(this.save, this.clock.time);
      this.refreshWorldState();
    }
    if (tick.collapsed) {
      this.triggerCollapse();
      return;
    }
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.4;
      this.refreshHud();
    }
  }

  private refreshWorldState(): void {
    const content = loadGameContent();
    this.weather = forecastFor(this.clock.time, content.weather);
    this.tide = tideStateAt(this.clock.time);
  }

  private statusLine(): string {
    return formatWorldStatus(this.save, {
      weather: this.weather,
      tide: this.tide,
      gold: this.save.wallet.gold,
    });
  }

  private refreshHud(): void {
    this.ctx.overlay.showHud(this.title, this.statusLine(), () => this.openMenu());
  }

  private openMenu(): void {
    this.menuOpen = true;
    this.ctx.overlay.showMenu(
      'Paused',
      [
        { id: 'resume', label: 'Resume', enabled: true, testId: 'pause-resume' },
        ...this.navs.map((n) => ({ id: n.id, label: n.label, enabled: true, testId: n.testId })),
      ],
      (id) => this.onMenu(id),
      this.statusLine(),
    );
  }

  private onMenu(id: string): void {
    if (id === 'resume') {
      this.menuOpen = false;
      this.refreshHud();
      return;
    }
    const nav = this.navs.find((n) => n.id === id);
    if (!nav) return;
    if (nav.action === 'save-quit') {
      persistActiveSave();
      clearActiveSave();
      this.goTo('Title');
      return;
    }
    if (nav.target) this.goTo(nav.target);
  }

  private triggerCollapse(): void {
    if (this.dayResolving) return;
    this.dayResolving = true;
    this.clock = pauseClock(this.clock, true);

    const content = loadGameContent();
    const ledger = getDayLedger();
    const result = resolveDay({
      save: this.save,
      ledger,
      collapsed: true,
      festivals: content.festivals,
      npcs: content.npcs,
      items: content.items,
      crops: content.crops,
      todayWeatherId: this.weather?.id ?? null,
    });
    resetDayLedger();
    applyGameTime(this.save, result.nextTime);
    persistActiveSave();

    // Off-farm collapse: the day summary plays here, then the player is
    // shuttled home to the Farm so the next day starts in the right place.
    this.ctx.overlay.showDaySummary(result.summary, () => {
      this.dayResolving = false;
      this.goTo('Farm');
    });
  }
}
