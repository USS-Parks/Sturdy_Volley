import Phaser from 'phaser';

/**
 * First scene. Reserved for early engine setup (scale, input, global registry)
 * before any assets are queued. Currently it just hands off to Preload.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.scene.start('Preload');
  }
}
