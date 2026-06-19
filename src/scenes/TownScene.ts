import { Scene, MeshBuilder, type Color3 } from '@babylonjs/core';
import { PlaceScene, type PlaceNav } from './PlaceScene';
import { flatMaterial, PALETTE } from '../render/scene-helpers';

export class TownScene extends PlaceScene {
  protected readonly sceneKey = 'Town';
  protected readonly title = 'Ballast Bay';
  protected readonly ground: Color3 = PALETTE.sand;
  protected readonly navs: PlaceNav[] = [
    { id: 'farm', label: 'Back to the farm', testId: 'nav-farm', target: 'Farm' },
    { id: 'interior', label: 'Enter the bakery', testId: 'nav-interior', target: 'Interior' },
    { id: 'court', label: 'Beach court', testId: 'nav-court', target: 'Court' },
  ];

  protected override decorate(scene: Scene): void {
    ([[-8, -4], [-4, -6], [0, -4], [5, -6]] as const).forEach(([x, z], i) => {
      const h = 2.6 + (i % 2) * 0.8;
      const shop = MeshBuilder.CreateBox(`shop${i}`, { width: 3, depth: 3, height: h }, scene);
      shop.position.set(x, h / 2, z);
      shop.material = flatMaterial(scene, `shop${i}`, PALETTE.wood, 0.25);
      const roof = MeshBuilder.CreateCylinder(`shoproof${i}`, { height: 1.2, diameterTop: 0, diameterBottom: 4.2, tessellation: 4 }, scene);
      roof.position.set(x, h + 0.6, z);
      roof.rotation.y = Math.PI / 4;
      roof.material = flatMaterial(scene, `shoproof${i}`, PALETTE.roof, 0.25);
    });
  }
}
