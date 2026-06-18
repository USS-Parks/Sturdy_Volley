import Phaser from 'phaser';
import { createGameConfig } from './config/gameConfig';
import './styles.css';

/**
 * Entry point. Creates the Phaser game and mounts it into #game-root. The HTML
 * overlay (#ui-root) is managed separately by UIOverlay for menus/panels.
 */
function bootstrap(): Phaser.Game {
  const game = new Phaser.Game(createGameConfig('game-root'));
  // Expose for debugging and e2e introspection only.
  (window as unknown as { sturdyVolley?: Phaser.Game }).sturdyVolley = game;
  return game;
}

bootstrap();
