import { Color3, MeshBuilder, type AbstractMesh, type Scene } from '@babylonjs/core';
import { flatMaterial, PALETTE } from './scene-helpers';
import type { PetKind, PetState } from '../engine/pets';

/**
 * Graybox pet geometry (Prompt 020). The companion is a small capsule
 * body + sphere head, with an optional collar ring rendered as a torus
 * snippet (a thin box ring around the neck). Color keyed on kind.
 */
export interface PetMesh {
  body: AbstractMesh;
  head: AbstractMesh;
  collar: AbstractMesh;
  kind: PetKind;
}

const KIND_COLOR: Record<PetKind, Color3> = {
  'tide-cat': new Color3(0.72, 0.66, 0.85),
  'bay-dog': new Color3(0.85, 0.78, 0.58),
};

const COLLAR_COLOR: Record<NonNullable<PetState['collar']>, Color3> = {
  red: new Color3(0.78, 0.22, 0.22),
  kelp: new Color3(0.22, 0.5, 0.32),
  shell: new Color3(0.92, 0.86, 0.74),
};

export function buildPetMesh(scene: Scene, pet: PetState): PetMesh {
  const id = `pet-${pet.kind}`;
  const body = MeshBuilder.CreateCapsule(`${id}-body`, { height: 0.55, radius: 0.22 }, scene);
  body.position.set(pet.x, 0.3, pet.z);
  body.rotation.z = Math.PI / 2;
  body.material = flatMaterial(scene, `${id}-body-mat`, KIND_COLOR[pet.kind], 0.32);

  const head = MeshBuilder.CreateSphere(`${id}-head`, { diameter: 0.28 }, scene);
  head.position.set(pet.x + 0.32, 0.42, pet.z);
  head.material = flatMaterial(scene, `${id}-head-mat`, KIND_COLOR[pet.kind].scale(1.05), 0.36);

  const collar = MeshBuilder.CreateTorus(`${id}-collar`, { diameter: 0.28, thickness: 0.06 }, scene);
  collar.position.set(pet.x + 0.18, 0.36, pet.z);
  collar.rotation.x = Math.PI / 2;
  collar.material = flatMaterial(scene, `${id}-collar-mat`, COLLAR_COLOR.red, 0.4);
  collar.isVisible = pet.collar !== null;
  if (pet.collar) collar.material = flatMaterial(scene, `${id}-collar-${pet.collar}`, COLLAR_COLOR[pet.collar], 0.45);

  return { body, head, collar, kind: pet.kind };
}

export function movePetMesh(mesh: PetMesh, pet: PetState): void {
  const dx = pet.x - mesh.body.position.x;
  const dz = pet.z - mesh.body.position.z;
  mesh.body.position.x = pet.x;
  mesh.body.position.z = pet.z;
  mesh.head.position.x += dx;
  mesh.head.position.z += dz;
  mesh.collar.position.x += dx;
  mesh.collar.position.z += dz;
}

export function refreshPetCollar(mesh: PetMesh, pet: PetState): void {
  mesh.collar.isVisible = pet.collar !== null;
  if (pet.collar) {
    mesh.collar.material = flatMaterial(
      mesh.collar.getScene(),
      `pet-${mesh.kind}-collar-${pet.collar}`,
      COLLAR_COLOR[pet.collar],
      0.45,
    );
  }
}

export function disposePet(mesh: PetMesh): void {
  mesh.body.dispose();
  mesh.head.dispose();
  mesh.collar.dispose();
}

export { PALETTE };
