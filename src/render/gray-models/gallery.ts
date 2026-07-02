import { type Mesh, type Scene, Vector3 } from '@babylonjs/core';
import {
  createFacetedBox,
  createFacetedCylinder,
  createFacetedIcosphere,
  createGrayGroup,
  metadataFor,
} from './primitives';
import { grayModelDefinition, type GrayModelDefinition } from './registry';

export type GalleryZone = 'farm' | 'village' | 'coast' | 'wilds' | 'character-animal' | 'prop';

export interface GalleryModel {
  definition: GrayModelDefinition;
  zone: GalleryZone;
  meshes: Mesh[];
}

function required(id: string): GrayModelDefinition {
  const definition = grayModelDefinition(id);
  if (!definition) throw new Error(`Missing gray-model definition: ${id}`);
  return definition;
}

function buildAt(
  scene: Scene,
  id: string,
  zone: GalleryZone,
  position: Vector3,
  build: (part: PartBuilder) => void,
): GalleryModel {
  const definition = required(id);
  const root = createGrayGroup(scene, definition, position);
  const meshes: Mesh[] = [];
  const metadata = metadataFor(definition);
  let partIndex = 0;
  const part: PartBuilder = {
    box: (dimensions, local, material = 'neutral', rotationZ = 0) => {
      const mesh = createFacetedBox(scene, dimensions, {
        name: `gray-${id}-part-${partIndex++}`,
        material,
        metadata,
      });
      mesh.parent = root;
      mesh.position.copyFrom(local);
      mesh.rotation.z = rotationZ;
      meshes.push(mesh);
      return mesh;
    },
    cylinder: (dimensions, local, material = 'neutral') => {
      const mesh = createFacetedCylinder(scene, dimensions, {
        name: `gray-${id}-part-${partIndex++}`,
        material,
        metadata,
      });
      mesh.parent = root;
      mesh.position.copyFrom(local);
      meshes.push(mesh);
      return mesh;
    },
    sphere: (radius, local, material = 'neutral') => {
      const mesh = createFacetedIcosphere(scene, radius, {
        name: `gray-${id}-part-${partIndex++}`,
        material,
        metadata,
      });
      mesh.parent = root;
      mesh.position.copyFrom(local);
      meshes.push(mesh);
      return mesh;
    },
  };
  build(part);
  return { definition, zone, meshes };
}

type MaterialKey = 'neutral' | 'warm' | 'cool' | 'dark' | 'light' | 'debugFoundation' | 'debugVisual';
interface PartBuilder {
  box(dimensions: readonly [number, number, number], local: Vector3, material?: MaterialKey, rotationZ?: number): Mesh;
  cylinder(dimensions: { height: number; diameterTop: number; diameterBottom: number; tessellation?: number }, local: Vector3, material?: MaterialKey): Mesh;
  sphere(radius: number, local: Vector3, material?: MaterialKey): Mesh;
}

export function buildWorldPosterGallery(scene: Scene): GalleryModel[] {
  const models: GalleryModel[] = [];

  models.push(buildAt(scene, 'prop-raised-bed', 'farm', new Vector3(-19, 0, -6), (p) => {
    p.box([3, 0.35, 1.2], Vector3.Zero(), 'warm');
    p.box([2.65, 0.12, 0.9], new Vector3(0, 0.35, 0), 'dark');
    for (const x of [-1.32, 1.32]) for (const z of [-0.48, 0.48]) p.box([0.12, 0.55, 0.12], new Vector3(x, 0, z), 'warm');
  }));

  models.push(buildAt(scene, 'building-village-house', 'village', new Vector3(-9, 0, -5), (p) => {
    p.box([7, 3.8, 6], Vector3.Zero(), 'warm');
    p.box([3.9, 0.32, 6.4], new Vector3(-1.55, 3.65, 0), 'dark', 0.47);
    p.box([3.9, 0.32, 6.4], new Vector3(1.55, 3.65, 0), 'dark', -0.47);
    p.box([1.2, 2.25, 0.18], new Vector3(0, 0, -3.1), 'cool');
  }));

  models.push(buildAt(scene, 'building-lighthouse', 'coast', new Vector3(4, 0, -5), (p) => {
    p.cylinder({ height: 13.5, diameterTop: 2.1, diameterBottom: 4.4, tessellation: 10 }, Vector3.Zero(), 'light');
    p.cylinder({ height: 1.1, diameterTop: 3.3, diameterBottom: 3.3, tessellation: 10 }, new Vector3(0, 13.5, 0), 'dark');
    p.cylinder({ height: 1.6, diameterTop: 2.7, diameterBottom: 2.7, tessellation: 10 }, new Vector3(0, 14.6, 0), 'cool');
    p.cylinder({ height: 0.9, diameterTop: 0, diameterBottom: 3.2, tessellation: 10 }, new Vector3(0, 16.2, 0), 'dark');
  }));

  models.push(buildAt(scene, 'terrain-marsh-boardwalk', 'wilds', new Vector3(14, 0, -5), (p) => {
    for (let i = 0; i < 7; i += 1) p.box([1.75, 0.18, 0.48], new Vector3(0, 0, i * 0.54), i % 2 ? 'warm' : 'dark');
    p.box([0.12, 0.55, 3.9], new Vector3(-0.72, -0.22, 1.62), 'dark');
    p.box([0.12, 0.55, 3.9], new Vector3(0.72, -0.22, 1.62), 'dark');
  }));

  models.push(buildAt(scene, 'building-quarry-gantry', 'wilds', new Vector3(22, 0, -5), (p) => {
    p.box([0.55, 7.5, 0.55], new Vector3(-3.3, 0, 0), 'dark');
    p.box([0.55, 7.5, 0.55], new Vector3(3.3, 0, 0), 'dark');
    p.box([7.4, 0.6, 0.7], new Vector3(0, 7.1, 0), 'warm');
    p.box([7.7, 0.24, 0.32], new Vector3(0, 3.5, 0), 'cool', 0.82);
  }));

  models.push(buildAt(scene, 'character-player-proxy', 'character-animal', new Vector3(-16, 0, 7), (p) => {
    p.cylinder({ height: 1.15, diameterTop: 0.5, diameterBottom: 0.68, tessellation: 7 }, Vector3.Zero(), 'cool');
    p.sphere(0.31, new Vector3(0, 1.13, 0), 'light');
  }));

  models.push(buildAt(scene, 'animal-dog-proxy', 'character-animal', new Vector3(-12, 0, 7), (p) => {
    p.box([0.48, 0.5, 0.9], Vector3.Zero(), 'warm');
    p.box([0.5, 0.48, 0.48], new Vector3(0, 0.38, -0.55), 'warm');
    for (const x of [-0.16, 0.16]) for (const z of [-0.28, 0.28]) p.box([0.12, 0.38, 0.12], new Vector3(x, 0, z), 'dark');
    p.box([0.1, 0.1, 0.55], new Vector3(0, 0.42, 0.5), 'warm', -0.6);
  }));

  models.push(buildAt(scene, 'prop-crate', 'prop', new Vector3(-6, 0, 7), (p) => {
    for (const x of [-0.35, 0.35]) for (const z of [-0.35, 0.35]) p.box([0.1, 0.68, 0.1], new Vector3(x, 0, z), 'dark');
    for (const y of [0.12, 0.31, 0.5]) {
      p.box([0.64, 0.14, 0.06], new Vector3(0, y, -0.37), 'warm');
      p.box([0.64, 0.14, 0.06], new Vector3(0, y, 0.37), 'warm');
    }
  }));

  return models;
}
