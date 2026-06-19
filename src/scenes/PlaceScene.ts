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
import { getActiveSave, persistActiveSave, clearActiveSave } from '../engine/gameState';
import { writeSave } from '../engine/save';
import { formatSaveStatus } from '../engine/format';
import type { SaveData } from '../engine/saveModel';

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
 * Real terrain/props/movement arrive once the art track delivers (Prompt 004+).
 */
export abstract class PlaceScene extends GameScene {
  protected abstract readonly sceneKey: string;
  protected abstract readonly title: string;
  protected abstract readonly ground: Color3;
  protected abstract readonly navs: PlaceNav[];

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
    save.location.sceneKey = this.sceneKey;
    writeSave(save);
    this.showHud(save);
  }

  private showHud(save: SaveData): void {
    this.ctx.overlay.showHud(this.title, formatSaveStatus(save), () => this.openMenu(save));
  }

  private openMenu(save: SaveData): void {
    this.ctx.overlay.showMenu(
      'Paused',
      [
        { id: 'resume', label: 'Resume', enabled: true, testId: 'pause-resume' },
        ...this.navs.map((n) => ({ id: n.id, label: n.label, enabled: true, testId: n.testId })),
      ],
      (id) => this.onMenu(id, save),
      formatSaveStatus(save),
    );
  }

  private onMenu(id: string, save: SaveData): void {
    if (id === 'resume') {
      this.showHud(save);
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
}
