import Phaser from 'phaser';
import { loadGameContent } from '../data/content';

/**
 * Loads global assets and shows a progress bar. No real assets exist yet
 * (Prompt 001 ships placeholder-free); later prompts queue atlases here.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    const { width, height } = this.scale;
    const barWidth = Math.min(360, width * 0.6);
    const x = (width - barWidth) / 2;
    const y = height / 2;

    const frame = this.add
      .rectangle(width / 2, y, barWidth + 8, 22)
      .setStrokeStyle(2, 0xffffff, 0.8)
      .setFillStyle(0x000000, 0);
    const bar = this.add
      .rectangle(x, y, 0, 14, 0x7fd1c4)
      .setOrigin(0, 0.5);

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      bar.width = barWidth * value;
    });
    this.load.on(Phaser.Loader.Events.COMPLETE, () => {
      frame.destroy();
      bar.destroy();
    });
  }

  create(): void {
    // Fail fast if bundled content is invalid (throws ContentValidationError).
    const content = loadGameContent();
    if (import.meta.env.DEV) {
      console.info(
        `[Sturdy Volley] content loaded: ${content.items.length} items, ` +
          `${content.crops.length} crops, ${content.npcs.length} NPCs, ` +
          `${content.animals.length} animals, ${content.recipes.length} recipes.`,
      );
    }
    this.scene.start('Title');
  }
}
