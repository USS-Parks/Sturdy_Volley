import type { Scene } from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addThreeQuarterCamera } from '../render/scene-helpers';
import { loadGameContent } from '../data/content';
import { requestedDevScene } from './dev-route';

/**
 * Validates + loads bundled content (fail-fast). Real .glb asset loading will be
 * queued here once the art pipeline delivers assets.
 */
export class PreloadScene extends GameScene {
  build(): Scene {
    const scene = makeScene(this.ctx.engine);
    addThreeQuarterCamera(scene);
    this.scene = scene;
    return scene;
  }

  override enter(): void {
    const content = loadGameContent();
    if (import.meta.env.DEV) {
      console.info(
        `[Sturdy Volley] content loaded: ${content.items.length} items, ` +
          `${content.crops.length} crops, ${content.npcs.length} NPCs.`,
      );
    }
    // Direct-boot route for dev proving-ground scenes (e.g. `?scene=CameraLab`).
    // Works in the production preview build, so reproducible screenshots don't
    // depend on a dev-only Title menu item.
    const dev = requestedDevScene();
    queueMicrotask(() => this.goTo(dev ?? 'Title', undefined, false));
  }
}
