import {
  Scene,
  MeshBuilder,
  Vector3,
  type AbstractMesh,
} from '@babylonjs/core';
import { flatMaterial, PALETTE } from './scene-helpers';
import type { WorldEntity } from '../engine/forage';

/**
 * Driftwood Beach world-entity factory (RF-10). Anchors place shells along the
 * tide line and storm-drift sticks on the dry sand. Same primitive vocabulary
 * as farm-entities.ts (per §0.10 — primitives only, one material per mesh).
 */
export interface BeachEntityAnchor {
  x: number;
  z: number;
  radius?: number;
  /** When true, the entity is "tide-line": revealed at low + falling tide, hidden at high + rising. */
  tideLine?: boolean;
}

export const BEACH_ENTITY_ANCHORS: Record<string, BeachEntityAnchor> = {
  'shell-a': { x: -3, z: 3.4, tideLine: true },
  'shell-b': { x: 2, z: 4.1, tideLine: true },
  'shell-c': { x: 5, z: 3.0, tideLine: true },
  'drift-a': { x: -6, z: 0.4 },
  'drift-b': { x: 6, z: 1.2 },
};

export function beachEntitySuffix(key: string): string | null {
  return key.startsWith('Beach:') ? key.slice('Beach:'.length) : null;
}

export function beachAnchorFor(suffix: string): BeachEntityAnchor | null {
  return BEACH_ENTITY_ANCHORS[suffix] ?? null;
}

export function buildBeachEntityMesh(
  scene: Scene,
  suffix: string,
  entity: WorldEntity,
  anchor: BeachEntityAnchor,
): AbstractMesh {
  if (entity.kind === 'forage' && entity.itemId === 'tide-shell') {
    const shell = MeshBuilder.CreateSphere(
      `beach-shell-${suffix}`,
      { diameter: 0.45, segments: 6 },
      scene,
    );
    shell.position.set(anchor.x, 0.22, anchor.z);
    shell.scaling = new Vector3(1, 0.55, 0.85);
    shell.material = flatMaterial(scene, `beach-shell-${suffix}`, PALETTE.accent, 0.35);
    return shell;
  }
  // driftwood + fallback
  const log = MeshBuilder.CreateBox(
    `beach-drift-${suffix}`,
    { width: 1.1, depth: 0.35, height: 0.32 },
    scene,
  );
  log.position.set(anchor.x, 0.18, anchor.z);
  log.rotation.y = anchor.x % 2 === 0 ? 0.4 : -0.6;
  log.material = flatMaterial(scene, `beach-drift-${suffix}`, PALETTE.wood, 0.22);
  return log;
}

export function beachEntityLabel(entity: WorldEntity): string {
  if (entity.kind === 'forage' && entity.itemId === 'tide-shell') return 'Pick up the shell';
  if (entity.kind === 'forage' && entity.itemId === 'driftwood') return 'Pick up the driftwood';
  return 'Gather';
}
