/**
 * The narrow physics port the kinematic motor depends on (WEF-02a, Prompt 031).
 * The motor core (`src/engine/motor.ts`) is pure and consumes a `GroundHit`; this
 * adapter is the only thing that touches Babylon/Havok to produce one. Two
 * backends implement the same port so the motor behaves identically:
 *
 *  - `HavokMotorPhysics` — casts a ray straight down through the Havok physics
 *    world (static colliders added to the ground + standable kit meshes). The
 *    primary backend when Havok's WASM loaded.
 *  - `RaypickMotorPhysics` — `scene.pickWithRay` against pickable meshes. The
 *    fallback when Havok is unavailable; also the default in environments that
 *    cannot instantiate the WASM.
 *
 * Both answer one question for 031: "what ground is beneath the capsule?" The
 * shape-sweep collide-and-slide for walls/slopes/steps is Prompt 032.
 */
import {
  Ray,
  Vector3,
  type AbstractMesh,
  type Scene,
} from '@babylonjs/core';
import type { GroundHit } from '../engine/motor';

export type PhysicsBackend = 'havok' | 'raypick';

export interface MotorPhysics {
  readonly backend: PhysicsBackend;
  /**
   * Probe the ground beneath a capsule centred at (x, fromY, z). Casts down
   * `maxDist` metres from `fromY`.
   */
  groundProbe(x: number, fromY: number, z: number, maxDist: number): GroundHit;
  dispose(): void;
}

const NO_GROUND: GroundHit = { hit: false, groundY: 0, normalY: 1 };

/** Havok-backed downward raycast against the physics world. */
export class HavokMotorPhysics implements MotorPhysics {
  readonly backend = 'havok' as const;
  constructor(private readonly scene: Scene) {}

  groundProbe(x: number, fromY: number, z: number, maxDist: number): GroundHit {
    const engine = this.scene.getPhysicsEngine();
    if (!engine) return NO_GROUND;
    const from = new Vector3(x, fromY, z);
    const to = new Vector3(x, fromY - maxDist, z);
    const res = engine.raycast(from, to);
    if (!res.hasHit) return NO_GROUND;
    return { hit: true, groundY: res.hitPointWorld.y, normalY: res.hitNormalWorld.y };
  }

  dispose(): void {
    /* the scene owns the physics engine + bodies */
  }
}

/** Ray-pick fallback against pickable meshes (no physics engine required). */
export class RaypickMotorPhysics implements MotorPhysics {
  readonly backend = 'raypick' as const;
  private readonly down = new Vector3(0, -1, 0);
  constructor(
    private readonly scene: Scene,
    private readonly ignore: () => readonly AbstractMesh[],
  ) {}

  groundProbe(x: number, fromY: number, z: number, maxDist: number): GroundHit {
    const skip = new Set(this.ignore());
    const ray = new Ray(new Vector3(x, fromY, z), this.down, maxDist);
    const pick = this.scene.pickWithRay(ray, (m) => m.isPickable && m.isVisible && !skip.has(m));
    if (!pick?.hit || !pick.pickedPoint) return NO_GROUND;
    const normal = pick.getNormal(true);
    return { hit: true, groundY: pick.pickedPoint.y, normalY: normal ? normal.y : 1 };
  }

  dispose(): void {
    /* nothing owned */
  }
}
