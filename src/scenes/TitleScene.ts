import Phaser from 'phaser';
import { buildTitleMenu } from '../ui/menuModel';
import { UIOverlay } from '../ui/overlay';
import { hasSaveGame } from '../engine/save';

/**
 * Title screen. Draws an original placeholder coastal backdrop on the canvas
 * and renders the main menu through the accessible HTML overlay.
 */
export class TitleScene extends Phaser.Scene {
  private overlay!: UIOverlay;

  constructor() {
    super('Title');
  }

  create(): void {
    this.drawBackdrop();
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
    this.overlay.showMenu(
      'Sturdy Volley',
      buildTitleMenu(hasSaveGame()),
      (id) => this.onSelect(id),
      'Ballast Bay · rebuild the storm-worn coast',
    );
  }

  private onSelect(id: string): void {
    switch (id) {
      case 'start':
        // New Game flow (scene manager + save bootstrap) lands in Prompt 003.
        console.info('[Sturdy Volley] New Game flow arrives in Prompt 003.');
        break;
      case 'continue':
        // Enabled only once a save exists.
        break;
      case 'settings':
        this.overlay.showPanel(
          'Settings',
          'Audio, controls, and accessibility settings arrive in later prompts. This panel confirms overlay navigation works.',
          () => this.showMenu(),
        );
        break;
      case 'credits':
        this.overlay.showPanel(
          'Credits',
          'Sturdy Volley is an original cozy life sim set in Ballast Bay. All names, art, audio, dialogue, maps, and code are original.',
          () => this.showMenu(),
        );
        break;
    }
  }
}
