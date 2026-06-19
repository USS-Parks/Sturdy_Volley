import {
  Scene,
  MeshBuilder,
  Vector3,
  type AbstractMesh,
} from '@babylonjs/core';
import { flatMaterial, PALETTE } from './scene-helpers';
import type { WorldEntity } from '../engine/forage';

/**
 * Representative graybox geometry for Farm world entities (VS-A2). Each entity
 * key in `save.worldEntities` whose scene prefix is `Farm:` gets a fixed
 * anchor position from `FARM_ENTITY_ANCHORS`. The renderer builds primitive
 * meshes (cylinder trees, polyhedron rocks, half-spheres for forage) at the
 * anchor positions; when a real `.glb` lands, swap the factory call without
 * changing FarmScene.
 */
export interface FarmEntityAnchor {
  /** World position (x, z) on the Farm. */
  x: number;
  z: number;
  /** Interaction radius (default 1.4 m). */
  radius?: number;
}

export const FARM_ENTITY_ANCHORS: Record<string, FarmEntityAnchor> = {
  'tree-a': { x: 11, z: 4 },
  'tree-b': { x: -2, z: 9 },
  'debris-a': { x: 5, z: -10 },
  'forage-shell-a': { x: 12, z: -1 },
  'forage-shell-b': { x: -14, z: 6 },
  'forage-drift-a': { x: -10, z: 12 },
};

/** Strip the `Farm:` prefix off a world-entity key. Returns null for non-Farm keys. */
export function farmEntitySuffix(key: string): string | null {
  if (!key.startsWith('Farm:')) return null;
  return key.slice('Farm:'.length);
}

export function anchorFor(suffix: string): FarmEntityAnchor | null {
  return FARM_ENTITY_ANCHORS[suffix] ?? null;
}

/**
 * Build a representative graybox mesh for one entity at its anchor. Trees are
 * tall cylinder trunks with a canopy cone; stumps are short stubs; debris is a
 * polyhedron pile; forage uses item-specific kits.
 */
export function buildEntityMesh(
  scene: Scene,
  suffix: string,
  entity: WorldEntity,
  anchor: FarmEntityAnchor,
): AbstractMesh {
  switch (entity.kind) {
    case 'tree':
      return buildTree(scene, suffix, anchor);
    case 'stump':
      return buildStump(scene, suffix, anchor);
    case 'debris':
      return buildDebris(scene, suffix, anchor);
    case 'grass':
      return buildGrassTuft(scene, suffix, anchor);
    case 'forage':
    default:
      return buildForage(scene, suffix, entity, anchor);
  }
}

function buildTree(scene: Scene, suffix: string, anchor: FarmEntityAnchor): AbstractMesh {
  const trunk = MeshBuilder.CreateCylinder(
    `tree-${suffix}-trunk`,
    { height: 2, diameter: 0.6 },
    scene,
  );
  trunk.position.set(anchor.x, 1, anchor.z);
  trunk.material = flatMaterial(scene, `tree-${suffix}-trunk`, PALETTE.wood, 0.18);
  trunk.checkCollisions = true;
  const canopy = MeshBuilder.CreateCylinder(
    `tree-${suffix}-canopy`,
    { height: 3, diameterTop: 0, diameterBottom: 3.2, tessellation: 7 },
    scene,
  );
  canopy.position.set(anchor.x, 3.4, anchor.z);
  canopy.material = flatMaterial(scene, `tree-${suffix}-canopy`, PALETTE.grassAlt, 0.22);
  canopy.parent = trunk;
  return trunk;
}

function buildStump(scene: Scene, suffix: string, anchor: FarmEntityAnchor): AbstractMesh {
  const stump = MeshBuilder.CreateCylinder(
    `stump-${suffix}`,
    { height: 0.6, diameter: 0.7 },
    scene,
  );
  stump.position.set(anchor.x, 0.3, anchor.z);
  stump.material = flatMaterial(scene, `stump-${suffix}`, PALETTE.wood, 0.18);
  return stump;
}

function buildDebris(scene: Scene, suffix: string, anchor: FarmEntityAnchor): AbstractMesh {
  const rock = MeshBuilder.CreatePolyhedron(`debris-${suffix}`, { type: 1, size: 0.55 }, scene);
  rock.position.set(anchor.x, 0.5, anchor.z);
  rock.material = flatMaterial(scene, `debris-${suffix}`, PALETTE.cliff, 0.22);
  return rock;
}

function buildGrassTuft(scene: Scene, suffix: string, anchor: FarmEntityAnchor): AbstractMesh {
  const tuft = MeshBuilder.CreateSphere(`grass-${suffix}`, { diameter: 0.6 }, scene);
  tuft.position.set(anchor.x, 0.3, anchor.z);
  tuft.material = flatMaterial(scene, `grass-${suffix}`, PALETTE.grassAlt, 0.22);
  tuft.scaling = new Vector3(1, 0.55, 1);
  return tuft;
}

function buildForage(
  scene: Scene,
  suffix: string,
  entity: WorldEntity,
  anchor: FarmEntityAnchor,
): AbstractMesh {
  switch (entity.itemId) {
    case 'tide-shell': {
      const shell = MeshBuilder.CreateSphere(
        `shell-${suffix}`,
        { diameter: 0.45, segments: 6 },
        scene,
      );
      shell.position.set(anchor.x, 0.22, anchor.z);
      shell.scaling = new Vector3(1, 0.55, 0.85);
      shell.material = flatMaterial(scene, `shell-${suffix}`, PALETTE.accent, 0.35);
      return shell;
    }
    case 'driftwood':
    default: {
      const log = MeshBuilder.CreateBox(
        `drift-${suffix}`,
        { width: 1.0, depth: 0.32, height: 0.32 },
        scene,
      );
      log.position.set(anchor.x, 0.18, anchor.z);
      log.rotation.y = anchor.x % 2 === 0 ? 0.4 : -0.6;
      log.material = flatMaterial(scene, `drift-${suffix}`, PALETTE.wood, 0.22);
      return log;
    }
  }
}

export function entityLabel(entity: WorldEntity): string {
  switch (entity.kind) {
    case 'tree':
      return 'Chop the tree';
    case 'stump':
      return 'Clear the stump';
    case 'debris':
      return 'Break the debris';
    case 'grass':
      return 'Gather grass';
    case 'forage':
    default:
      switch (entity.itemId) {
        case 'tide-shell':
          return 'Pick up the shell';
        case 'driftwood':
          return 'Pick up the driftwood';
        default:
          return 'Gather';
      }
  }
}
