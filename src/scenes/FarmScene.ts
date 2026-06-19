import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { UIOverlay } from '../ui/overlay';
import { getActiveSave, persistActiveSave, clearActiveSave } from '../engine/gameState';
import { writeSave } from '../engine/save';
import { formatSaveStatus } from '../engine/format';
import { createWorldTextures } from '../engine/textures';
import { generateBreakpointFarm } from '../maps/breakpointFarm';
import { TILE } from '../maps/tiles';
import { computeMoveVector, type MoveInput } from '../engine/movement';
import type { SaveData } from '../engine/saveModel';

const WALK_SPEED = 150;

interface DebugApi {
  player: () => { x: number; y: number };
}

/**
 * Breakpoint Farm — the first playable tilemap scene. Procedural placeholder
 * tiles + objects, tile + object collision, a follow camera bounded to the map,
 * and a walkable player (keyboard + touch). A HUD bar + pause menu preserve
 * navigation and saving until proper map exits arrive in later prompts.
 */
export class FarmScene extends GameScene {
  private overlay!: UIOverlay;
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private pointerActive = false;
  private menuOpen = false;

  constructor() {
    super('Farm');
  }

  create(): void {
    const save = getActiveSave();
    if (!save) {
      this.scene.start('Title');
      return;
    }
    save.location.sceneKey = 'Farm';
    writeSave(save);

    createWorldTextures(this);
    const farm = generateBreakpointFarm();
    const pixelWidth = farm.width * TILE;
    const pixelHeight = farm.height * TILE;

    // --- Tilemap + collision ---
    const map = this.make.tilemap({ data: farm.tiles, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('farm-tiles');
    const layer = tileset ? map.createLayer(0, tileset, 0, 0) : null;
    if (layer) {
      layer.setCollision(farm.collides);
      this.animateWater(layer, farm.waterIndices);
    }

    // --- Objects (depth-sorted; solids get static bodies) ---
    const solids = this.physics.add.staticGroup();
    for (const obj of farm.objects) {
      const px = obj.tx * TILE + TILE / 2;
      const py = obj.ty * TILE + TILE / 2;
      const key = `sv-${obj.type}`;
      if (obj.solid) {
        const sprite = solids.create(px, py, key) as Phaser.Types.Physics.Arcade.SpriteWithStaticBody;
        sprite.setOrigin(0.5, 1);
        const bw = sprite.width * 0.7;
        const bh = Math.min(sprite.height * 0.35, 22);
        sprite.body.setSize(bw, bh);
        sprite.body.setOffset((sprite.width - bw) / 2, sprite.height - bh);
        sprite.setDepth(py);
      } else {
        this.add.image(px, py, key).setOrigin(0.5, 1).setDepth(py);
      }
    }
    this.addGrassTufts(farm.width, farm.height);

    // --- Player ---
    this.player = this.physics.add.sprite(farm.spawn.x, farm.spawn.y, 'sv-player');
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(16, 10).setOffset(4, 21);

    // --- World + camera ---
    this.physics.world.setBounds(0, 0, pixelWidth, pixelHeight);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, pixelWidth, pixelHeight);
    cam.setBackgroundColor('#16361f');
    cam.startFollow(this.player, true, 0.12, 0.12);

    if (layer) this.physics.add.collider(this.player, layer);
    this.physics.add.collider(this.player, solids);

    // --- Input ---
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.cursors = keyboard.createCursorKeys();
      this.keys = keyboard.addKeys('W,A,S,D') as typeof this.keys;
    }
    this.input.on('pointerdown', () => {
      this.pointerActive = true;
    });
    this.input.on('pointerup', () => {
      this.pointerActive = false;
    });

    // --- Overlay HUD ---
    this.overlay = new UIOverlay();
    this.showHud(save);

    // Debug hook for e2e (position read-out).
    (window as unknown as { sturdyVolleyDebug?: DebugApi }).sturdyVolleyDebug = {
      player: () => ({ x: this.player.x, y: this.player.y }),
    };

    this.fadeIn();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown');
      this.input.off('pointerup');
      this.overlay.clear();
    });
  }

  override update(): void {
    if (!this.player || this.menuOpen) {
      this.player?.setVelocity(0, 0);
      return;
    }
    const vec = computeMoveVector(this.readInput());
    this.player.setVelocity(vec.x * WALK_SPEED, vec.y * WALK_SPEED);
    if (vec.x < 0) this.player.setFlipX(true);
    else if (vec.x > 0) this.player.setFlipX(false);
    this.player.setDepth(this.player.y);
  }

  private readInput(): MoveInput {
    const c = this.cursors;
    const k = this.keys;
    const up = Boolean(c?.up.isDown || k?.W.isDown);
    const down = Boolean(c?.down.isDown || k?.S.isDown);
    const left = Boolean(c?.left.isDown || k?.A.isDown);
    const right = Boolean(c?.right.isDown || k?.D.isDown);

    let pointer: MoveInput['pointer'];
    if (this.pointerActive) {
      const p = this.input.activePointer;
      pointer = { dx: p.worldX - this.player.x, dy: p.worldY - this.player.y, active: true };
    }
    return { up, down, left, right, pointer };
  }

  private animateWater(layer: Phaser.Tilemaps.TilemapLayer, indices: [number, number]): void {
    let phase = false;
    this.time.addEvent({
      delay: 800,
      loop: true,
      callback: () => {
        phase = !phase;
        const [a, b] = indices;
        layer.replaceByIndex(phase ? a : b, phase ? b : a);
      },
    });
  }

  private addGrassTufts(width: number, height: number): void {
    for (let i = 0; i < 10; i++) {
      const tx = 3 + ((i * 11) % (width - 6));
      const ty = 3 + ((i * 7) % (height - 6));
      const tuft = this.add.image(tx * TILE + 16, ty * TILE + 24, 'sv-tuft').setDepth(ty * TILE + 24);
      this.tweens.add({
        targets: tuft,
        angle: { from: -6, to: 6 },
        duration: 1400 + i * 90,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
  }

  private showHud(save: SaveData): void {
    this.menuOpen = false;
    this.overlay.showHud(save.player.farmName, formatSaveStatus(save), () => this.openMenu(save));
  }

  private openMenu(save: SaveData): void {
    this.menuOpen = true;
    this.overlay.showMenu(
      'Paused',
      [
        { id: 'resume', label: 'Resume', enabled: true, testId: 'pause-resume' },
        { id: 'town', label: 'Walk to Ballast Bay', enabled: true, testId: 'nav-town' },
        { id: 'court', label: 'Practice court', enabled: true, testId: 'nav-court' },
        { id: 'mine', label: 'Ironroot Quarry', enabled: true, testId: 'nav-mine' },
        { id: 'save-quit', label: 'Save & quit to title', enabled: true, testId: 'nav-save-quit' },
      ],
      (id) => this.onPause(id, save),
      formatSaveStatus(save),
    );
  }

  private onPause(id: string, save: SaveData): void {
    switch (id) {
      case 'resume':
        this.showHud(save);
        break;
      case 'town':
        this.fadeTo('Town');
        break;
      case 'court':
        this.fadeTo('Court');
        break;
      case 'mine':
        this.fadeTo('Mine');
        break;
      case 'save-quit':
        persistActiveSave();
        clearActiveSave();
        this.fadeTo('Title');
        break;
    }
  }
}
