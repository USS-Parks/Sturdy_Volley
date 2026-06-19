import { Engine } from '@babylonjs/core';
import { UIOverlay } from './ui/overlay';
import { FadeLayer } from './render/fade';
import { SceneManager } from './scenes/SceneManager';
import { SCENE_FACTORIES } from './scenes/registry';
import './styles.css';

/**
 * Entry point. Boots the Babylon engine on #game-canvas and runs the scene
 * graph (Boot -> Preload -> Title -> ...). Menus/HUD live in the DOM overlay.
 */
function bootstrap(): void {
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Sturdy Volley: #game-canvas not found.');
  }

  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
  });
  const overlay = new UIOverlay();
  const fade = new FadeLayer();
  const manager = new SceneManager(engine, SCENE_FACTORIES, overlay, fade);

  manager.start();
  void manager.goTo('Boot', undefined, false);

  window.addEventListener('resize', () => engine.resize());

  // Debug/e2e introspection only.
  (window as unknown as { sturdyVolley?: { engine: Engine; manager: SceneManager } }).sturdyVolley = {
    engine,
    manager,
  };
}

bootstrap();
