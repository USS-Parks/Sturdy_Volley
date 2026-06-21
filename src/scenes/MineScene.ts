import {
  Scene,
  ArcRotateCamera,
  MeshBuilder,
  Vector3,
  type AbstractMesh,
} from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, PALETTE } from '../render/scene-helpers';
import {
  getActiveSave,
  persistActiveSave,
  clearActiveSave,
  recordSkillXp,
} from '../engine/gameState';
import { writeSave } from '../engine/save';
import { recordActiveQuestEvent } from '../engine/quest-tracking';
import { formatWorldStatus } from '../engine/format';
import { computeMoveVector, type MoveInput } from '../engine/movement';
import { createControllerState, stepController, type ControllerState } from '../engine/controller';
import { resolveInteraction, type InteractTarget } from '../engine/interaction';
import type { SaveData } from '../engine/saveModel';
import { loadGameContent } from '../data/content';
import { forecastFor } from '../engine/weather';
import { tideStateAt, type TideState } from '../engine/tide';
import { getGameTime } from '../engine/dayResolution';
import { createTimeClock, pauseClock, tickClock, type TimeClockState } from '../engine/timeClock';
import type { Weather } from '../data/schemas';
import { addItem } from '../engine/inventory';
import {
  ascend,
  createMineHealth,
  descend,
  hurtPlayer,
  jumpToCheckpoint,
  levelAt,
  mineNode,
  recordCheckpoint,
  rollOreNodes,
  TOTAL_MINE_LEVELS,
  type MineHealthState,
  type OreNode,
} from '../engine/mine';
import {
  CAVE_CRITTER_LOOT,
  WEAPON_DEFS,
  applyHitToPlayer,
  createPlayerCombat,
  rollLoot,
  swingHit,
  tickIframes,
  tickTelegraph,
  type CreatureSnapshot,
  type WeaponId,
} from '../engine/combat';
import {
  buildRoomLayout,
  createBoss,
  damageBoss,
  elevatorOptions,
  tickBossPattern,
  tickLantern,
  type BossPattern,
} from '../engine/mineDepth';
import {
  CREATURE_KINDS,
  kindsForDepth,
  rollCreatureLoot,
  scaleStats,
  stepAi,
  type AiState,
  type CreatureKindDef,
} from '../engine/creatures';

interface MineDebugApi {
  level: () => number;
  ores: () => Array<{ id: string; ore: string; x: number; z: number }>;
  hp: () => number;
  descend: () => void;
  ascend: () => void;
  jump: (level: number) => void;
  swing: (nodeId: string) => void;
  checkpoints: () => number[];
  creatures: () => Array<{ id: string; hp: number; phase: string; x: number; z: number }>;
  forceSwing: () => void;
  teleport: (x: number, z: number) => void;
  equipWeapon: (id: 'fists' | 'driftwood-club' | 'tide-blade' | 'storm-spear') => void;
  openElevator: () => void;
  bossHp: () => number;
  strikeBoss: () => void;
  bossDefeated: () => boolean;
  lanternFuel: () => number;
}

/**
 * Mining and cave exploration (Prompt 023). A walkable 3D scene that
 * loads one of 20 level configurations from `MINE_LEVELS`, spawns
 * graybox rock + ore nodes, surfaces a ladder + descend / ascend
 * interaction, and tracks per-room hp. Pickaxe hardness gates which
 * ore nodes the player can break.
 */
export class MineScene extends GameScene {
  private camera!: ArcRotateCamera;
  private player!: AbstractMesh;
  private save!: SaveData;
  private controller: ControllerState = createControllerState();
  private clock!: TimeClockState;
  private weather: Weather | null = null;
  private tide: TideState = 'low';
  private targets: InteractTarget[] = [];
  private nearest: InteractTarget | null = null;
  private actionTimer = 0;
  private actionLabel = '';
  private hudTimer = 0;
  private menuOpen = false;
  private ePrev = false;
  private mineHealth: MineHealthState = createMineHealth();
  private oreNodes: OreNode[] = [];
  private readonly oreMeshes = new Map<string, AbstractMesh>();
  private readonly hazardMeshes: AbstractMesh[] = [];
  private readonly creatureMeshes: AbstractMesh[] = [];
  /** Active creature snapshots aligned with `creatureMeshes` order. */
  private creatures: CreatureSnapshot[] = [];
  /** Per-creature AI state aligned with `creatures` order (Prompt 026). */
  private creatureAi: AiState[] = [];
  private creatureKinds: CreatureKindDef[] = [];
  private creatureSeed = 1;
  private playerCombat = createPlayerCombat();
  private swingCooldown = 0;
  private equippedWeapon: WeaponId = 'fists';
  private fPrev = false;
  // Prompt 025
  private elevatorOpen = false;
  private boss: BossPattern | null = null;
  private bossMesh: AbstractMesh | null = null;
  private readonly pressed = new Set<string>();
  private readonly onKeyDown = (e: KeyboardEvent) => this.pressed.add(e.key.toLowerCase());
  private readonly onKeyUp = (e: KeyboardEvent) => this.pressed.delete(e.key.toLowerCase());

  build(): Scene {
    const scene = makeScene(this.ctx.engine);
    scene.collisionsEnabled = true;
    addFog(scene, PALETTE.quarry, 0.05);
    addLights(scene);

    this.camera = new ArcRotateCamera('mine-cam', -Math.PI / 2 + 0.4, Math.PI / 3, 18, Vector3.Zero(), scene);
    this.camera.fov = 0.8;

    const ground = MeshBuilder.CreateGround('mine-ground', { width: 24, height: 24 }, scene);
    ground.material = flatMaterial(scene, 'mine-ground', PALETTE.quarry, 0.22);
    ground.checkCollisions = true;
    const wall = (n: string, x: number, z: number, w: number, d: number) => {
      const m = MeshBuilder.CreateBox(n, { width: w, depth: d, height: 4 }, scene);
      m.position.set(x, 2, z);
      m.material = flatMaterial(scene, n, PALETTE.cliff, 0.18);
      m.checkCollisions = true;
    };
    wall('mw-n', 0, -12, 24, 1);
    wall('mw-s', 0, 12, 24, 1);
    wall('mw-w', -12, 0, 1, 24);
    wall('mw-e', 12, 0, 1, 24);

    const player = MeshBuilder.CreateCapsule('player', { height: 1.8, radius: 0.4 }, scene);
    player.position.set(0, 0.9, 10);
    player.material = flatMaterial(scene, 'player', PALETTE.player, 0.35);
    player.checkCollisions = true;
    player.ellipsoid = new Vector3(0.4, 0.9, 0.4);
    this.player = player;
    this.camera.lockedTarget = player;
    this.scene = scene;
    return scene;
  }

  override enter(): void {
    const save = getActiveSave();
    if (!save) {
      this.goTo('Title', undefined, false);
      return;
    }
    this.save = save;
    save.location.sceneKey = 'Mine';
    writeSave(save);
    // Prompt 054: descending credits "delve the quarry" exploration objectives.
    recordActiveQuestEvent({ kind: 'visit', target: 'Mine' });
    this.controller = createControllerState();
    this.clock = createTimeClock(getGameTime(save));
    this.refreshWorldState();
    this.mineHealth = createMineHealth();
    this.loadCurrentLevel();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.menuOpen = false;
    this.refreshHud();

    (window as unknown as { sturdyVolleyMine?: MineDebugApi }).sturdyVolleyMine = {
      level: () => this.save.mineProgress?.currentLevel ?? 0,
      ores: () => this.oreNodes.map((n) => ({ id: n.id, ore: n.ore, x: n.x, z: n.z })),
      hp: () => this.mineHealth.hp,
      descend: () => this.handleDescend(),
      ascend: () => this.handleAscend(),
      jump: (level: number) => {
        this.save.mineProgress = jumpToCheckpoint(this.save.mineProgress!, level);
        this.loadCurrentLevel();
        persistActiveSave();
      },
      swing: (nodeId: string) => this.handleSwing(nodeId),
      checkpoints: () => [...(this.save.mineProgress?.checkpoints ?? [])],
      creatures: () =>
        this.creatures.map((c) => ({ id: c.id, hp: c.hp, phase: c.phase, x: c.x, z: c.z })),
      forceSwing: () => this.performSwing(),
      teleport: (x: number, z: number) => {
        this.player.position.set(x, 0.9, z);
      },
      equipWeapon: (id: 'fists' | 'driftwood-club' | 'tide-blade' | 'storm-spear') => {
        this.equippedWeapon = id;
      },
      openElevator: () => this.openElevator(),
      bossHp: () => this.boss?.hp ?? -1,
      strikeBoss: () => this.swingAtBoss(),
      bossDefeated: () => this.save.mineProgress?.bossDefeated ?? false,
      lanternFuel: () => this.save.mineProgress?.lanternFuel ?? 0,
    };
  }

  private loadCurrentLevel(): void {
    const progress = this.save.mineProgress ?? { deepestLevel: 0, currentLevel: 0, checkpoints: [0] };
    const def = levelAt(progress.currentLevel);
    if (!def) return;
    for (const m of this.oreMeshes.values()) m.dispose();
    this.oreMeshes.clear();
    for (const m of this.hazardMeshes) m.dispose();
    this.hazardMeshes.length = 0;
    for (const m of this.creatureMeshes) m.dispose();
    this.creatureMeshes.length = 0;
    const seed = def.index * 101 + 7;
    this.oreNodes = rollOreNodes(def, seed);
    for (const node of this.oreNodes) {
      const mesh = MeshBuilder.CreatePolyhedron(`ore-${node.id}`, { type: 1, size: 0.8 }, this.scene!);
      mesh.position.set(node.x, 0.6, node.z);
      const color =
        node.ore === 'lampstone' || node.ore === 'sun-amber'
          ? PALETTE.warmLight
          : node.ore === 'silver-vein' || node.ore === 'cold-iron'
          ? PALETTE.stone
          : PALETTE.cliff;
      mesh.material = flatMaterial(
        this.scene!,
        `ore-${node.id}-mat`,
        color,
        node.ore === 'lampstone' || node.ore === 'sun-amber' ? 0.55 : 0.22,
      );
      mesh.checkCollisions = true;
      this.oreMeshes.set(node.id, mesh);
    }
    const hazardCount = Math.floor(def.hazardDensity * 16);
    for (let i = 0; i < hazardCount; i++) {
      const x = ((i * 131) % 18) - 9;
      const z = ((i * 73) % 18) - 9;
      const haz = MeshBuilder.CreateDisc(`mine-hazard-${def.index}-${i}`, { radius: 0.6 }, this.scene!);
      haz.rotation.x = Math.PI / 2;
      haz.position.set(x, 0.05, z);
      haz.material = flatMaterial(this.scene!, `mine-hazard-${def.index}-${i}-mat`, PALETTE.roof, 0.4);
      this.hazardMeshes.push(haz);
    }
    const creatureCount = Math.floor(def.creatureDensity * 5);
    this.creatures = [];
    this.creatureAi = [];
    this.creatureKinds = [];
    const eligibleKinds = kindsForDepth(def.index);
    const combatSkill = Math.min(1, (this.save.skills?.combat ?? 0) / 100);
    for (let i = 0; i < creatureCount; i++) {
      const x = ((i * 53) % 16) - 8;
      const z = ((i * 89) % 16) - 8;
      const kindId = eligibleKinds[i % eligibleKinds.length]!;
      const kind = CREATURE_KINDS[kindId];
      const stats = scaleStats(kind, { depth: def.index, combatSkill, assist: false });
      const c = MeshBuilder.CreateCapsule(`mine-creature-${def.index}-${i}`, { height: 0.5, radius: 0.2 }, this.scene!);
      c.position.set(x, 0.3, z);
      const color =
        kindId === 'gallery-moth' ? PALETTE.warmLight
        : kindId === 'shale-roller' ? PALETTE.stone
        : PALETTE.marsh;
      c.material = flatMaterial(this.scene!, `mine-creature-${def.index}-${i}-mat`, color, 0.25);
      this.creatureMeshes.push(c);
      this.creatures.push({
        id: `c-${def.index}-${i}`,
        hp: stats.hp,
        maxHp: stats.hp,
        phase: 'idle',
        phaseTime: 1.4 + ((i * 17) % 30) / 10,
        x,
        z,
      });
      this.creatureAi.push({ x, z, vx: 0, vz: 0 });
      this.creatureKinds.push(kind);
    }
    if (def.checkpoint) {
      this.save.mineProgress = recordCheckpoint(this.save.mineProgress!, def.index);
    }
    // Prompt 025: deterministic room layout per save seed (used for tests
    // + future asset-swap; the visual layout cluster around the layout's
    // ore anchors gives each save a stable mine).
    const layout = buildRoomLayout(def.index, this.save.mineProgress?.seed ?? 424242);
    void layout;
    // Boss on L19 (only spawn if not yet defeated).
    if (this.bossMesh) {
      this.bossMesh.dispose();
      this.bossMesh = null;
    }
    this.boss = null;
    if (def.index === 19 && !this.save.mineProgress?.bossDefeated) {
      this.boss = createBoss();
      const boss = MeshBuilder.CreateCylinder('boss-heartrock', { height: 2.2, diameter: 1.6 }, this.scene!);
      boss.position.set(0, 1.1, -6);
      boss.material = flatMaterial(this.scene!, 'boss-heartrock-mat', PALETTE.warmLight, 0.6);
      this.bossMesh = boss;
    }
    this.rebuildTargets();
  }

  private rebuildTargets(): void {
    const def = levelAt(this.save.mineProgress?.currentLevel ?? 0);
    const base: InteractTarget[] = [
      { id: 'ladder-up', kind: 'climb', label: 'Climb up the ladder', x: 0, z: 10, radius: 1.5, priority: 4 },
      { id: 'ladder-down', kind: 'climb', label: 'Descend further', x: 0, z: -10, radius: 1.5, priority: 4 },
      { id: 'leave', kind: 'door', label: 'Leave the quarry', x: -10, z: 10, radius: 1.4, priority: 3 },
    ];
    // Prompt 025: elevator lift surfaces on every checkpoint level.
    if (def?.checkpoint) {
      base.push({
        id: 'elevator',
        kind: 'prop',
        label: 'Use the elevator',
        x: 10,
        z: 10,
        radius: 1.4,
        priority: 3,
      });
    }
    if (this.boss) {
      base.push({
        id: 'boss',
        kind: 'machine',
        label: 'Strike the Heartrock',
        x: 0,
        z: -6,
        radius: 1.8,
        priority: 4,
      });
    }
    for (const node of this.oreNodes) {
      const def = levelAt(this.save.mineProgress?.currentLevel ?? 0);
      base.push({
        id: `ore:${node.id}`,
        kind: 'ore-node',
        label: `Mine ${node.ore}`,
        x: node.x,
        z: node.z,
        radius: 1.4,
        priority: def?.swingStaminaCost ?? 2,
      });
    }
    this.targets = base;
  }

  override update(dt: number): void {
    if (!this.save) return;
    if (this.menuOpen || this.elevatorOpen) {
      this.clock = pauseClock(this.clock, true);
      this.controller = stepController(this.controller, { dir: { x: 0, z: 0 }, sprint: false }, dt);
      return;
    }
    if (this.clock.paused) this.clock = pauseClock(this.clock, false);
    const dir = this.cameraRelativeDir(computeMoveVector(this.readInput()));
    const sprint = this.pressed.has('shift');
    this.controller = stepController(this.controller, { dir, sprint }, dt);
    if (this.controller.speed > 0.01 && (dir.x !== 0 || dir.z !== 0)) {
      this.player.moveWithCollisions(new Vector3(dir.x, 0, dir.z).scale(this.controller.speed * dt));
    }
    this.nearest = resolveInteraction(this.targets, this.player.position.x, this.player.position.z);
    const interact = this.pressed.has('e') || this.pressed.has(' ');
    if (interact && !this.ePrev && this.nearest) {
      if (this.nearest.id === 'ladder-up') this.handleAscend();
      else if (this.nearest.id === 'ladder-down') this.handleDescend();
      else if (this.nearest.id === 'leave') this.goTo('Farm', { entry: 'farmhouse-door' });
      else if (this.nearest.id.startsWith('ore:')) this.handleSwing(this.nearest.id.slice('ore:'.length));
      else if (this.nearest.id === 'elevator') this.openElevator();
      else if (this.nearest.id === 'boss') this.swingAtBoss();
    }
    this.ePrev = interact;
    if (this.actionTimer > 0) this.actionTimer -= dt;
    const tick = tickClock(this.clock, dt);
    this.clock = tick.state;
    // Combat tick (Prompt 024). Always advance creature telegraphs +
    // i-frames so the player can swing without waiting for a clock minute.
    this.tickCombat(dt);
    this.tickBoss(dt);
    this.tickLanternFuel(dt);

    if (tick.advancedMinutes > 0) {
      this.save.calendar.timeMinutes = this.clock.time.minutes;
      this.refreshWorldState();
      const overlap = this.hazardMeshes.some((h) => {
        const dx = h.position.x - this.player.position.x;
        const dz = h.position.z - this.player.position.z;
        return Math.hypot(dx, dz) < 0.7;
      });
      if (overlap) {
        this.mineHealth = hurtPlayer(this.mineHealth, 1);
        if (this.mineHealth.hp === 0) {
          this.actionLabel = 'You collapsed in the mine — back to the farm.';
          this.actionTimer = 1.8;
          this.goTo('Farm', { entry: 'farmhouse-door' });
          return;
        }
      }
    }
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.3;
      this.refreshHud();
    }
  }

  private cameraRelativeDir(vec: { x: number; y: number }): { x: number; z: number } {
    if (vec.x === 0 && vec.y === 0) return { x: 0, z: 0 };
    const forward = this.player.position.subtract(this.camera.position);
    forward.y = 0;
    if (forward.lengthSquared() < 1e-4) return { x: 0, z: 0 };
    forward.normalize();
    const right = new Vector3(forward.z, 0, -forward.x);
    const move = right.scale(vec.x).add(forward.scale(-vec.y));
    return { x: move.x, z: move.z };
  }

  private readInput(): MoveInput {
    const p = this.pressed;
    return {
      up: p.has('w') || p.has('arrowup'),
      down: p.has('s') || p.has('arrowdown'),
      left: p.has('a') || p.has('arrowleft'),
      right: p.has('d') || p.has('arrowright'),
    };
  }

  private refreshWorldState(): void {
    const content = loadGameContent();
    this.weather = forecastFor(this.clock.time, content.weather);
    this.tide = tideStateAt(this.clock.time);
  }

  private refreshHud(): void {
    const stamina = Math.round(this.controller.stamina);
    const status = formatWorldStatus(this.save, {
      weather: this.weather,
      tide: this.tide,
      gold: this.save.wallet.gold,
    });
    const def = levelAt(this.save.mineProgress?.currentLevel ?? 0);
    let line = `${status} · L${def?.index}: ${def?.name} · HP ${this.mineHealth.hp} · energy ${stamina}%`;
    if (this.actionTimer > 0) line += ` · ✔ ${this.actionLabel}`;
    else if (this.nearest) line += ` · [E] ${this.nearest.label}`;
    this.ctx.overlay.showHud('Mine', line, () => this.openMenu());
  }

  private openMenu(): void {
    this.menuOpen = true;
    this.ctx.overlay.showMenu(
      'Paused',
      [
        { id: 'resume', label: 'Resume', enabled: true, testId: 'pause-resume' },
        { id: 'leave', label: 'Leave the quarry', enabled: true, testId: 'nav-farm' },
        { id: 'save-quit', label: 'Save & quit to title', enabled: true, testId: 'nav-save-quit' },
      ],
      (id) => {
        if (id === 'resume') {
          this.menuOpen = false;
          this.refreshHud();
        } else if (id === 'leave') {
          this.goTo('Farm', { entry: 'farmhouse-door' });
        } else if (id === 'save-quit') {
          persistActiveSave();
          clearActiveSave();
          this.goTo('Title');
        }
      },
      formatWorldStatus(this.save, { weather: this.weather, tide: this.tide, gold: this.save.wallet.gold }),
    );
  }

  private tickCombat(dt: number): void {
    this.swingCooldown = Math.max(0, this.swingCooldown - dt);
    this.playerCombat = tickIframes(this.playerCombat, dt);

    // Advance each creature AI then telegraph and resolve strikes against the player.
    for (let i = 0; i < this.creatures.length; i++) {
      // Prompt 026: AI move first, then telegraph.
      const ai = this.creatureAi[i];
      const kind = this.creatureKinds[i];
      if (ai && kind) {
        this.creatureSeed += 1;
        const stats = scaleStats(kind, {
          depth: this.save.mineProgress?.currentLevel ?? 0,
          combatSkill: Math.min(1, (this.save.skills?.combat ?? 0) / 100),
          assist: false,
        });
        const stepped = stepAi({
          state: ai,
          role: kind.role,
          speed: stats.speed,
          playerX: this.player.position.x,
          playerZ: this.player.position.z,
          dt,
          seed: this.creatureSeed,
        });
        this.creatureAi[i] = stepped;
        this.creatures[i] = { ...this.creatures[i]!, x: stepped.x, z: stepped.z };
      }
      const next = tickTelegraph(this.creatures[i]!, dt);
      this.creatures[i] = next.creature;
      // Sync mesh transform (knockback may have moved it).
      const mesh = this.creatureMeshes[i];
      if (mesh) {
        mesh.position.x = next.creature.x;
        mesh.position.z = next.creature.z;
        // Visual cue: scale up subtly during windup.
        mesh.scaling.x = next.creature.phase === 'windup' ? 1.3 : 1;
        mesh.scaling.z = next.creature.phase === 'windup' ? 1.3 : 1;
      }
      // On a strike, check overlap with player and apply damage.
      if (next.striking) {
        const dx = next.creature.x - this.player.position.x;
        const dz = next.creature.z - this.player.position.z;
        if (Math.hypot(dx, dz) < 1.3) {
          const hit = applyHitToPlayer({ state: this.playerCombat, damage: 6, dt });
          this.playerCombat = hit.state;
          if (hit.damaged) {
            this.mineHealth = hurtPlayer(this.mineHealth, 6);
            if (this.mineHealth.hp === 0 || hit.defeated) {
              this.actionLabel = 'You stumbled out of the mine — recover on the farm.';
              this.actionTimer = 1.8;
              this.goTo('Farm', { entry: 'farmhouse-door' });
              return;
            }
          }
        }
      }
    }

    // Player F-key swing.
    const swingPressed = this.pressed.has('f');
    if (swingPressed && !this.fPrev && this.swingCooldown === 0) {
      this.performSwing();
    }
    this.fPrev = swingPressed;
  }

  private performSwing(): void {
    const weapon = WEAPON_DEFS[this.equippedWeapon];
    // Find nearest creature within reach.
    let bestIndex = -1;
    let bestDist = Infinity;
    for (let i = 0; i < this.creatures.length; i++) {
      const c = this.creatures[i]!;
      const d = Math.hypot(c.x - this.player.position.x, c.z - this.player.position.z);
      if (d < bestDist) {
        bestDist = d;
        bestIndex = i;
      }
    }
    if (bestIndex < 0 || bestDist > 1.8) {
      this.swingCooldown = weapon.cooldown;
      this.actionLabel = `Swing whiffs`;
      this.actionTimer = 0.8;
      return;
    }
    const result = swingHit({
      weapon,
      creature: this.creatures[bestIndex]!,
      playerX: this.player.position.x,
      playerZ: this.player.position.z,
    });
    this.creatures[bestIndex] = result.creature;
    this.swingCooldown = weapon.cooldown;
    if (result.downed) {
      const lootSeed = (this.save.mineProgress?.currentLevel ?? 0) * 17 + bestIndex * 11;
      const kind = this.creatureKinds[bestIndex];
      const itemId = kind ? rollCreatureLoot(kind, lootSeed) : rollLoot(CAVE_CRITTER_LOOT, lootSeed);
      const added = addItem(this.save.inventory, itemId, 1, 0);
      this.save.inventory = added.container;
      const mesh = this.creatureMeshes[bestIndex];
      if (mesh) mesh.dispose();
      this.creatureMeshes.splice(bestIndex, 1);
      this.creatures.splice(bestIndex, 1);
      this.creatureAi.splice(bestIndex, 1);
      this.creatureKinds.splice(bestIndex, 1);
      this.actionLabel = `Felled a ${kind?.name ?? 'critter'} (+${itemId})`;
      this.actionTimer = 1.4;
      recordSkillXp('combat', 6);
      persistActiveSave();
    } else {
      this.actionLabel = `${weapon.name} hit (${result.damage})`;
      this.actionTimer = 0.8;
    }
  }

  private openElevator(): void {
    const progress = this.save.mineProgress;
    if (!progress) return;
    this.elevatorOpen = true;
    const opts = elevatorOptions({
      checkpoints: progress.checkpoints,
      currentLevel: progress.currentLevel,
      levelName: (lvl) => levelAt(lvl)?.name ?? `Level ${lvl}`,
    });
    this.ctx.overlay.showElevatorPanel({
      options: opts,
      onSelect: (level) => {
        this.save.mineProgress = jumpToCheckpoint(progress, level);
        this.elevatorOpen = false;
        persistActiveSave();
        this.loadCurrentLevel();
        this.player.position.set(10, 0.9, 10);
        this.refreshHud();
      },
      onClose: () => {
        this.elevatorOpen = false;
        this.refreshHud();
      },
    });
  }

  private tickBoss(dt: number): void {
    if (!this.boss) return;
    const t = tickBossPattern(this.boss, dt);
    this.boss = t.state;
    if (this.bossMesh) {
      this.bossMesh.scaling.x = this.boss.phase === 'windup' ? 1.25 : 1;
      this.bossMesh.scaling.z = this.boss.phase === 'windup' ? 1.25 : 1;
    }
    if (t.striking) {
      const dx = (this.bossMesh?.position.x ?? 0) - this.player.position.x;
      const dz = (this.bossMesh?.position.z ?? 0) - this.player.position.z;
      if (Math.hypot(dx, dz) < 2.5) {
        const hit = applyHitToPlayer({ state: this.playerCombat, damage: 10, dt });
        this.playerCombat = hit.state;
        if (hit.damaged) {
          this.mineHealth = hurtPlayer(this.mineHealth, 10);
          if (this.mineHealth.hp === 0) {
            this.actionLabel = 'The Heartrock drove you out — try again from a checkpoint.';
            this.actionTimer = 2;
            this.goTo('Farm', { entry: 'farmhouse-door' });
          }
        }
      }
    }
  }

  private swingAtBoss(): void {
    if (!this.boss) return;
    const weapon = WEAPON_DEFS[this.equippedWeapon];
    this.boss = damageBoss(this.boss, weapon.damage);
    this.actionLabel = `Heartrock takes ${weapon.damage} (HP ${this.boss.hp}/${this.boss.maxHp})`;
    this.actionTimer = 1.0;
    if (this.boss.hp === 0) {
      this.save.mineProgress = { ...this.save.mineProgress!, bossDefeated: true };
      persistActiveSave();
      if (this.bossMesh) {
        this.bossMesh.dispose();
        this.bossMesh = null;
      }
      this.boss = null;
      this.actionLabel = 'The Heartrock is still. The mine quiets.';
      this.actionTimer = 2.5;
      this.rebuildTargets();
    }
  }

  private tickLanternFuel(dt: number): void {
    const progress = this.save.mineProgress;
    if (!progress) return;
    const def = levelAt(progress.currentLevel);
    if (!def) return;
    const next = tickLantern({
      state: { fuel: progress.lanternFuel, max: 600 },
      lighting: def.lighting,
      dt,
    });
    if (next.fuel !== progress.lanternFuel) {
      this.save.mineProgress = { ...progress, lanternFuel: next.fuel };
    }
  }

  private handleSwing(nodeId: string): void {
    const node = this.oreNodes.find((n) => n.id === nodeId);
    if (!node) return;
    const def = levelAt(this.save.mineProgress?.currentLevel ?? 0);
    if (!def) return;
    const pickaxeLevel = (this.save.toolLevels?.pick ?? 0) as 0 | 1 | 2 | 3;
    const result = mineNode({
      node,
      pickaxeLevel,
      staminaCost: def.swingStaminaCost,
      currentStamina: this.controller.stamina,
    });
    if (!result.broke) {
      this.actionLabel = result.reason === 'too-soft' ? 'Need a stronger pickaxe' : 'Too tired to swing';
      this.actionTimer = 1.6;
      return;
    }
    this.controller = { ...this.controller, stamina: result.stamina };
    if (result.drop) {
      const added = addItem(this.save.inventory, result.drop.itemId, result.drop.qty, result.drop.quality);
      this.save.inventory = added.container;
      this.actionLabel = `Mined ${result.drop.itemId}`;
      this.actionTimer = 1.6;
      recordSkillXp('exploring', 5);
    }
    const mesh = this.oreMeshes.get(nodeId);
    if (mesh) {
      mesh.dispose();
      this.oreMeshes.delete(nodeId);
    }
    this.oreNodes = this.oreNodes.filter((n) => n.id !== nodeId);
    this.rebuildTargets();
    persistActiveSave();
    // Prompt 054: breaking a deposit advances mining quest objectives.
    recordActiveQuestEvent({ kind: 'mine', target: result.drop?.itemId ?? null });
  }

  private handleDescend(): void {
    const progress = this.save.mineProgress;
    if (!progress) return;
    if (progress.currentLevel + 1 >= TOTAL_MINE_LEVELS) {
      this.actionLabel = 'Heartrock — deepest point reached.';
      this.actionTimer = 1.8;
      return;
    }
    this.save.mineProgress = descend(progress);
    persistActiveSave();
    this.loadCurrentLevel();
    this.player.position.set(0, 0.9, 10);
    this.actionLabel = `Descend to L${this.save.mineProgress!.currentLevel}`;
    this.actionTimer = 1.4;
  }

  private handleAscend(): void {
    const progress = this.save.mineProgress;
    if (!progress) return;
    if (progress.currentLevel === 0) {
      this.goTo('Farm', { entry: 'farmhouse-door' });
      return;
    }
    this.save.mineProgress = ascend(progress);
    persistActiveSave();
    this.loadCurrentLevel();
    this.player.position.set(0, 0.9, -10);
    this.actionLabel = `Ascend to L${this.save.mineProgress!.currentLevel}`;
    this.actionTimer = 1.4;
  }

  override dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    super.dispose();
  }
}
