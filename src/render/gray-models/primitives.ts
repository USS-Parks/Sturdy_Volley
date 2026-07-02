import {
  Matrix,
  Mesh,
  MeshBuilder,
  TransformNode,
  type Scene,
  type Vector3,
} from '@babylonjs/core';
import { grayMaterial, type GrayMaterialKey } from './materials';
import type { GrayModelDefinition, GrayModelPolicy } from './registry';

export interface GrayModelMetadata {
  modelId: string;
  assetId: string;
  family: string;
  sourceRefs: readonly string[];
  policy: GrayModelPolicy;
}

interface PrimitiveOptions {
  name: string;
  material?: GrayMaterialKey;
  pickable?: boolean;
  metadata?: GrayModelMetadata;
}

function bakeBaseOrigin(mesh: Mesh): void {
  mesh.refreshBoundingInfo();
  const minimumY = mesh.getBoundingInfo().boundingBox.minimum.y;
  mesh.bakeTransformIntoVertices(Matrix.Translation(0, -minimumY, 0));
}

function finish(mesh: Mesh, scene: Scene, options: PrimitiveOptions): Mesh {
  mesh.material = grayMaterial(scene, options.material ?? 'neutral');
  mesh.isPickable = options.pickable ?? false;
  if (options.metadata) mesh.metadata = { ...mesh.metadata, grayModel: options.metadata };
  mesh.computeWorldMatrix(true);
  return mesh;
}

/** Base-origin faceted box: local y=0 is the contact plane. */
export function createFacetedBox(
  scene: Scene,
  dimensions: readonly [width: number, height: number, depth: number],
  options: PrimitiveOptions,
): Mesh {
  const [width, height, depth] = dimensions;
  const mesh = MeshBuilder.CreateBox(options.name, { width, height, depth, updatable: false }, scene);
  bakeBaseOrigin(mesh);
  return finish(mesh, scene, options);
}

/** Base-origin flat-shaded cylinder/frustum with an explicit low tessellation. */
export function createFacetedCylinder(
  scene: Scene,
  dimensions: { height: number; diameterTop: number; diameterBottom: number; tessellation?: number },
  options: PrimitiveOptions,
): Mesh {
  const mesh = MeshBuilder.CreateCylinder(options.name, {
    height: dimensions.height,
    diameterTop: dimensions.diameterTop,
    diameterBottom: dimensions.diameterBottom,
    tessellation: Math.max(3, dimensions.tessellation ?? 8),
    subdivisions: 1,
  }, scene);
  mesh.convertToFlatShadedMesh();
  bakeBaseOrigin(mesh);
  return finish(mesh, scene, options);
}

/** Base-origin low-subdivision icosphere for rocks, crowns, and joint proxies. */
export function createFacetedIcosphere(
  scene: Scene,
  radius: number,
  options: PrimitiveOptions & { subdivisions?: number },
): Mesh {
  const mesh = MeshBuilder.CreateIcoSphere(options.name, {
    radius,
    subdivisions: Math.max(1, options.subdivisions ?? 1),
    flat: true,
  }, scene);
  bakeBaseOrigin(mesh);
  return finish(mesh, scene, options);
}

/** Named root for multi-part models; origin remains on the contact plane. */
export function createGrayGroup(
  scene: Scene,
  definition: GrayModelDefinition,
  position?: Vector3,
): TransformNode {
  const root = new TransformNode(`gray-${definition.id}`, scene);
  if (position) root.position.copyFrom(position);
  const metadata: GrayModelMetadata = {
    modelId: definition.id,
    assetId: definition.assetId,
    family: definition.family,
    sourceRefs: definition.sourceRefs,
    policy: definition.policy,
  };
  root.metadata = { grayModel: metadata };
  return root;
}

export function metadataFor(definition: GrayModelDefinition): GrayModelMetadata {
  return {
    modelId: definition.id,
    assetId: definition.assetId,
    family: definition.family,
    sourceRefs: definition.sourceRefs,
    policy: definition.policy,
  };
}
