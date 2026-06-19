import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { UIOverlay } from '../ui/overlay';
import { getActiveSave, persistActiveSave, clearActiveSave } from '../engine/gameState';
import { writeSave } from '../engine/save';
import { formatSaveStatus } from '../engine/format';

export interface PlaceNav {
  id: string;
  label: string;
  testId: string;
  target?: string;
  action?: 'save-quit';
}

/**
 * Placeholder gameplay scene used to wire up navigation + persistence before
 * the real tilemap scenes arrive (Farm tilemap = Prompt 004, Town = 015, …).
 * Renders a card with the location name, the player's status line, and
 * navigation buttons. Requires an active save; bounces to Title otherwise.
 */
export abstract class PlaceScene extends GameScene {
  protected abstract readonly title: string;
  protected abstract readonly backgroundColor: string;
  protected abstract readonly navs: PlaceNav[];
  private overlay!: UIOverlay;

  create(): void {
    const save = getActiveSave();
    if (!save) {
      this.scene.start('Title');
      return;
    }

    // Keep the resume location current.
    save.location.sceneKey = this.sys.settings.key;
    writeSave(save);

    this.cameras.main.setBackgroundColor(this.backgroundColor);
    this.fadeIn();

    this.overlay = new UIOverlay();
    this.overlay.showMenu(
      this.title,
      this.navs.map((nav) => ({ id: nav.id, label: nav.label, enabled: true, testId: nav.testId })),
      (id) => this.onNav(id),
      formatSaveStatus(save),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.overlay.clear());
  }

  private onNav(id: string): void {
    const nav = this.navs.find((n) => n.id === id);
    if (!nav) return;
    if (nav.action === 'save-quit') {
      persistActiveSave();
      clearActiveSave();
      this.fadeTo('Title');
      return;
    }
    if (nav.target) this.fadeTo(nav.target);
  }
}
