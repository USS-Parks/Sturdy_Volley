import {
  Scene,
  MeshBuilder,
  Vector3,
  type Mesh,
} from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, addThreeQuarterCamera, PALETTE } from '../render/scene-helpers';
import {
  createMotorState,
  stepMotor,
  NO_WALL,
  NO_CEILING,
  NO_GROUND,
  type MotorEnvironment,
  type MotorState,
} from '../engine/motor';
import {
  setNavGoal,
  navDesiredDir,
  navAdvance,
  navActive,
  patchAt,
  clampToPatch,
  type NavMesh,
  type NavAgentState,
  type NavPoint,
} from '../engine/navigation';
import { steerAvoid, DEFAULT_AVOID_CONFIG, type Obstacle } from '../engine/nav-avoidance';
import {
  familyForAnimalKind,
  familyForPetKind,
  familyOf,
  gaitSpeed,
  familyCanEnterWater,
  type AnimalFamily,
} from '../engine/animal-families';
import { createPet, petPet, tickPetFollow, type PetState } from '../engine/pets';
import { createAnimal, petAnimal, heartsOf, type AnimalInstance } from '../engine/animals';

/**
 * Animal family proving ground (WEF-08a, master Prompt 042).
 *
 * Migrates the existing pet (Bay Dog) + farm animals (Bluff Goats, Mooncalf
 * Hens) onto the shared foundation: each is mapped to a movement **family**
 * (`animal-families.ts`) and driven by navigation + the shared motor + local
 * avoidance, parameterised by its family's gait/body/capability. Their husbandry
 * data (`pets.ts` follow/affection, `animals.ts` affection/feeding) is reused
 * untouched — the pet still picks its follow target via `tickPetFollow`; petting
 * still raises affection via `petPet`/`petAnimal`.
 *
 * Proves the WEF-08a contract: families differ (scale/gait/body); animals respect
 * fences (patch bounds), gates + doors (nav links), cliffs (patch edge), water
 * (family `waterCapable` keeps them out of the pond), and recovery bounds;
 * player/animal + animal/animal contacts stay soft (avoidance); husbandry intact.
 *
 * Reachable via the Title "Dev · Fauna Lab" item or `?scene=FaunaLab`.
 */

const FIXED_DT = 1 / 30;
const PLAYER_HEIGHT = 1.8;

/** Fenced pasture + yard + coop; a pond patch the animals must stay out of. */
const NAV_MESH: NavMesh = {
  patches: [
    { id: 'pasture', minX: -16, maxX: -2, minZ: -10, maxZ: 10, area: 'pasture' },
    { id: 'yard', minX: -2, maxX: 16, minZ: -10, maxZ: 10, area: 'yard' },
    { id: 'coop', minX: 4, maxX: 12, minZ: 10, maxZ: 18, area: 'coop' },
  ],
  links: [
    { id: 'gate', from: 'pasture', to: 'yard', kind: 'door', at: { x: -2, z: 0 }, toAt: { x: -1.5, z: 0 } },
    { id: 'coop-door', from: 'yard', to: 'coop', kind: 'door', at: { x: 8, z: 10 }, toAt: { x: 8, z: 11 } },
  ],
};

/** The pond is a hazard patch animals must never enter (water gating). */
const POND = { minX: 2, maxX: 10, minZ: -18, maxZ: -10 };

interface FaunaAgent {
  id: string;
  label: string;
  family: AnimalFamily;
  behavior: 'follow' | 'graze';
  homePatchId: string;
  mesh: Mesh;
  motor: MotorState;
  nav: NavAgentState;
  target: NavPoint;
  seed: number;
  enteredPond: boolean;
  leftHome: boolean;
}

export class FaunaLabScene extends GameScene {
  private readonly agents: FaunaAgent[] = [];
  private petState!: PetState;
  private readonly livestock = new Map<string, AnimalInstance>();
  private playerPos = new Vector3(8, PLAYER_HEIGHT / 2, 0);
  private playerMesh!: Mesh;
  private playerMoving = false;
  private seed = 1;

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    this.scene = scene;
    addFog(scene, PALETTE.fog, 0.01);
    addLights(scene);
    addThreeQuarterCamera(scene, new Vector3(0, 0, 2), 40);

    this.buildGeometry(scene);

    const player = MeshBuilder.CreateCapsule('fauna-player', { height: PLAYER_HEIGHT, radius: 0.4 }, scene);
    player.material = flatMaterial(scene, 'fauna-player', PALETTE.player, 0.35);
    player.position.copyFrom(this.playerPos);
    this.playerMesh = player;

    this.buildAnimals(scene);
    return scene;
  }

  override enter(): void {
    this.installDebugApi();
  }

  override update(dt: number): void {
    if (dt > 0) this.stepAnimals(dt);
  }

  override dispose(): void {
    delete (window as unknown as { sturdyVolleyFauna?: unknown }).sturdyVolleyFauna;
    super.dispose();
  }

  private buildGeometry(scene: Scene): void {
    const ground = MeshBuilder.CreateGround('fauna-ground', { width: 80, height: 80 }, scene);
    ground.material = flatMaterial(scene, 'fauna-ground', PALETTE.grass, 0.2);
    ground.isPickable = false;

    // Fences around the pasture (visual; the patch bound is the logical fence).
    const fence = (name: string, w: number, d: number, x: number, z: number): void => {
      const m = MeshBuilder.CreateBox(name, { width: w, height: 1.1, depth: d }, scene);
      m.position.set(x, 0.55, z);
      m.material = flatMaterial(scene, name, PALETTE.wood, 0.2);
    };
    fence('fence-w', 0.2, 20, -16, 0);
    fence('fence-n', 14, 0.2, -9, 10);
    fence('fence-s', 14, 0.2, -9, -10);

    // Cliff edge along the pasture's west fence (a 4 m drop beyond).
    const cliff = MeshBuilder.CreateBox('fauna-cliff', { width: 4, height: 4, depth: 20 }, scene);
    cliff.position.set(-19, -2, 0);
    cliff.material = flatMaterial(scene, 'fauna-cliff', PALETTE.cliff, 0.16);

    // Coop shell with a door.
    const coop = MeshBuilder.CreateBox('fauna-coop', { width: 8, height: 2.6, depth: 8 }, scene);
    coop.position.set(8, 1.3, 14);
    coop.material = flatMaterial(scene, 'fauna-coop', PALETTE.roof, 0.2);

    // Pond (water hazard the animals avoid).
    const pond = MeshBuilder.CreateGround('fauna-pond', { width: POND.maxX - POND.minX, height: POND.maxZ - POND.minZ }, scene);
    pond.position.set((POND.minX + POND.maxX) / 2, 0.02, (POND.minZ + POND.maxZ) / 2);
    const pondMat = flatMaterial(scene, 'fauna-pond', PALETTE.sea, 0.4);
    pondMat.alpha = 0.7;
    pond.material = pondMat;
    pond.isPickable = false;
  }

  private buildAnimals(scene: Scene): void {
    this.petState = createPet({ kind: 'bay-dog', name: 'Bay Dog', x: 6, z: 2 });
    this.spawn(scene, 'dog', 'Bay Dog', familyOf(familyForPetKind('bay-dog')), 'follow', 'yard', { x: 6, z: 2 }, PALETTE.wood);

    for (const [i, start] of [{ x: -10, z: 4 }, { x: -6, z: -4 }].entries()) {
      const id = `goat-${i}`;
      this.livestock.set(id, createAnimal({ id, kind: 'bluff-goat', name: `Bluff Goat ${i}` }));
      this.spawn(scene, id, `Bluff Goat ${i}`, familyOf(familyForAnimalKind('bluff-goat')), 'graze', 'pasture', start, PALETTE.stone);
    }
    for (const [i, start] of [{ x: 4, z: 4 }, { x: 10, z: -4 }].entries()) {
      const id = `hen-${i}`;
      this.livestock.set(id, createAnimal({ id, kind: 'mooncalf-hen', name: `Mooncalf Hen ${i}` }));
      this.spawn(scene, id, `Mooncalf Hen ${i}`, familyOf(familyForAnimalKind('mooncalf-hen')), 'graze', 'yard', start, PALETTE.warmLight);
    }
  }

  private spawn(scene: Scene, id: string, label: string, family: AnimalFamily, behavior: 'follow' | 'graze', home: string, start: NavPoint, color = PALETTE.accent): void {
    const r = family.bodyProxyRadius;
    const body = MeshBuilder.CreateCapsule(`fauna-${id}`, { height: family.bodyProxyHeight, radius: r }, scene);
    body.position.set(start.x, family.bodyProxyHeight / 2, start.z);
    body.material = flatMaterial(scene, `fauna-${id}`, color, 0.3);
    this.agents.push({
      id,
      label,
      family,
      behavior,
      homePatchId: home,
      mesh: body,
      motor: createMotorState({ x: start.x, y: family.bodyProxyHeight / 2, z: start.z }),
      nav: setNavGoal(NAV_MESH, start, start),
      target: { ...start },
      seed: this.seed++,
      enteredPond: false,
      leftHome: false,
    });
  }

  private stepAnimals(dt: number): void {
    for (const a of this.agents) {
      this.pickTarget(a, dt);
      this.moveAgent(a, dt);
      // Hazard tracking for the proving-ground assertions.
      const p = { x: a.motor.position.x, z: a.motor.position.z };
      if (p.x >= POND.minX && p.x <= POND.maxX && p.z >= POND.minZ && p.z <= POND.maxZ) a.enteredPond = true;
      const patch = patchAt(NAV_MESH, p);
      if (a.behavior === 'graze' && patch && patch.id !== a.homePatchId && !(a.homePatchId === 'yard' && patch.id === 'coop')) {
        a.leftHome = true;
      }
    }
  }

  /** Behaviour: the pet follows the player (reusing pets.ts); livestock graze. */
  private pickTarget(a: FaunaAgent, dt: number): void {
    if (navActive(a.nav)) return; // still travelling to the current target
    if (a.behavior === 'follow') {
      // Sync the preserved pet state to the live pose, then let pets.ts choose
      // the follow/idle target — locomotion is the family framework's job.
      this.petState = { ...this.petState, x: a.motor.position.x, z: a.motor.position.z };
      const r = tickPetFollow({
        pet: this.petState,
        playerX: this.playerPos.x,
        playerZ: this.playerPos.z,
        playerMoving: this.playerMoving,
        doors: [{ x: 8, z: 10, radius: 1.2 }],
        dt,
        seed: this.seed++,
      });
      this.petState = r.pet;
      a.target = this.clampReachable({ x: this.petState.targetX, z: this.petState.targetZ });
    } else {
      // Graze: wander to a fresh point inside the home patch.
      const home = NAV_MESH.patches.find((p) => p.id === a.homePatchId)!;
      a.seed += 1;
      const rx = pseudo(a.seed) * (home.maxX - home.minX) + home.minX;
      const rz = pseudo(a.seed + 31) * (home.maxZ - home.minZ) + home.minZ;
      a.target = { x: rx, z: rz };
    }
    a.nav = setNavGoal(NAV_MESH, { x: a.motor.position.x, z: a.motor.position.z }, a.target);
  }

  /** Keep a follow target on a patch the pet can actually reach (not the pond). */
  private clampReachable(pt: NavPoint): NavPoint {
    if (patchAt(NAV_MESH, pt)) return pt;
    // Snap to the nearest patch the family can traverse.
    let best = pt;
    let bestD = Infinity;
    for (const p of NAV_MESH.patches) {
      const c = clampToPatch(p, pt);
      const d = Math.hypot(c.x - pt.x, c.z - pt.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  private moveAgent(a: FaunaAgent, dt: number): void {
    const pos = { x: a.motor.position.x, z: a.motor.position.z };
    const dir = navDesiredDir(a.nav, pos);

    // Family gait: pet trots while following; livestock graze-walk.
    const gait = a.behavior === 'follow' ? (this.playerMoving ? 'trot' : 'walk') : 'graze';
    const speed = gaitSpeed(a.family, gait);

    // Soft contacts: avoid the player + other animals, sized by body proxy.
    const obstacles: Obstacle[] = [{ x: this.playerPos.x, z: this.playerPos.z, radius: 0.4, isPlayer: true }];
    for (const o of this.agents) {
      if (o.id === a.id) continue;
      if (Math.hypot(o.motor.position.x - pos.x, o.motor.position.z - pos.z) < 3) {
        obstacles.push({ x: o.motor.position.x, z: o.motor.position.z, radius: o.family.bodyProxyRadius });
      }
    }
    const cfg = { ...DEFAULT_AVOID_CONFIG, radius: a.family.bodyProxyRadius + 0.3, maxSpeed: speed };
    const vel = steerAvoid(pos, dir, speed, obstacles, cfg);
    const sp = Math.hypot(vel.x, vel.z);
    const moveDir = sp > 1e-4 ? { x: vel.x / sp, z: vel.z / sp } : { x: 0, z: 0 };

    const env: MotorEnvironment = {
      ground: { hit: true, groundY: 0, normal: { x: 0, y: 1, z: 0 } },
      wall: NO_WALL,
      stepGround: NO_GROUND,
      ceiling: NO_CEILING,
    };
    a.motor = stepMotor(a.motor, { moveDir, speed: sp }, env, dt);

    // Recovery bounds: never leave the navmesh (fence/cliff = patch edge), and
    // never enter water the family can't (the pond is off the navmesh anyway).
    const patch = patchAt(NAV_MESH, { x: a.motor.position.x, z: a.motor.position.z });
    if (!patch || (!familyCanEnterWater(a.family) && this.inPond(a.motor.position.x, a.motor.position.z))) {
      const snap = this.clampReachable({ x: a.motor.position.x, z: a.motor.position.z });
      a.motor.position.x = snap.x;
      a.motor.position.z = snap.z;
    }

    a.nav = navAdvance(a.nav, { x: a.motor.position.x, z: a.motor.position.z }).agent;
    a.mesh.position.set(a.motor.position.x, a.family.bodyProxyHeight / 2, a.motor.position.z);
    a.mesh.rotation.y = a.motor.facing;
  }

  private inPond(x: number, z: number): boolean {
    return x >= POND.minX && x <= POND.maxX && z >= POND.minZ && z <= POND.maxZ;
  }

  private installDebugApi(): void {
    const api = {
      meshCount: (): number => this.scene.meshes.length,
      animals: (): Array<{ id: string; family: string; behavior: string; pos: { x: number; z: number }; enteredPond: boolean; leftHome: boolean; bodyRadius: number; scale: number }> =>
        this.agents.map((a) => ({
          id: a.id,
          family: a.family.id,
          behavior: a.behavior,
          pos: { x: a.motor.position.x, z: a.motor.position.z },
          enteredPond: a.enteredPond,
          leftHome: a.leftHome,
          bodyRadius: a.family.bodyProxyRadius,
          scale: a.family.scale,
        })),
      player: (): { x: number; z: number } => ({ x: this.playerPos.x, z: this.playerPos.z }),
      setPlayer: (x: number, z: number): void => {
        this.playerMoving = Math.hypot(x - this.playerPos.x, z - this.playerPos.z) > 0.01;
        this.playerPos.set(x, PLAYER_HEIGHT / 2, z);
        this.playerMesh.position.copyFrom(this.playerPos);
      },
      setPlayerMoving: (m: boolean): void => {
        this.playerMoving = m;
      },
      tick: (n = 1): void => {
        for (let i = 0; i < n; i++) this.stepAnimals(FIXED_DT);
      },
      /** Closest gap between the player and any animal (soft-contact proof). */
      minPlayerGap: (): number => {
        let min = Infinity;
        for (const a of this.agents) min = Math.min(min, Math.hypot(a.motor.position.x - this.playerPos.x, a.motor.position.z - this.playerPos.z));
        return min === Infinity ? 99 : min;
      },
      minAnimalGap: (): number => {
        let min = Infinity;
        for (let i = 0; i < this.agents.length; i++) {
          for (let j = i + 1; j < this.agents.length; j++) {
            min = Math.min(min, Math.hypot(this.agents[i].motor.position.x - this.agents[j].motor.position.x, this.agents[i].motor.position.z - this.agents[j].motor.position.z));
          }
        }
        return min === Infinity ? 99 : min;
      },
      distToPlayer: (id: string): number => {
        const a = this.agents.find((n) => n.id === id);
        return a ? Math.hypot(a.motor.position.x - this.playerPos.x, a.motor.position.z - this.playerPos.z) : 99;
      },
      // --- Husbandry preserved through the migration -------------------------
      petDog: (): number => {
        this.petState = petPet(this.petState);
        return this.petState.affection;
      },
      petLivestock: (id: string): number => {
        const animal = this.livestock.get(id);
        if (!animal) return -1;
        const next = petAnimal(animal);
        this.livestock.set(id, next);
        return heartsOf(next);
      },
      affection: (id: string): number => (id === 'dog' ? this.petState.affection : heartsOf(this.livestock.get(id)!)),
    };
    (window as unknown as { sturdyVolleyFauna?: typeof api }).sturdyVolleyFauna = api;
  }
}

function pseudo(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
