import { Scene, MeshBuilder, type Color3 } from '@babylonjs/core';
import { PlaceScene, type PlaceNav } from './PlaceScene';
import { flatMaterial, PALETTE } from '../render/scene-helpers';

export class BeachScene extends PlaceScene {
  protected readonly sceneKey = 'Beach';
  protected readonly title = 'Driftwood Beach';
  protected readonly ground: Color3 = PALETTE.sand;
  protected readonly navs: PlaceNav[] = [
    { id: 'farm', label: 'Back to the farm', testId: 'nav-farm', target: 'Farm' },
  ];

  protected override decorate(scene: Scene): void {
    const dock = MeshBuilder.CreateBox('dock', { width: 3, depth: 10, height: 0.4 }, scene);
    dock.position.set(0, 0.2, -6);
    dock.material = flatMaterial(scene, 'dock', PALETTE.wood, 0.25);

    ([[-5, 3], [5, 4], [7, -2]] as const).forEach(([x, z], i) => {
      const wood = MeshBuilder.CreateBox(`driftwood${i}`, { width: 1.6, depth: 0.5, height: 0.4 }, scene);
      wood.position.set(x, 0.2, z);
      wood.rotation.y = i;
      wood.material = flatMaterial(scene, `driftwood${i}`, PALETTE.wood, 0.2);
    });
  }
}
