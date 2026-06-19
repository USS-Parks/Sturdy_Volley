import type { Engine } from '@babylonjs/core';
import type { UIOverlay } from '../ui/overlay';
import type { FadeLayer } from '../render/fade';
import type { GameScene, SceneContext } from './GameScene';

export type SceneFactory = (ctx: SceneContext) => GameScene;

/**
 * Owns the Babylon render loop and the active GameScene. Transitions dispose the
 * old scene and build the next, with an interrupt-safe DOM fade between them.
 */
export class SceneManager {
  private current: GameScene | null = null;
  private transitioning = false;

  constructor(
    private readonly engine: Engine,
    private readonly factories: Record<string, SceneFactory>,
    private readonly overlay: UIOverlay,
    private readonly fade: FadeLayer,
  ) {}

  start(): void {
    this.engine.runRenderLoop(() => {
      const scene = this.current;
      if (!scene) return;
      scene.update(this.engine.getDeltaTime() / 1000);
      scene.getScene().render();
    });
  }

  async goTo(key: string, data?: unknown, fade = true): Promise<void> {
    if (this.transitioning) return;
    const factory = this.factories[key];
    if (!factory) throw new Error(`SceneManager: unknown scene "${key}"`);

    this.transitioning = true;
    if (this.current && fade) await this.fade.out();

    this.current?.dispose();

    const next = factory({ engine: this.engine, manager: this, overlay: this.overlay });
    next.build();
    this.current = next;
    next.enter(data);

    // Release the guard as soon as the next scene is interactive — the fade-in
    // is cosmetic, so user input landing during it must not be dropped.
    this.transitioning = false;
    if (fade) await this.fade.in();
  }
}
