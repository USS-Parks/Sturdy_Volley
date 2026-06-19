import { Scene, MeshBuilder, type Color3 } from '@babylonjs/core';
import { PlaceScene, type PlaceNav } from './PlaceScene';
import { flatMaterial, PALETTE } from '../render/scene-helpers';

export class MineScene extends PlaceScene {
  protected readonly sceneKey = 'Mine';
  protected readonly title = 'Ironroot Quarry';
  protected readonly ground: Color3 = PALETTE.quarry;
  protected readonly navs: PlaceNav[] = [
    { id: 'farm', label: 'Leave the quarry', testId: 'nav-farm', target: 'Farm' },
  ];

  protected override decorate(scene: Scene): void {
    ([[-6, -3], [4, 2], [7, -5], [-3, 6]] as const).forEach(([x, z], i) => {
      const rock = MeshBuilder.CreatePolyhedron(`rock${i}`, { type: 1, size: 1.2 + (i % 2) * 0.4 }, scene);
      rock.position.set(x, 0.8, z);
      rock.material = flatMaterial(scene, `rock${i}`, PALETTE.cliff, 0.2);
    });
  }
}
