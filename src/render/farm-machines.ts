import { Color3, MeshBuilder, type AbstractMesh, type Scene } from '@babylonjs/core';
import { flatMaterial, PALETTE } from './scene-helpers';
import type { MachineKind, MachineStatus } from '../engine/machines';

/**
 * Graybox machine geometry (Prompt 018). One small cluster of low-poly
 * primitives per kind, each carrying a "status light" sphere whose
 * material color is keyed off the live `MachineStatus`. A future asset
 * pipeline can swap in `.glb` models keyed on `MachineKind` without
 * touching the scene.
 */
export interface MachineMesh {
  body: AbstractMesh;
  statusLight: AbstractMesh;
  kind: MachineKind;
}

const STATUS_COLOR: Record<MachineStatus, Color3> = {
  idle: PALETTE.cliff.clone(),
  processing: PALETTE.accent.clone(),
  ready: PALETTE.warmLight.clone(),
};

export function buildMachineMesh(
  scene: Scene,
  id: string,
  kind: MachineKind,
  pos: { x: number; z: number },
): MachineMesh {
  const baseName = `machine-${id}`;
  let body: AbstractMesh;
  switch (kind) {
    case 'brine-barrel':
      body = MeshBuilder.CreateCylinder(baseName, { height: 1.1, diameter: 0.95 }, scene);
      body.position.set(pos.x, 0.55, pos.z);
      body.material = flatMaterial(scene, baseName, PALETTE.wood, 0.22);
      break;
    case 'herb-dryer':
      body = MeshBuilder.CreateBox(baseName, { width: 1.0, depth: 0.6, height: 1.4 }, scene);
      body.position.set(pos.x, 0.7, pos.z);
      body.material = flatMaterial(scene, baseName, PALETTE.cliff, 0.24);
      break;
    case 'cheese-drum':
      body = MeshBuilder.CreateCylinder(baseName, { height: 0.9, diameter: 1.2 }, scene);
      body.position.set(pos.x, 0.45, pos.z);
      body.material = flatMaterial(scene, baseName, PALETTE.stone, 0.22);
      break;
    case 'honey-spinner':
      body = MeshBuilder.CreateCylinder(baseName, { height: 1.2, diameter: 0.8 }, scene);
      body.position.set(pos.x, 0.6, pos.z);
      body.material = flatMaterial(scene, baseName, PALETTE.warmLight, 0.25);
      break;
    case 'oil-press':
      body = MeshBuilder.CreateBox(baseName, { width: 1.1, depth: 0.9, height: 1.0 }, scene);
      body.position.set(pos.x, 0.5, pos.z);
      body.material = flatMaterial(scene, baseName, PALETTE.cliff, 0.22);
      break;
  }
  body.checkCollisions = true;

  const statusLight = MeshBuilder.CreateSphere(`${baseName}-light`, { diameter: 0.22 }, scene);
  statusLight.position.set(pos.x, 1.55, pos.z);
  statusLight.material = flatMaterial(scene, `${baseName}-light-mat`, STATUS_COLOR.idle, 0.35);
  return { body, statusLight, kind };
}

export function paintMachineStatus(mesh: MachineMesh, status: MachineStatus): void {
  if (mesh.statusLight.material && 'name' in mesh.statusLight.material) {
    const mat = flatMaterial(
      mesh.statusLight.getScene(),
      `${mesh.statusLight.name}-${status}`,
      STATUS_COLOR[status],
      status === 'ready' ? 0.65 : 0.3,
    );
    mesh.statusLight.material = mat;
  }
}
