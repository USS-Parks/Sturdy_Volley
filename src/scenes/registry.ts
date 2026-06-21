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
import { CameraLabScene } from './CameraLabScene';
import { StreamingLabScene } from './StreamingLabScene';
import { InteriorLabScene } from './InteriorLabScene';
import { NavLabScene } from './NavLabScene';
import { FaunaLabScene } from './FaunaLabScene';
import { WildLabScene } from './WildLabScene';
import { MountLabScene } from './MountLabScene';
import { FloraLabScene } from './FloraLabScene';
import { BreakpointFarmScene } from './BreakpointFarmScene';
import { FarmhouseInteriorScene } from './FarmhouseInteriorScene';
import { BallastBayTownScene } from './BallastBayTownScene';

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
  // Dev-only proving ground (WEF-01a). Entered via the Title dev menu or the
  // `?scene=CameraLab` direct-boot route; never part of normal play.
  CameraLab: (ctx) => new CameraLabScene(ctx),
  // Dev-only streaming proving ground (WEF-04). Entered via the Title dev menu or
  // the `?scene=StreamingLab` direct-boot route; never part of normal play.
  StreamingLab: (ctx) => new StreamingLabScene(ctx),
  // Dev-only interior-kit proving ground (WEF-05). `?scene=InteriorLab`.
  InteriorLab: (ctx) => new InteriorLabScene(ctx),
  // Dev-only NPC-navigation proving ground (WEF-07a). `?scene=NavLab`.
  NavLab: (ctx) => new NavLabScene(ctx),
  // Dev-only animal-family proving ground (WEF-08a). `?scene=FaunaLab`.
  FaunaLab: (ctx) => new FaunaLabScene(ctx),
  // Dev-only wild-fauna proving ground (WEF-08b). `?scene=WildLab`.
  WildLab: (ctx) => new WildLabScene(ctx),
  // Dev-only mount-system proving ground (Prompt 044). `?scene=MountLab`.
  MountLab: (ctx) => new MountLabScene(ctx),
  // Dev-only flora/environment-motion proving ground (WEF-09). `?scene=FloraLab`.
  FloraLab: (ctx) => new FloraLabScene(ctx),
  // Production-foundation map I (WEF-10a, Prompt 046). `?scene=BreakpointFarm`.
  BreakpointFarm: (ctx) => new BreakpointFarmScene(ctx),
  FarmhouseInterior: (ctx) => new FarmhouseInteriorScene(ctx),
  // Production-foundation map II (WEF-10b, Prompt 047). `?scene=BallastBayTown`.
  BallastBayTown: (ctx) => new BallastBayTownScene(ctx),
};
