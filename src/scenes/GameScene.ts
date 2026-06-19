import Phaser from 'phaser';

/** Fade-out RGB (matches the app background) used for transitions. */
const FADE_RGB = [6, 12, 24] as const;

/**
 * Base scene with smooth, interrupt-safe camera fade transitions. A scene can
 * only start one transition at a time; subsequent fadeTo() calls are ignored
 * until the next scene resets the guard in fadeIn().
 */
export class GameScene extends Phaser.Scene {
  private transitioning = false;
  protected readonly fadeDuration = 320;

  protected fadeIn(): void {
    this.transitioning = false;
    this.cameras.main.fadeIn(this.fadeDuration, ...FADE_RGB);
  }

  protected fadeTo(target: string, data?: Record<string, unknown>): void {
    if (this.transitioning) return;
    this.transitioning = true;
    const cam = this.cameras.main;
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(target, data);
    });
    cam.fadeOut(this.fadeDuration, ...FADE_RGB);
  }
}
