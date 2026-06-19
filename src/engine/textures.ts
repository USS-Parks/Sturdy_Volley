import Phaser from 'phaser';
import { TILE } from '../maps/tiles';

/**
 * Generates all placeholder world textures procedurally (no external art).
 * Real art replaces these in the polish prompts; everything here is original,
 * code-drawn shapes. Idempotent — safe to call on every scene create.
 */
export function createWorldTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('farm-tiles')) return;

  buildTileset(scene);
  buildPlayer(scene);
  buildTree(scene);
  buildRock(scene);
  buildHouse(scene);
  buildFence(scene);
  buildCourt(scene);
  buildTuft(scene);
}

function buildTileset(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const fill = (i: number, color: number) => g.fillStyle(color, 1).fillRect(i * TILE, 0, TILE, TILE);
  const dot = (i: number, color: number, dx: number, dy: number, s = 4) =>
    g.fillStyle(color, 1).fillRect(i * TILE + dx, dy, s, s);

  // 0 grass
  fill(0, 0x3f7d4a);
  dot(0, 0x4c9159, 6, 8);
  dot(0, 0x356b40, 20, 18);
  // 1 grass-alt
  fill(1, 0x478650);
  dot(1, 0x59a065, 10, 6);
  dot(1, 0x3a6f45, 22, 22);
  // 2 soil
  fill(2, 0x6b4a2f);
  dot(2, 0x7d5836, 8, 10, 5);
  dot(2, 0x5a3d27, 20, 20, 5);
  // 3 sand
  fill(3, 0xd9c389);
  dot(3, 0xe6d39c, 9, 12);
  dot(3, 0xc8b074, 21, 8);
  // 4 water-a
  fill(4, 0x2c6f8f);
  g.fillStyle(0x3d85a6, 1).fillRect(4 * TILE + 4, 10, 24, 3).fillRect(4 * TILE + 6, 20, 20, 3);
  // 5 water-b
  fill(5, 0x2c6f8f);
  g.fillStyle(0x3d85a6, 1).fillRect(5 * TILE + 6, 14, 22, 3).fillRect(5 * TILE + 4, 24, 24, 3);
  // 6 cliff
  fill(6, 0x5a5550);
  g.fillStyle(0x6b655f, 1).fillRect(6 * TILE + 4, 6, 10, 10).fillRect(6 * TILE + 18, 16, 10, 10);
  // 7 path
  fill(7, 0xb59d6b);
  dot(7, 0xc7ae79, 10, 10);

  g.generateTexture('farm-tiles', 8 * TILE, TILE);
  g.destroy();
}

function buildPlayer(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  // body
  g.fillStyle(0x2f5d8a, 1).fillRoundedRect(4, 14, 16, 16, 4);
  // head
  g.fillStyle(0xf0d2a8, 1).fillCircle(12, 9, 7);
  // scarf
  g.fillStyle(0x7fd1c4, 1).fillRect(5, 15, 14, 3);
  g.generateTexture('sv-player', 24, 32);
  g.destroy();
}

function buildTree(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0x5a3d27, 1).fillRect(20, 40, 8, 22); // trunk
  g.fillStyle(0x2f6b3c, 1).fillCircle(24, 26, 22); // canopy
  g.fillStyle(0x3a8049, 1).fillCircle(16, 20, 12);
  g.generateTexture('sv-tree', 48, 64);
  g.destroy();
}

function buildRock(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0x726b63, 1).fillRoundedRect(2, 6, 26, 16, 6);
  g.fillStyle(0x847c73, 1).fillRoundedRect(6, 4, 12, 8, 4);
  g.generateTexture('sv-rock', 30, 24);
  g.destroy();
}

function buildHouse(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0xb5754a, 1).fillRect(8, 40, 112, 52); // walls
  g.fillStyle(0x8a3f33, 1).fillTriangle(0, 42, 128, 42, 64, 4); // roof
  g.fillStyle(0x3a2a1f, 1).fillRect(54, 64, 20, 28); // door
  g.fillStyle(0x9fd6cc, 1).fillRect(22, 52, 16, 14).fillRect(90, 52, 16, 14); // windows
  g.generateTexture('sv-house', 128, 96);
  g.destroy();
}

function buildFence(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0x8a6a45, 1);
  g.fillRect(4, 6, 4, 20).fillRect(24, 6, 4, 20); // posts
  g.fillRect(0, 10, 32, 4).fillRect(0, 18, 32, 4); // rails
  g.generateTexture('sv-fence', 32, 28);
  g.destroy();
}

function buildCourt(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0xd9c389, 1).fillRoundedRect(0, 0, 96, 64, 8); // sand pad
  g.lineStyle(2, 0xffffff, 0.8).strokeRect(8, 8, 80, 48); // court lines
  g.fillStyle(0xeaf4f4, 1).fillRect(46, 6, 4, 52); // net
  g.generateTexture('sv-court', 96, 64);
  g.destroy();
}

function buildTuft(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0x4c9159, 1);
  g.fillTriangle(2, 16, 4, 4, 6, 16).fillTriangle(6, 16, 9, 2, 12, 16).fillTriangle(10, 16, 13, 6, 14, 16);
  g.generateTexture('sv-tuft', 16, 16);
  g.destroy();
}
