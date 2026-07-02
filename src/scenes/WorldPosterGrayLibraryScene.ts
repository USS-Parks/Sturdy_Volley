import { MeshBuilder, Scene, Vector3 } from '@babylonjs/core';
import { GameScene } from './GameScene';
import { addFog, addLights, addThreeQuarterCamera, flatMaterial, makeScene, PALETTE } from '../render/scene-helpers';
import { buildWorldPosterGallery, type GalleryModel, type GalleryZone } from '../render/gray-models/gallery';

export class WorldPosterGrayLibraryScene extends GameScene {
  private models: GalleryModel[] = [];

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    this.scene = scene;
    addFog(scene, PALETTE.fog, 0.004);
    addLights(scene);
    addThreeQuarterCamera(scene, new Vector3(1, 4.5, 0), 47);

    const ground = MeshBuilder.CreateGround('world-poster-library-ground', { width: 64, height: 36 }, scene);
    ground.material = flatMaterial(scene, 'world-poster-library-ground', PALETTE.grass, 0.18);
    ground.isPickable = false;

    this.models = buildWorldPosterGallery(scene);
    return scene;
  }

  override enter(): void {
    const api = {
      snapshot: () => ({
        count: this.models.length,
        meshCount: this.models.reduce((sum, model) => sum + model.meshes.length, 0),
        zones: [...new Set(this.models.map((model) => model.zone))],
        models: this.models.map((model) => ({
          id: model.definition.id,
          family: model.definition.family,
          dimensions: [...model.definition.dimensions],
          sourceRefs: [...model.definition.sourceRefs],
          policy: model.definition.policy,
          zone: model.zone,
          meshCount: model.meshes.length,
        })),
      }),
    };
    (window as unknown as { sturdyVolleyGrayLibrary?: typeof api }).sturdyVolleyGrayLibrary = api;
  }

  override dispose(): void {
    delete (window as unknown as { sturdyVolleyGrayLibrary?: unknown }).sturdyVolleyGrayLibrary;
    super.dispose();
  }
}

export const REQUIRED_GALLERY_ZONES: readonly GalleryZone[] = [
  'farm', 'village', 'coast', 'wilds', 'character-animal', 'prop',
];
