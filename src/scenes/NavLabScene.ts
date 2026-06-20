import {
  Scene,
  MeshBuilder,
  Vector3,
  Color3,
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
import { faceTarget, headingTo } from '../engine/interaction-targeting';
import {
  setNavGoal,
  navDesiredDir,
  navAdvance,
  currentKind,
  navActive,
  patchAt,
  type NavMesh,
  type NavAgentState,
  type NavPoint,
  type NavLinkKind,
} from '../engine/navigation';

/**
 * NPC navigation proving ground (WEF-07a, master Prompt 040).
 *
 * Bakes a navmesh over an exterior yard + a building (doorway → interior) + an
 * interior loft (stair) + a slope-reached overlook, then drives the four
 * existing NPCs (Mara, Wren, Bree, Cas) along scheduled goal cycles **through
 * the navigation service on the shared motor** — replacing the straight-line
 * `liveStep` interpolation with real pathfinding across portals + off-mesh links
 * (door / stair / slope). Locomotion is `engine/motor.stepMotor`; navigation
 * only supplies the move direction + the link kind being crossed.
 *
 * Proves the WEF-07a contract: ≥4 NPCs traverse exterior / doorway / interior /
 * stair-slope; schedule transitions re-route through the service (a goal change
 * re-paths); conversation alignment still works (an NPC faces the player when
 * talked to). The `?debug=nav` view renders the navmesh, each NPC's active path,
 * and the next link.
 *
 * Reachable via the Title "Dev · Nav Lab" item or `?scene=NavLab`.
 */

const NPC_SPEED = 2.6; // m/s walk
const FIXED_DT = 1 / 30;
const NPC_RADIUS = 0.4;
const NPC_HEIGHT = 1.8;

/** Display heights per area so stairs/slope read visually (cosmetic; the motor
 *  locomotes on flat ground — the link *kind* is what proves the traversal). */
const AREA_DISPLAY_Y: Record<string, number> = { yard: 0, house: 0, upper: 2, 'ramp-top': 2 };

// Patches share only edges (no area overlap) so `patchAt` is unambiguous — an
// overlap would resolve a point to the first-listed patch and collapse a
// cross-link path to a same-patch walk.
const NAV_MESH: NavMesh = {
  patches: [
    { id: 'yard', minX: -20, maxX: 12, minZ: -20, maxZ: 4, area: 'exterior' },
    { id: 'house', minX: -6, maxX: 6, minZ: 4, maxZ: 16, area: 'interior' },
    { id: 'upper', minX: -6, maxX: 6, minZ: 16, maxZ: 24, area: 'interior' },
    { id: 'ramp-top', minX: 12, maxX: 24, minZ: -20, maxZ: -9, area: 'exterior' },
  ],
  links: [
    { id: 'door', from: 'yard', to: 'house', kind: 'door', at: { x: 0, z: 4 }, toAt: { x: 0, z: 5 } },
    { id: 'stair', from: 'house', to: 'upper', kind: 'stair', at: { x: 0, z: 16 }, toAt: { x: 0, z: 17 } },
    { id: 'slope', from: 'yard', to: 'ramp-top', kind: 'slope', at: { x: 11, z: -8 }, toAt: { x: 14, z: -11 } },
  ],
};

const GOAL: Record<string, NavPoint> = {
  yard: { x: -10, z: -6 },
  house: { x: 0, z: 10 },
  upper: { x: 0, z: 20 },
  ramp: { x: 18, z: -14 },
};

interface NpcAgent {
  id: string;
  name: string;
  mesh: Mesh;
  motor: MotorState;
  nav: NavAgentState;
  goalCycle: NavPoint[];
  goalIndex: number;
  facing: number;
  traversed: Set<NavLinkKind>;
  visited: Set<string>;
  arrivals: number;
}

const NPC_DEFS: Array<{ id: string; name: string; start: NavPoint; cycle: (keyof typeof GOAL)[] }> = [
  { id: 'mara', name: 'Mara', start: { x: -12, z: -4 }, cycle: ['yard', 'house', 'upper', 'house', 'yard'] },
  { id: 'wren', name: 'Wren', start: { x: -8, z: -8 }, cycle: ['yard', 'ramp', 'yard'] },
  { id: 'bree', name: 'Bree', start: { x: 6, z: -6 }, cycle: ['house', 'yard', 'house'] },
  { id: 'cas', name: 'Cas', start: { x: 10, z: -10 }, cycle: ['yard', 'upper', 'yard'] },
];

export class NavLabScene extends GameScene {
  private readonly agents: NpcAgent[] = [];
  private playerPos = new Vector3(-16, NPC_HEIGHT / 2, -16);
  private navDebug: Mesh[] = [];
  private pathDebug: Mesh[] = [];

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    this.scene = scene;
    addFog(scene, PALETTE.fog, 0.01);
    addLights(scene);
    addThreeQuarterCamera(scene, new Vector3(0, 0, 0), 46);

    this.buildGeometry(scene);
    this.buildAgents(scene);
    this.buildNavDebug(scene);

    // A small player marker so conversation alignment has a target.
    const player = MeshBuilder.CreateCapsule('nav-player', { height: NPC_HEIGHT, radius: NPC_RADIUS }, scene);
    player.material = flatMaterial(scene, 'nav-player', PALETTE.player, 0.35);
    player.position.copyFrom(this.playerPos);

    return scene;
  }

  override enter(): void {
    this.installDebugApi();
  }

  override update(dt: number): void {
    if (dt <= 0) return;
    this.stepAgents(dt);
  }

  override dispose(): void {
    delete (window as unknown as { sturdyVolleyNav?: unknown }).sturdyVolleyNav;
    super.dispose();
  }

  // --- Geometry -------------------------------------------------------------
  private buildGeometry(scene: Scene): void {
    const ground = MeshBuilder.CreateGround('nav-ground', { width: 80, height: 80 }, scene);
    ground.material = flatMaterial(scene, 'nav-ground', PALETTE.grass, 0.2);
    ground.isPickable = false;

    // House shell with a doorway gap on the -Z (yard) side.
    const h = 3.2;
    const wall = (name: string, w: number, d: number, x: number, z: number): void => {
      const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
      m.position.set(x, h / 2, z);
      m.material = flatMaterial(scene, name, PALETTE.stone, 0.16);
    };
    wall('nav-house-back', 12, 0.3, 0, 16);
    wall('nav-house-left', 0.3, 12, -6, 10);
    wall('nav-house-right', 0.3, 12, 6, 10);
    wall('nav-house-front-l', 4.4, 0.3, -3.8, 4);
    wall('nav-house-front-r', 4.4, 0.3, 3.8, 4);
    const floor = MeshBuilder.CreateBox('nav-house-floor', { width: 12, height: 0.2, depth: 12 }, scene);
    floor.position.set(0, -0.1, 10);
    floor.material = flatMaterial(scene, 'nav-house-floor', PALETTE.interior, 0.16);

    // Loft platform (upper) at display y=2.
    const loft = MeshBuilder.CreateBox('nav-loft', { width: 12, height: 0.3, depth: 8 }, scene);
    loft.position.set(0, 2, 20);
    loft.material = flatMaterial(scene, 'nav-loft', PALETTE.interior, 0.18);

    // Stairs up to the loft.
    for (let i = 0; i < 8; i++) {
      const step = MeshBuilder.CreateBox(`nav-step-${i}`, { width: 3, height: 0.25 * (i + 1), depth: 0.6 }, scene);
      step.position.set(0, 0.125 * (i + 1), 15.5 + i * 0.6);
      step.material = flatMaterial(scene, `nav-step-${i}`, PALETTE.cliff, 0.16);
    }

    // Slope ramp up to the overlook (ramp-top) at display y=2.
    const ramp = MeshBuilder.CreateBox('nav-ramp', { width: 4, height: 0.3, depth: 8 }, scene);
    ramp.position.set(16, 1, -10);
    ramp.rotation.x = -Math.atan2(2, 8);
    ramp.material = flatMaterial(scene, 'nav-ramp', PALETTE.cliff, 0.16);
    const overlook = MeshBuilder.CreateBox('nav-overlook', { width: 12, height: 0.3, depth: 8 }, scene);
    overlook.position.set(18, 2, -14);
    overlook.material = flatMaterial(scene, 'nav-overlook', PALETTE.sand, 0.2);
  }

  private buildAgents(scene: Scene): void {
    for (const def of NPC_DEFS) {
      const cap = MeshBuilder.CreateCapsule(`nav-npc-${def.id}`, { height: NPC_HEIGHT, radius: NPC_RADIUS }, scene);
      cap.material = flatMaterial(scene, `nav-npc-${def.id}`, PALETTE.accent, 0.3);
      cap.position.set(def.start.x, NPC_HEIGHT / 2, def.start.z);
      const cycle = def.cycle.map((k) => GOAL[k]);
      const agent: NpcAgent = {
        id: def.id,
        name: def.name,
        mesh: cap,
        motor: createMotorState({ x: def.start.x, y: NPC_HEIGHT / 2, z: def.start.z }),
        nav: setNavGoal(NAV_MESH, def.start, cycle[0]),
        goalCycle: cycle,
        goalIndex: 0,
        facing: 0,
        traversed: new Set(),
        visited: new Set(['exterior']),
        arrivals: 0,
      };
      this.agents.push(agent);
    }
  }

  // --- Per-frame NPC nav + motor -------------------------------------------
  private stepAgents(dt: number): void {
    for (const a of this.agents) {
      const flat = { x: a.motor.position.x, z: a.motor.position.z };
      const dir = navDesiredDir(a.nav, flat);

      // Shared motor: flat ground (locomotion); navigation supplies the heading.
      const env: MotorEnvironment = {
        ground: { hit: true, groundY: 0, normal: { x: 0, y: 1, z: 0 } },
        wall: NO_WALL,
        stepGround: NO_GROUND,
        ceiling: NO_CEILING,
      };
      const speed = dir.x === 0 && dir.z === 0 ? 0 : NPC_SPEED;
      a.motor = stepMotor(a.motor, { moveDir: dir, speed }, env, dt);

      // Record the link kind being crossed + the area visited.
      const kind = currentKind(a.nav);
      if (kind && kind !== 'walk' && kind !== 'portal') a.traversed.add(kind);
      const patch = patchAt(NAV_MESH, { x: a.motor.position.x, z: a.motor.position.z });
      if (patch?.area) a.visited.add(patch.area);

      // Advance the path; on full arrival, pick the next scheduled goal (a
      // schedule transition that re-routes through the service).
      const adv = navAdvance(a.nav, { x: a.motor.position.x, z: a.motor.position.z });
      a.nav = adv.agent;
      if (adv.arrived && !navActive(a.nav)) {
        a.arrivals++;
        a.goalIndex = (a.goalIndex + 1) % a.goalCycle.length;
        a.nav = setNavGoal(NAV_MESH, { x: a.motor.position.x, z: a.motor.position.z }, a.goalCycle[a.goalIndex]);
      }

      // Cosmetic elevation: lerp the mesh Y toward the current patch's display height.
      const targetY = NPC_HEIGHT / 2 + (patch ? AREA_DISPLAY_Y[patch.id] ?? 0 : 0);
      const y = a.mesh.position.y + (targetY - a.mesh.position.y) * Math.min(1, dt * 4);
      a.mesh.position.set(a.motor.position.x, y, a.motor.position.z);
      if (a.motor.facing !== undefined) {
        a.facing = a.motor.facing;
        a.mesh.rotation.y = a.facing;
      }
    }
    this.refreshPathDebug();
  }

  // --- Conversation alignment ----------------------------------------------
  /** Face an NPC toward the player; returns whether it became aligned. */
  private talk(npcId: string): { available: boolean; facingAligned: boolean } {
    const a = this.agents.find((n) => n.id === npcId);
    if (!a) return { available: false, facingAligned: false };
    const desired = headingTo({ x: a.motor.position.x, y: 0, z: a.motor.position.z }, { x: this.playerPos.x, y: 0, z: this.playerPos.z });
    // Turn fully toward the player (large dt so it snaps for the check).
    a.facing = faceTarget(a.facing, desired, 12, 1);
    a.motor.facing = a.facing;
    a.mesh.rotation.y = a.facing;
    const err = Math.abs(normalizeAngle(a.facing - desired));
    return { available: true, facingAligned: err < 0.2 };
  }

  // --- Nav debug view (?debug=nav) -----------------------------------------
  private buildNavDebug(scene: Scene): void {
    if (new URLSearchParams(location.search).get('debug') !== 'nav') return;
    for (const p of NAV_MESH.patches) {
      const quad = MeshBuilder.CreateGround(`navdbg-${p.id}`, { width: p.maxX - p.minX, height: p.maxZ - p.minZ }, scene);
      quad.position.set((p.minX + p.maxX) / 2, 0.05 + (AREA_DISPLAY_Y[p.id] ?? 0), (p.minZ + p.maxZ) / 2);
      const mat = flatMaterial(scene, `navdbg-${p.id}`, p.area === 'interior' ? PALETTE.warmLight : PALETTE.accent, 0.5);
      mat.alpha = 0.3;
      quad.material = mat;
      quad.isPickable = false;
      this.navDebug.push(quad);
    }
    for (const l of NAV_MESH.links) {
      const marker = MeshBuilder.CreateCylinder(`navdbg-link-${l.id}`, { height: 0.4, diameter: 0.8, tessellation: 6 }, scene);
      marker.position.set(l.at.x, 0.2, l.at.z);
      marker.material = flatMaterial(scene, `navdbg-link-${l.id}`, l.kind === 'door' ? PALETTE.roof : PALETTE.sea, 0.5);
      marker.isPickable = false;
      this.navDebug.push(marker);
    }
  }

  private refreshPathDebug(): void {
    if (this.navDebug.length === 0) return; // debug off
    for (const m of this.pathDebug) m.dispose();
    this.pathDebug = [];
    for (const a of this.agents) {
      if (!a.nav.path) continue;
      a.nav.path.waypoints.forEach((wp, i) => {
        if (i < a.nav.index) return;
        const dot = MeshBuilder.CreateSphere(`pathdbg-${a.id}-${i}`, { diameter: 0.3, segments: 4 }, this.scene);
        dot.position.set(wp.point.x, 0.3, wp.point.z);
        const c = wp.kind === 'walk' ? PALETTE.warmLight : new Color3(1, 0.5, 0.2);
        dot.material = flatMaterial(this.scene, `pathdbg-${a.id}-${i}`, c, 0.6);
        dot.isPickable = false;
        this.pathDebug.push(dot);
      });
    }
  }

  // --- Debug API ------------------------------------------------------------
  private installDebugApi(): void {
    const api = {
      meshCount: (): number => this.scene.meshes.length,
      navPatches: (): string[] => NAV_MESH.patches.map((p) => p.id),
      navLinks: (): Array<{ id: string; kind: string }> => NAV_MESH.links.map((l) => ({ id: l.id, kind: l.kind })),
      npcs: (): Array<{ id: string; area: string | null; currentKind: string | null; traversed: string[]; visited: string[]; arrivals: number; pathLen: number }> =>
        this.agents.map((a) => ({
          id: a.id,
          area: patchAt(NAV_MESH, { x: a.motor.position.x, z: a.motor.position.z })?.area ?? null,
          currentKind: currentKind(a.nav),
          traversed: [...a.traversed],
          visited: [...a.visited],
          arrivals: a.arrivals,
          pathLen: a.nav.path?.waypoints.length ?? 0,
        })),
      /** Advance `n` deterministic fixed-dt frames (e2e driver). */
      tick: (n = 1): void => {
        for (let i = 0; i < n; i++) this.stepAgents(FIXED_DT);
      },
      talk: (npcId: string): { available: boolean; facingAligned: boolean } => this.talk(npcId),
      /** Aggregate set of link kinds any NPC has traversed. */
      traversedKinds: (): string[] => {
        const s = new Set<string>();
        for (const a of this.agents) for (const k of a.traversed) s.add(k);
        return [...s];
      },
    };
    (window as unknown as { sturdyVolleyNav?: typeof api }).sturdyVolleyNav = api;
  }
}

function normalizeAngle(a: number): number {
  let x = a;
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x < -Math.PI) x += 2 * Math.PI;
  return x;
}
