import type { Scene } from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addThreeQuarterCamera } from '../render/scene-helpers';

/** First state. Reserved for early engine setup; hands off to Preload. */
export class BootScene extends GameScene {
  build(): Scene {
    const scene = makeScene(this.ctx.engine);
    addThreeQuarterCamera(scene);
    this.scene = scene;
    return scene;
  }

  override enter(): void {
    // Defer so the in-flight transition finishes before the next starts.
    queueMicrotask(() => this.goTo('Preload', undefined, false));
  }
}
