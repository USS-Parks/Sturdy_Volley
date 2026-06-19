import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { buildTitleMenu } from '../ui/menuModel';
import { UIOverlay } from '../ui/overlay';
import { hasSaveGame, readSave, deleteSave } from '../engine/save';
import { setActiveSave, clearActiveSave } from '../engine/gameState';
import { downloadSave, pickAndImportSave } from '../engine/saveTransfer';
import { getContentReport } from '../data/content';
import type { SaveData } from '../engine/saveModel';

const RESUMABLE_SCENES = new Set(['Farm', 'Town', 'Interior', 'Court', 'Mine']);

/**
 * Title screen. Draws an original placeholder coastal backdrop on the canvas
 * and renders the main menu through the accessible HTML overlay.
 */
export class TitleScene extends GameScene {
  private overlay!: UIOverlay;

  constructor() {
    super('Title');
  }

  create(): void {
    this.drawBackdrop();
    this.fadeIn();
    this.overlay = new UIOverlay();
    this.showMenu();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.overlay.clear());
  }

  private drawBackdrop(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0b1b2b');

    const sky = this.add.graphics();
    sky.fillGradientStyle(0x123a5a, 0x123a5a, 0x0b1b2b, 0x0b1b2b, 1);
    sky.fillRect(0, 0, width, height * 0.62);

    const sea = this.add.graphics();
    sea.fillGradientStyle(0x10516a, 0x10516a, 0x093a4e, 0x093a4e, 1);
    sea.fillRect(0, height * 0.62, width, height * 0.38);

    // Sparse horizon glints — original generated art, no external assets.
    for (let i = 0; i < 12; i++) {
      const gx = (i + 0.5) * (width / 12);
      this.add.rectangle(gx, height * 0.66 + (i % 3) * 8, 26, 2, 0x7fd1c4, 0.32);
    }
  }

  private showMenu(): void {
    const items = buildTitleMenu(hasSaveGame());
    if (import.meta.env.DEV) {
      items.push({
        id: 'dev-data',
        label: 'Dev · Validate data',
        enabled: true,
        testId: 'title-dev-data',
      });
    }
    this.overlay.showMenu(
      'Sturdy Volley',
      items,
      (id) => this.onSelect(id),
      'Ballast Bay · rebuild the storm-worn coast',
    );
  }

  private onSelect(id: string): void {
    switch (id) {
      case 'start':
        this.fadeTo('NewGame');
        break;
      case 'continue': {
        const save = readSave();
        if (save) {
          setActiveSave(save);
          this.fadeTo(resumeSceneKey(save));
        }
        break;
      }
      case 'settings':
        this.showSettings();
        break;
      case 'credits':
        this.overlay.showPanel(
          'Credits',
          'Sturdy Volley is an original cozy life sim set in Ballast Bay. All names, art, audio, dialogue, maps, and code are original.',
          () => this.showMenu(),
        );
        break;
      case 'dev-data':
        this.showDataReport();
        break;
    }
  }

  private showSettings(status?: string): void {
    const has = hasSaveGame();
    this.overlay.showMenu(
      'Settings',
      [
        { id: 'export', label: 'Export save', enabled: has, testId: 'settings-export' },
        { id: 'import', label: 'Import save', enabled: true, testId: 'settings-import' },
        { id: 'delete', label: 'Delete save', enabled: has, testId: 'settings-delete' },
        { id: 'back', label: 'Back', enabled: true, testId: 'settings-back' },
      ],
      (id) => this.onSettings(id),
      status ?? 'Manage your save data',
    );
  }

  private onSettings(id: string): void {
    switch (id) {
      case 'export':
        this.showSettings(downloadSave() ? 'Save exported.' : 'No save to export.');
        break;
      case 'import':
        void pickAndImportSave().then((result) =>
          this.showSettings(result.ok ? 'Save imported.' : `Import failed: ${result.error}`),
        );
        break;
      case 'delete':
        deleteSave();
        clearActiveSave();
        this.showSettings('Save deleted.');
        break;
      case 'back':
        this.showMenu();
        break;
    }
  }

  private showDataReport(): void {
    const rows = getContentReport().map((summary) => ({
      label: `${summary.name} (${summary.count})`,
      ok: summary.ok,
      detail: summary.ok ? undefined : summary.issues.slice(0, 3).join('; '),
    }));
    this.overlay.showReport('Data validation', rows, () => this.showMenu(), 'dev-data-report');
  }
}

function resumeSceneKey(save: SaveData): string {
  return RESUMABLE_SCENES.has(save.location.sceneKey) ? save.location.sceneKey : 'Farm';
}
