import { Color3, MeshBuilder, type AbstractMesh, type Scene } from '@babylonjs/core';
import { flatMaterial, PALETTE } from './scene-helpers';
import type { AnimalKind } from '../engine/animals';

/**
 * Graybox animal geometry (Prompt 019). Hens are squat sphere stacks,
 * goats are oblong capsules. Per-kind material colors come from PALETTE
 * so the swap to real `.glb` rigs is a one-line per-kind edit.
 */
export interface AnimalMesh {
  body: AbstractMesh;
  /** Subtle "head" mesh that we offset for a bob animation. */
  bob: AbstractMesh;
  kind: AnimalKind;
}

export function buildAnimalMesh(
  scene: Scene,
  id: string,
  kind: AnimalKind,
  pos: { x: number; z: number },
): AnimalMesh {
  if (kind === 'mooncalf-hen') {
    const body = MeshBuilder.CreateSphere(`animal-${id}-body`, { diameter: 0.55 }, scene);
    body.position.set(pos.x, 0.28, pos.z);
    body.material = flatMaterial(scene, `animal-${id}-body-mat`, new Color3(0.92, 0.91, 0.85), 0.32);
    body.checkCollisions = true;
    const head = MeshBuilder.CreateSphere(`animal-${id}-head`, { diameter: 0.32 }, scene);
    head.position.set(pos.x + 0.22, 0.6, pos.z);
    head.material = flatMaterial(scene, `animal-${id}-head-mat`, new Color3(0.95, 0.92, 0.84), 0.36);
    const beak = MeshBuilder.CreateBox(`animal-${id}-beak`, { width: 0.12, depth: 0.18, height: 0.08 }, scene);
    beak.position.set(pos.x + 0.4, 0.6, pos.z);
    beak.material = flatMaterial(scene, `animal-${id}-beak-mat`, PALETTE.warmLight, 0.42);
    return { body, bob: head, kind };
  }
  // bluff-goat
  const body = MeshBuilder.CreateCapsule(`animal-${id}-body`, { height: 1.0, radius: 0.35 }, scene);
  body.position.set(pos.x, 0.55, pos.z);
  body.rotation.z = Math.PI / 2;
  body.material = flatMaterial(scene, `animal-${id}-body-mat`, new Color3(0.74, 0.68, 0.58), 0.3);
  body.checkCollisions = true;
  const head = MeshBuilder.CreateBox(`animal-${id}-head`, { width: 0.4, depth: 0.35, height: 0.45 }, scene);
  head.position.set(pos.x + 0.65, 0.7, pos.z);
  head.material = flatMaterial(scene, `animal-${id}-head-mat`, new Color3(0.84, 0.78, 0.66), 0.32);
  return { body, bob: head, kind };
}

/** Apply a tiny vertical bob animation each tick so animals feel alive. */
export function bobAnimal(mesh: AnimalMesh, seconds: number, idIndex: number): void {
  const phase = (seconds + idIndex * 0.6) * 1.6;
  mesh.bob.position.y = (mesh.kind === 'mooncalf-hen' ? 0.6 : 0.7) + Math.sin(phase) * 0.04;
}

/** Reposition (for inside/outside transitions). */
export function moveAnimal(
  mesh: AnimalMesh,
  pos: { x: number; z: number },
): void {
  const dx = pos.x - mesh.body.position.x;
  const dz = pos.z - mesh.body.position.z;
  mesh.body.position.x = pos.x;
  mesh.body.position.z = pos.z;
  mesh.bob.position.x += dx;
  mesh.bob.position.z += dz;
}

export function disposeAnimal(mesh: AnimalMesh): void {
  mesh.body.dispose();
  mesh.bob.dispose();
}
