import {
  Scene,
  MeshBuilder,
  Vector3,
  type Mesh,
} from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, addThreeQuarterCamera, PALETTE } from '../render/scene-helpers';
import {
  familyOf,
  gaitSpeed,
  type AnimalFamily,
  type AnimalFamilyId,
} from '../engine/animal-families';
import {
  fleeVelocity,
  flockVelocity,
  patrolStep,
  forageTarget,
  type Boid,
  type Vec2,
} from '../engine/fauna-behavior';
import { assignTiers, activeCount, type SimTier } from '../engine/npc-sim';

/**
 * Wild-fauna proving ground (WEF-08b, master Prompt 043).
 *
 * Demonstrates the four wild families with their signature behaviours — birds
 * (flock + flee), shoreline crawlers (forage + flee to water), swimming fauna
 * (school + flee, confined to water), and cave creatures (patrol + flee) —
 * without any of them being a dynamic rigid body. Distant fauna downgrade
 * through declared sim tiers, and an active-**skinned-body** ceiling caps how
 * many fauna render with a live mesh at once (mobile throttle).
 *
 * Reachable via the Title "Dev · Wild Lab" item or `?scene=WildLab`.
 */

const FIXED_DT = 1 / 30;
const PLAYER_HEIGHT = 1.8;
/** Mobile ceiling on simultaneously active **skinned** fauna meshes. */
const MAX_ACTIVE_SKINNED = 14;
const FLEE_RADIUS = 6;

/** Domains (XZ): the sea (water), the tideflat (shore), the cave. Birds fly over the shore. */
const WATER = { minX: -20, maxX: 20, minZ: -16, maxZ: 2 };
const SHORE = { minX: -20, maxX: 20, minZ: 2, maxZ: 14 };
const CAVE = { minX: -20, maxX: -8, minZ: 14, maxZ: 24 };
const AIR = { minX: -18, maxX: 18, minZ: 3, maxZ: 13 };
const CAVE_PATROL: Vec2[] = [
  { x: -18, z: 16 },
  { x: -10, z: 16 },
  { x: -10, z: 22 },
  { x: -18, z: 22 },
];

interface WildAgent {
  id: string;
  familyId: AnimalFamilyId;
  family: AnimalFamily;
  behavior: 'flock' | 'forage' | 'patrol';
  mesh: Mesh;
  pos: Vector3;
  vel: Vec2;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  flyY: number;
  seed: number;
  patrolIndex: number;
  forageGoal: Vec2;
  tier: SimTier;
  skinned: boolean;
  enteredForbiddenWater: boolean;
}

export class WildLabScene extends GameScene {
  private readonly agents: WildAgent[] = [];
  private playerPos = new Vector3(0, PLAYER_HEIGHT / 2, 8);
  private playerMesh!: Mesh;

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    this.scene = scene;
    addFog(scene, PALETTE.fog, 0.012);
    addLights(scene);
    addThreeQuarterCamera(scene, new Vector3(0, 0, 4), 52);

    this.buildGeometry(scene);

    const player = MeshBuilder.CreateCapsule('wild-player', { height: PLAYER_HEIGHT, radius: 0.4 }, scene);
    player.material = flatMaterial(scene, 'wild-player', PALETTE.player, 0.35);
    player.position.copyFrom(this.playerPos);
    this.playerMesh = player;

    this.buildFauna(scene);
    return scene;
  }

  override enter(): void {
    this.installDebugApi();
  }

  override update(dt: number): void {
    if (dt > 0) this.stepFauna(dt);
  }

  override dispose(): void {
    delete (window as unknown as { sturdyVolleyWild?: unknown }).sturdyVolleyWild;
    super.dispose();
  }

  private buildGeometry(scene: Scene): void {
    const sea = MeshBuilder.CreateGround('wild-sea', { width: WATER.maxX - WATER.minX, height: WATER.maxZ - WATER.minZ }, scene);
    sea.position.set(0, 0.01, (WATER.minZ + WATER.maxZ) / 2);
    const seaMat = flatMaterial(scene, 'wild-sea', PALETTE.sea, 0.4);
    seaMat.alpha = 0.7;
    sea.material = seaMat;
    sea.isPickable = false;

    const shore = MeshBuilder.CreateGround('wild-shore', { width: SHORE.maxX - SHORE.minX, height: SHORE.maxZ - SHORE.minZ }, scene);
    shore.position.set(0, 0, (SHORE.minZ + SHORE.maxZ) / 2);
    shore.material = flatMaterial(scene, 'wild-shore', PALETTE.sand, 0.22);
    shore.isPickable = false;

    const cave = MeshBuilder.CreateBox('wild-cave', { width: CAVE.maxX - CAVE.minX, height: 3, depth: CAVE.maxZ - CAVE.minZ }, scene);
    cave.position.set((CAVE.minX + CAVE.maxX) / 2, 1.5, (CAVE.minZ + CAVE.maxZ) / 2);
    cave.material = flatMaterial(scene, 'wild-cave', PALETTE.quarry, 0.12);
  }

  private buildFauna(scene: Scene): void {
    const spawn = (id: string, fid: AnimalFamilyId, behavior: WildAgent['behavior'], at: Vec2, bounds: WildAgent['bounds'], flyY: number, color = PALETTE.accent): void => {
      const fam = familyOf(fid);
      const body = MeshBuilder.CreateCapsule(`wild-${id}`, { height: fam.bodyProxyHeight, radius: fam.bodyProxyRadius }, scene);
      body.position.set(at.x, flyY, at.z);
      body.material = flatMaterial(scene, `wild-${id}`, color, 0.4);
      this.agents.push({
        id,
        familyId: fid,
        family: fam,
        behavior,
        mesh: body,
        pos: new Vector3(at.x, flyY, at.z),
        vel: { x: 0, z: 0 },
        bounds,
        flyY,
        seed: this.agents.length + 1,
        patrolIndex: 0,
        forageGoal: { ...at },
        tier: 'active',
        skinned: true,
        enteredForbiddenWater: false,
      });
    };

    // Birds: a flock over the shore.
    for (let i = 0; i < 8; i++) spawn(`bird-${i}`, 'bird', 'flock', { x: -4 + (i % 4) * 2, z: 7 + Math.floor(i / 4) }, AIR, 6, PALETTE.stone);
    // Shoreline crawlers: forage the tideflat near the waterline.
    for (let i = 0; i < 6; i++) spawn(`crab-${i}`, 'shoreline-crawler', 'forage', { x: -10 + i * 3, z: 4 }, SHORE, 0.2, PALETTE.roof);
    // Swimming fauna: a school in the sea.
    for (let i = 0; i < 8; i++) spawn(`fish-${i}`, 'swimming-fauna', 'flock', { x: -3 + (i % 4) * 2, z: -6 - Math.floor(i / 4) }, WATER, 0.3, PALETTE.accent);
    // Cave creatures: patrol the cave.
    for (let i = 0; i < 3; i++) spawn(`cave-${i}`, 'cave-creature', 'patrol', { x: -16 + i * 3, z: 18 }, CAVE, 0.6, PALETTE.warmLight);
  }

  private stepFauna(dt: number): void {
    // Tier assignment + active-skinned ceiling.
    const dists = this.agents.map((a) => ({ id: a.id, distance: Math.hypot(a.pos.x - this.playerPos.x, a.pos.z - this.playerPos.z) }));
    const tiers = assignTiers(dists, { activationRadius: 40, activeCap: MAX_ACTIVE_SKINNED });

    for (const a of this.agents) {
      a.tier = tiers.get(a.id) ?? 'abstract';
      // Active-skinned ceiling: only active fauna keep a live (skinned) mesh.
      a.skinned = a.tier === 'active';
      a.mesh.setEnabled(a.skinned);
      if (a.tier === 'abstract') continue; // abstract fauna freeze, no per-frame cost

      const vel = this.behaviorVelocity(a);
      a.vel = vel;
      a.pos.x += vel.x * dt;
      a.pos.z += vel.z * dt;
      this.clampDomain(a);
      a.mesh.position.set(a.pos.x, a.flyY, a.pos.z);

      // Water-eligibility tracking: a non-water family must never be in the sea.
      if (!a.family.waterCapable && this.inWater(a.pos.x, a.pos.z) && a.familyId !== 'bird') {
        a.enteredForbiddenWater = true;
      }
    }
  }

  private behaviorVelocity(a: WildAgent): Vec2 {
    const speed = gaitSpeed(a.family, a.family.gaits[a.family.gaits.length - 1].name);
    const flee = fleeVelocity({ x: a.pos.x, z: a.pos.z }, { x: this.playerPos.x, z: this.playerPos.z }, speed, FLEE_RADIUS);

    if (a.behavior === 'flock') {
      const neighbors: Boid[] = this.agents
        .filter((o) => o.familyId === a.familyId && o.id !== a.id && o.tier === 'active')
        .map((o) => ({ x: o.pos.x, z: o.pos.z, vx: o.vel.x, vz: o.vel.z }));
      const self: Boid = { x: a.pos.x, z: a.pos.z, vx: a.vel.x, vz: a.vel.z };
      const f = flockVelocity(self, neighbors);
      return { x: f.x + flee.x, z: f.z + flee.z };
    }
    if (a.behavior === 'patrol') {
      const r = patrolStep(CAVE_PATROL, a.patrolIndex, { x: a.pos.x, z: a.pos.z });
      a.patrolIndex = r.index;
      return { x: r.dir.x * speed + flee.x, z: r.dir.z * speed + flee.z };
    }
    // forage: wander the shore; flee to water (crabs are water-capable) when threatened.
    if (Math.hypot(flee.x, flee.z) > 1e-3) return flee;
    const goal = a.forageGoal;
    const dx = goal.x - a.pos.x;
    const dz = goal.z - a.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.4) {
      a.seed += 1;
      a.forageGoal = forageTarget(a.bounds, a.seed);
      return { x: 0, z: 0 };
    }
    const gs = gaitSpeed(a.family, 'scuttle');
    return { x: (dx / d) * gs, z: (dz / d) * gs };
  }

  private clampDomain(a: WildAgent): void {
    // Crabs may step into the water when fleeing (water-capable); everyone else
    // is held to their domain.
    const b = a.behavior === 'forage' && this.inWater(a.pos.x, a.pos.z) ? { ...a.bounds, minZ: WATER.minZ } : a.bounds;
    a.pos.x = Math.max(b.minX, Math.min(b.maxX, a.pos.x));
    a.pos.z = Math.max(b.minZ, Math.min(b.maxZ, a.pos.z));
  }

  private inWater(x: number, z: number): boolean {
    return x >= WATER.minX && x <= WATER.maxX && z >= WATER.minZ && z <= WATER.maxZ;
  }

  private groupCentroidGap(prefix: string): number {
    const g = this.agents.filter((a) => a.id.startsWith(prefix));
    if (g.length === 0) return 99;
    const cx = g.reduce((s, a) => s + a.pos.x, 0) / g.length;
    const cz = g.reduce((s, a) => s + a.pos.z, 0) / g.length;
    return Math.hypot(cx - this.playerPos.x, cz - this.playerPos.z);
  }

  private groupMinDist(prefix: string): number {
    const g = this.agents.filter((a) => a.id.startsWith(prefix));
    let min = Infinity;
    for (const a of g) min = Math.min(min, Math.hypot(a.pos.x - this.playerPos.x, a.pos.z - this.playerPos.z));
    return min === Infinity ? 99 : min;
  }

  private groupSpread(prefix: string): number {
    const g = this.agents.filter((a) => a.id.startsWith(prefix));
    let max = 0;
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) max = Math.max(max, Math.hypot(g[i].pos.x - g[j].pos.x, g[i].pos.z - g[j].pos.z));
    return max;
  }

  private installDebugApi(): void {
    const api = {
      meshCount: (): number => this.scene.meshes.length,
      population: (): number => this.agents.length,
      fauna: (): Array<{ id: string; family: string; behavior: string; tier: SimTier; skinned: boolean; pos: { x: number; z: number }; enteredForbiddenWater: boolean }> =>
        this.agents.map((a) => ({ id: a.id, family: a.familyId, behavior: a.behavior, tier: a.tier, skinned: a.skinned, pos: { x: a.pos.x, z: a.pos.z }, enteredForbiddenWater: a.enteredForbiddenWater })),
      activeCount: (): number => activeCount(new Map(this.agents.map((a) => [a.id, a.tier]))),
      activeSkinnedCount: (): number => this.agents.filter((a) => a.skinned).length,
      maxActiveSkinned: (): number => MAX_ACTIVE_SKINNED,
      setPlayer: (x: number, z: number): void => {
        this.playerPos.set(x, PLAYER_HEIGHT / 2, z);
        this.playerMesh.position.copyFrom(this.playerPos);
      },
      tick: (n = 1): void => {
        for (let i = 0; i < n; i++) this.stepFauna(FIXED_DT);
      },
      groupGap: (prefix: string): number => this.groupCentroidGap(prefix),
      groupMinDist: (prefix: string): number => this.groupMinDist(prefix),
      groupSpread: (prefix: string): number => this.groupSpread(prefix),
      /** Per-family domain-respect summary. */
      fishAllInWater: (): boolean => this.agents.filter((a) => a.id.startsWith('fish')).every((a) => a.pos.z <= WATER.maxZ + 0.01),
      caveAllInCave: (): boolean => this.agents.filter((a) => a.id.startsWith('cave')).every((a) => a.pos.z >= CAVE.minZ - 0.01),
      birdsOverShore: (): boolean => this.agents.filter((a) => a.id.startsWith('bird')).every((a) => a.pos.z >= SHORE.minZ - 0.01),
    };
    (window as unknown as { sturdyVolleyWild?: typeof api }).sturdyVolleyWild = api;
  }
}
