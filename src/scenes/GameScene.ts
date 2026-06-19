import type { Engine, Scene } from '@babylonjs/core';
import type { UIOverlay } from '../ui/overlay';
import type { SceneManager } from './SceneManager';

export interface SceneContext {
  engine: Engine;
  manager: SceneManager;
  overlay: UIOverlay;
}

/**
 * Base class for a game "screen" backed by its own Babylon Scene. The
 * SceneManager owns the render loop and calls update()/getScene() each frame
 * and dispose() on transition.
 */
export abstract class GameScene {
  protected scene!: Scene;

  constructor(protected readonly ctx: SceneContext) {}

  /** Build the Babylon scene (camera, lights, meshes), assign this.scene, return it. */
  abstract build(): Scene;

  /** Called once after build, with optional transition data (e.g. DOM overlay setup). */
  enter(_data?: unknown): void {}

  /** Per-frame update (seconds since last frame). */
  update(_dt: number): void {}

  getScene(): Scene {
    return this.scene;
  }

  dispose(): void {
    this.ctx.overlay.clear();
    this.scene?.dispose();
  }

  protected goTo(key: string, data?: unknown, fade = true): void {
    void this.ctx.manager.goTo(key, data, fade);
  }
}
