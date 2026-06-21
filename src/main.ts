import { Engine } from '@babylonjs/core';
import { UIOverlay } from './ui/overlay';
import { FadeLayer } from './render/fade';
import { SceneManager } from './scenes/SceneManager';
import { SCENE_FACTORIES } from './scenes/registry';
import {
  budgetFor,
  isPerfOverlayEnabled,
  mountPerfOverlay,
  sampleScene,
} from './render/perf-overlay';
import {
  isScheduleOverlayEnabled,
  mountScheduleOverlay,
} from './render/schedule-overlay';
import { getActiveSave } from './engine/gameState';
import { forecastFor } from './engine/weather';
import { festivalForDay } from './engine/festival';
import { loadGameContent } from './data/content';
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

  // Performance overlay — only mounted when the `?debug=perf` URL flag is
  // present. The render loop samples each frame; Playwright reads the dataset
  // attributes to assert mobile budgets.
  if (isPerfOverlayEnabled()) {
    const overlayCtrl = mountPerfOverlay();
    let lastLabel = '';
    engine.runRenderLoop(() => {
      const scene = manager.currentScene();
      const sceneKey = manager.currentSceneKey();
      if (sceneKey && sceneKey !== lastLabel) {
        overlayCtrl.setLabel(sceneKey);
        lastLabel = sceneKey;
      }
      overlayCtrl.updateFrom(sampleScene(engine, scene), sceneKey ? budgetFor(sceneKey) : undefined);
    });
  }

  // Schedule-debug overlay (RF-11) — only mounted when `?debug=schedules` is
  // set. Refreshes from the active save's calendar + weather so every NPC's
  // current waypoint is visible during a play session.
  if (isScheduleOverlayEnabled()) {
    const overlayCtrl = mountScheduleOverlay();
    engine.runRenderLoop(() => {
      const save = getActiveSave();
      if (!save) return;
      const content = loadGameContent();
      const weather = forecastFor(
        {
          year: save.calendar.year,
          season: save.calendar.season,
          day: save.calendar.day,
          minutes: save.calendar.timeMinutes,
        },
        content.weather,
      );
      overlayCtrl.updateFrom({
        minutes: save.calendar.timeMinutes,
        season: save.calendar.season,
        weatherId: weather?.id ?? null,
        // Prompt 056: surface the festival schedule layer in the debug overlay.
        festivalId:
          festivalForDay({ season: save.calendar.season, day: save.calendar.day }, content.festivals)?.id ?? null,
        relationshipLevel: 0,
        activeEventFlags: [],
      });
    });
  }

  // Debug/e2e introspection only.
  (window as unknown as { sturdyVolley?: { engine: Engine; manager: SceneManager } }).sturdyVolley = {
    engine,
    manager,
  };
}

bootstrap();
