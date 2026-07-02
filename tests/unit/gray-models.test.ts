import { NullEngine, Scene } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { grayMaterial } from '../../src/render/gray-models/materials';
import {
  createFacetedBox,
  createFacetedCylinder,
  createFacetedIcosphere,
  createGrayGroup,
  metadataFor,
} from '../../src/render/gray-models/primitives';
import {
  ASSET_FAMILIES,
  GRAY_MODEL_REGISTRY,
  grayModelDefinition,
  validateGrayModelRegistry,
} from '../../src/render/gray-models/registry';

describe('gray-model core', () => {
  let engine: NullEngine;
  let scene: Scene;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  it('reuses shared neutral materials within a scene', () => {
    const first = grayMaterial(scene, 'neutral');
    const second = grayMaterial(scene, 'neutral');
    expect(second).toBe(first);
    expect(first.specularColor.asArray()).toEqual([0, 0, 0]);
  });

  it('builds base-origin, non-pickable faceted primitives at stable dimensions', () => {
    const box = createFacetedBox(scene, [2, 3, 4], { name: 'gray-test-box' });
    const cylinder = createFacetedCylinder(scene, {
      height: 2,
      diameterTop: 1,
      diameterBottom: 1.5,
      tessellation: 6,
    }, { name: 'gray-test-cylinder' });
    const rock = createFacetedIcosphere(scene, 1, { name: 'gray-test-rock' });

    for (const mesh of [box, cylinder, rock]) {
      mesh.refreshBoundingInfo();
      mesh.computeWorldMatrix(true);
      expect(mesh.getBoundingInfo().boundingBox.minimumWorld.y).toBeCloseTo(0, 5);
      expect(mesh.isPickable).toBe(false);
    }
    expect(box.getBoundingInfo().boundingBox.extendSizeWorld.scale(2).asArray()).toEqual([2, 3, 4]);
    expect(cylinder.getTotalVertices()).toBeGreaterThan(0);
    expect(rock.getTotalVertices()).toBeGreaterThan(0);
  });

  it('attaches source and replacement metadata to named groups and meshes', () => {
    const definition = grayModelDefinition('prop-crate')!;
    const group = createGrayGroup(scene, definition);
    const mesh = createFacetedBox(scene, definition.dimensions, {
      name: 'gray-prop-crate-body',
      metadata: metadataFor(definition),
    });
    mesh.parent = group;

    expect(group.name).toBe('gray-prop-crate');
    expect(group.metadata.grayModel.assetId).toBe('sv_prop_crate');
    expect(mesh.metadata.grayModel.sourceRefs).toContain('J-140');
  });
});

describe('gray-model registry', () => {
  it('is unique, dimensioned, source-traceable, family-prefixed, and sports-free', () => {
    expect(validateGrayModelRegistry()).toEqual([]);
    expect(new Set(GRAY_MODEL_REGISTRY.map((entry) => entry.id)).size).toBe(GRAY_MODEL_REGISTRY.length);
    expect(GRAY_MODEL_REGISTRY.every((entry) => ASSET_FAMILIES.some((family) => family === entry.family))).toBe(true);
  });

  it('covers the first production families and world-poster landmarks', () => {
    const ids = new Set<string>(GRAY_MODEL_REGISTRY.map((entry) => entry.id));
    for (const id of [
      'building-farmhouse-shell',
      'building-village-house',
      'building-lighthouse',
      'terrain-marsh-boardwalk',
      'building-quarry-gantry',
      'terrain-ridge-cliff',
      'character-player-proxy',
      'animal-dog-proxy',
      'prop-crate',
    ]) expect(ids.has(id), id).toBe(true);
  });
});
