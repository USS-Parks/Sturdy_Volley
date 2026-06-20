/**
 * The narrow physics port the kinematic motor depends on (WEF-02a/02b, Prompts
 * 031–032). The motor core (`src/engine/motor.ts`) is pure and consumes a
 * `MotorEnvironment`; this adapter is the only thing that touches Babylon/Havok
 * to produce one. Two backends implement the same port so the motor behaves
 * identically:
 *
 *  - `HavokMotorPhysics` — casts rays through the Havok physics world (static
 *    colliders on the ground + standable kit meshes). Primary when Havok loaded.
 *  - `RaypickMotorPhysics` — `scene.pickWithRay` against pickable meshes. The
 *    fallback when Havok is unavailable.
 *
 * The port exposes a single general `raycast`; the scene assembles the ground /
 * wall / step / ceiling probes from it (031 used a downward `groundProbe`, kept
 * here as a convenience over `raycast`).
 */
import {
  Ray,
  Vector3,
  type AbstractMesh,
  type Scene,
} from '@babylonjs/core';
import type { GroundHit, Vec3 } from '../engine/motor';

export type PhysicsBackend = 'havok' | 'raypick';

export interface RayHit {
  hit: boolean;
  /** Distance from `from` to the hit along `dir` (m). */
  distance: number;
  point: Vec3;
  normal: Vec3;
}

const NO_RAY: RayHit = { hit: false, distance: Number.POSITIVE_INFINITY, point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 } };
const NO_GROUND_HIT: GroundHit = { hit: false, groundY: 0, normal: { x: 0, y: 1, z: 0 } };

export interface MotorPhysics {
  readonly backend: PhysicsBackend;
  /** General ray cast. `dir` need not be normalised; it is normalised here. */
  raycast(from: Vec3, dir: Vec3, maxDist: number): RayHit;
  /** Convenience: probe the ground beneath a capsule centred at (x, fromY, z). */
  groundProbe(x: number, fromY: number, z: number, maxDist: number): GroundHit;
  dispose(): void;
}

function down(): Vec3 {
  return { x: 0, y: -1, z: 0 };
}

function groundFromRay(r: RayHit): GroundHit {
  if (!r.hit) return NO_GROUND_HIT;
  return { hit: true, groundY: r.point.y, normal: r.normal };
}

/** Havok-backed raycast against the physics world. */
export class HavokMotorPhysics implements MotorPhysics {
  readonly backend = 'havok' as const;
  constructor(private readonly scene: Scene) {}

  raycast(from: Vec3, dir: Vec3, maxDist: number): RayHit {
    const engine = this.scene.getPhysicsEngine();
    if (!engine) return NO_RAY;
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const f = new Vector3(from.x, from.y, from.z);
    const to = new Vector3(
      from.x + (dir.x / len) * maxDist,
      from.y + (dir.y / len) * maxDist,
      from.z + (dir.z / len) * maxDist,
    );
    const res = engine.raycast(f, to);
    if (!res.hasHit) return NO_RAY;
    const p = res.hitPointWorld;
    const n = res.hitNormalWorld;
    return {
      hit: true,
      distance: Vector3.Distance(f, p),
      point: { x: p.x, y: p.y, z: p.z },
      normal: { x: n.x, y: n.y, z: n.z },
    };
  }

  groundProbe(x: number, fromY: number, z: number, maxDist: number): GroundHit {
    return groundFromRay(this.raycast({ x, y: fromY, z }, down(), maxDist));
  }

  dispose(): void {
    /* the scene owns the physics engine + bodies */
  }
}

/** Ray-pick fallback against pickable meshes (no physics engine required). */
export class RaypickMotorPhysics implements MotorPhysics {
  readonly backend = 'raypick' as const;
  constructor(
    private readonly scene: Scene,
    private readonly ignore: () => readonly AbstractMesh[],
  ) {}

  raycast(from: Vec3, dir: Vec3, maxDist: number): RayHit {
    const skip = new Set(this.ignore());
    const ray = new Ray(new Vector3(from.x, from.y, from.z), new Vector3(dir.x, dir.y, dir.z).normalize(), maxDist);
    const pick = this.scene.pickWithRay(ray, (m) => m.isPickable && m.isVisible && !skip.has(m));
    if (!pick?.hit || !pick.pickedPoint) return NO_RAY;
    const n = pick.getNormal(true);
    const p = pick.pickedPoint;
    return {
      hit: true,
      distance: pick.distance,
      point: { x: p.x, y: p.y, z: p.z },
      normal: n ? { x: n.x, y: n.y, z: n.z } : { x: 0, y: 1, z: 0 },
    };
  }

  groundProbe(x: number, fromY: number, z: number, maxDist: number): GroundHit {
    return groundFromRay(this.raycast({ x, y: fromY, z }, down(), maxDist));
  }

  dispose(): void {
    /* nothing owned */
  }
}
