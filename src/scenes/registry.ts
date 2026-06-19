import type { SceneFactory } from './SceneManager';
import { BootScene } from './BootScene';
import { PreloadScene } from './PreloadScene';
import { TitleScene } from './TitleScene';
import { NewGameScene } from './NewGameScene';
import { FarmScene } from './FarmScene';
import { TownScene } from './TownScene';
import { InteriorScene } from './InteriorScene';
import { BeachScene } from './BeachScene';
import { MineScene } from './MineScene';

/** All game scenes, keyed by the names used in save.location.sceneKey + transitions. */
export const SCENE_FACTORIES: Record<string, SceneFactory> = {
  Boot: (ctx) => new BootScene(ctx),
  Preload: (ctx) => new PreloadScene(ctx),
  Title: (ctx) => new TitleScene(ctx),
  NewGame: (ctx) => new NewGameScene(ctx),
  Farm: (ctx) => new FarmScene(ctx),
  Town: (ctx) => new TownScene(ctx),
  Interior: (ctx) => new InteriorScene(ctx),
  Beach: (ctx) => new BeachScene(ctx),
  Mine: (ctx) => new MineScene(ctx),
};
