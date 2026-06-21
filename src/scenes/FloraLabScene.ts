import {
  Scene,
  MeshBuilder,
  Vector3,
  type Mesh,
} from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, addThreeQuarterCamera, PALETTE } from '../render/scene-helpers';
import {
  FLORA_FAMILIES,
  floraFamily,
  windStrength,
  swayAngle,
  interactionBend,
  assignFloraTiers,
  activeDeformingCount,
  DEFAULT_WIND,
  DEFAULT_FLORA_PERF,
  type FloraFamily,
  type FloraFamilyId,
  type FloraTier,
  type FloraInstanceRef,
} from '../engine/flora-motion';

/**
 * Flora & environment-motion proving ground (WEF-09, master Prompt 045).
 *
 * Demonstrates the nine motion families — grass, crops, shrubs, flowers, trees,
 * reeds, kelp, hanging props, shoreline foam — each with a **distinct** authored
 * response: wind families gust + sway with a per-instance phase (no lockstep),
 * water/tide families undulate on a current, trees barely move and ignore movers,
 * reeds whip and are pushed aside. Distance **tiers** + a hard **active-deformation
 * ceiling** throttle the field; **reduced motion** stills the ambient sway while
 * **preserving the interaction cue**; the motion layer is **read-only** over
 * gameplay state (a sample crop's growth never changes from sway).
 *
 * Reachable via the Title "Dev · Flora Lab" item or `?scene=FloraLab`.
 */

const FIXED_DT = 1 / 30;
const PLAYER_HEIGHT = 1.8;
const INTERACT_RADIUS = 2.2;

interface FloraInstance {
  id: string;
  familyId: FloraFamilyId;
  family: FloraFamily;
  mesh: Mesh;
  /** Stable per-instance phase (anti-lockstep). */
  phase: number;
  base: { x: number; z: number };
  /** Applied bend this frame (rad) — exposed for assertions. */
  appliedAngle: number;
  /** Deterministic gameplay state the motion layer must never touch. */
  growth?: number;
}

export class FloraLabScene extends GameScene {
  private readonly instances: FloraInstance[] = [];
  private playerPos = new Vector3(0, PLAYER_HEIGHT / 2, -4);
  private playerMesh!: Mesh;
  private time = 0;
  private reducedMotion = false;
  private tiers = new Map<string, FloraTier>();
  private seed = 3;

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    this.scene = scene;
    addFog(scene, PALETTE.fog, 0.006);
    addLights(scene);
    addThreeQuarterCamera(scene, new Vector3(0, 0, 14), 46);

    const ground = MeshBuilder.CreateGround('flora-ground', { width: 90, height: 90 }, scene);
    ground.material = flatMaterial(scene, 'flora-ground', PALETTE.grass, 0.2);
    ground.isPickable = false;

    // Pond + shore strip for reeds / kelp / foam.
    const pond = MeshBuilder.CreateGround('flora-pond', { width: 22, height: 16 }, scene);
    pond.position.set(-22, 0.02, 26);
    const pondMat = flatMaterial(scene, 'flora-pond', PALETTE.sea, 0.4);
    pondMat.alpha = 0.7;
    pond.material = pondMat;
    pond.isPickable = false;

    const player = MeshBuilder.CreateCapsule('flora-player', { height: PLAYER_HEIGHT, radius: 0.4 }, scene);
    player.material = flatMaterial(scene, 'flora-player', PALETTE.player, 0.35);
    player.position.copyFrom(this.playerPos);
    this.playerMesh = player;

    this.buildFlora(scene);
    return scene;
  }

  override enter(): void {
    this.installDebugApi();
  }

  override update(dt: number): void {
    if (dt > 0) this.stepFlora(dt);
  }

  override dispose(): void {
    delete (window as unknown as { sturdyVolleyFlora?: unknown }).sturdyVolleyFlora;
    super.dispose();
  }

  private nextPhase(): number {
    this.seed += 1;
    const x = Math.sin(this.seed * 12.9898) * 43758.5453;
    return (x - Math.floor(x)) * Math.PI * 2;
  }

  private buildFlora(scene: Scene): void {
    // Grass field — many instances, spread in depth so tiers + the ceiling fire.
    let gi = 0;
    for (let zx = 0; zx < 12; zx++) {
      for (let zz = 0; zz < 12; zz++) {
        const x = -10 + zx * 2.0;
        const z = zz * 3.4;
        this.spawn(scene, `grass-${gi++}`, 'grass', { x, z }, { w: 0.12, h: 0.9, d: 0.12 }, PALETTE.grassAlt, 0.45);
      }
    }
    // Crop row (carries deterministic growth the motion must not touch).
    for (let i = 0; i < 12; i++) {
      const inst = this.spawn(scene, `crop-${i}`, 'crop', { x: 10 + (i % 3) * 1.2, z: Math.floor(i / 3) * 1.4 }, { w: 0.3, h: 1.0, d: 0.3 }, PALETTE.warmLight, 0.35);
      inst.growth = 3; // fixed; sway never changes it
    }
    for (let i = 0; i < 6; i++) this.spawn(scene, `shrub-${i}`, 'shrub', { x: -16 + i * 2, z: 6 }, { w: 0.8, h: 0.9, d: 0.8 }, PALETTE.grass, 0.25);
    for (let i = 0; i < 10; i++) this.spawn(scene, `flower-${i}`, 'flower', { x: -6 + i * 1.1, z: -2 }, { w: 0.18, h: 0.6, d: 0.18 }, PALETTE.accent, 0.4);
    for (let i = 0; i < 2; i++) this.spawn(scene, `tree-${i}`, 'tree', { x: 16 + i * 8, z: 18 }, { w: 1.6, h: 4.5, d: 1.6 }, PALETTE.roof, 0.18);
    for (let i = 0; i < 10; i++) this.spawn(scene, `reed-${i}`, 'reed', { x: -26 + i * 0.9, z: 20 }, { w: 0.1, h: 1.6, d: 0.1 }, PALETTE.marsh, 0.3);
    for (let i = 0; i < 8; i++) this.spawn(scene, `kelp-${i}`, 'kelp', { x: -28 + i * 1.3, z: 28 }, { w: 0.14, h: 1.4, d: 0.14 }, PALETTE.sea, 0.3);
    for (let i = 0; i < 2; i++) this.spawn(scene, `hanging-${i}`, 'hanging', { x: 2 + i * 3, z: -5 }, { w: 1.2, h: 1.0, d: 0.1 }, PALETTE.warmLight, 0.3);
    for (let i = 0; i < 6; i++) this.spawn(scene, `foam-${i}`, 'foam', { x: -30 + i * 1.5, z: 33 }, { w: 1.0, h: 0.15, d: 0.6 }, PALETTE.stone, 0.4);
  }

  private spawn(scene: Scene, id: string, familyId: FloraFamilyId, base: { x: number; z: number }, dims: { w: number; h: number; d: number }, color = PALETTE.grassAlt, emissive = 0.3): FloraInstance {
    const family = floraFamily(familyId);
    const mesh = MeshBuilder.CreateBox(`flora-${id}`, { width: dims.w, height: dims.h, depth: dims.d }, scene);
    // Pivot at the base so the bend reads as a lean from the ground.
    mesh.setPivotPoint(new Vector3(0, -dims.h / 2, 0));
    mesh.position.set(base.x, dims.h / 2, base.z);
    mesh.material = flatMaterial(scene, `flora-${id}`, color, emissive);
    mesh.isPickable = false;
    const inst: FloraInstance = { id, familyId, family, mesh, phase: this.nextPhase(), base, appliedAngle: 0 };
    this.instances.push(inst);
    return inst;
  }

  private stepFlora(dt: number): void {
    this.time += dt;
    // Distance-tier the whole field each frame (enforces the active ceiling).
    const refs: FloraInstanceRef[] = this.instances.map((i) => ({
      id: i.id,
      distance: Math.hypot(i.base.x - this.playerPos.x, i.base.z - this.playerPos.z),
      family: i.family,
    }));
    this.tiers = assignFloraTiers(refs, DEFAULT_FLORA_PERF);

    const wind = DEFAULT_WIND;
    for (const inst of this.instances) {
      const tier = this.tiers.get(inst.id) ?? 'billboard';
      let angle = 0;
      if (tier === 'full') {
        angle = swayAngle(inst.family, inst.phase, this.time, wind, this.reducedMotion);
      } else if (tier === 'reduced' && !this.reducedMotion) {
        // Cheaper LOD: primary sway only, no secondary flutter.
        angle = Math.sin(this.time * 1.2 + inst.phase) * inst.family.swayAmplitude * 0.4 * windStrength(this.time, wind);
      }
      // Interaction cue is preserved even under reduced motion / lower tiers.
      const d = Math.hypot(inst.base.x - this.playerPos.x, inst.base.z - this.playerPos.z);
      angle += interactionBend(inst.family, d, INTERACT_RADIUS);
      inst.appliedAngle = angle;
      inst.mesh.rotation.z = angle;
      // The motion layer is read-only: `growth` is never written here.
    }
  }

  private installDebugApi(): void {
    const tierCounts = (): { full: number; reduced: number; billboard: number } => {
      const c = { full: 0, reduced: 0, billboard: 0 };
      for (const t of this.tiers.values()) c[t]++;
      return c;
    };
    const api = {
      meshCount: (): number => this.scene.meshes.length,
      families: (): string[] => Object.keys(FLORA_FAMILIES),
      instanceCount: (): number => this.instances.length,
      windNow: (): number => windStrength(this.time, DEFAULT_WIND),
      tierCounts,
      activeDeforming: (): number => activeDeformingCount(this.tiers),
      activeCap: (): number => DEFAULT_FLORA_PERF.activeCap,
      /** Applied bend angles for a family (proves animation + anti-lockstep). */
      anglesFor: (familyId: string): number[] =>
        this.instances.filter((i) => i.familyId === familyId).map((i) => i.appliedAngle),
      maxAbsAngleAmbient: (): number => {
        // Max |angle| among instances with no mover in reach (pure ambient sway).
        let m = 0;
        for (const inst of this.instances) {
          const d = Math.hypot(inst.base.x - this.playerPos.x, inst.base.z - this.playerPos.z);
          if (d > INTERACT_RADIUS) m = Math.max(m, Math.abs(inst.appliedAngle));
        }
        return m;
      },
      /** Bend on the nearest interactive instance to the player (interaction proof). */
      nearestInteractiveBend: (): number => {
        let best = 0;
        let bestD = Infinity;
        for (const inst of this.instances) {
          if (inst.family.interaction === 'none') continue;
          const d = Math.hypot(inst.base.x - this.playerPos.x, inst.base.z - this.playerPos.z);
          if (d < bestD) {
            bestD = d;
            best = interactionBend(inst.family, d, INTERACT_RADIUS);
          }
        }
        return best;
      },
      cropGrowthSum: (): number => this.instances.reduce((s, i) => s + (i.growth ?? 0), 0),
      setPlayer: (x: number, z: number): void => {
        this.playerPos.set(x, PLAYER_HEIGHT / 2, z);
        this.playerMesh.position.copyFrom(this.playerPos);
      },
      setReducedMotion: (on: boolean): void => {
        this.reducedMotion = on;
      },
      tick: (n = 1): void => {
        for (let i = 0; i < n; i++) this.stepFlora(FIXED_DT);
      },
    };
    (window as unknown as { sturdyVolleyFlora?: typeof api }).sturdyVolleyFlora = api;
  }
}
