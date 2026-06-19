import { Scene, MeshBuilder, type Color3 } from '@babylonjs/core';
import { PlaceScene, type PlaceNav } from './PlaceScene';
import { flatMaterial, PALETTE } from '../render/scene-helpers';

export class FarmScene extends PlaceScene {
  protected readonly sceneKey = 'Farm';
  protected readonly title = 'Breakpoint Farm';
  protected readonly ground: Color3 = PALETTE.grass;
  protected readonly navs: PlaceNav[] = [
    { id: 'town', label: 'Walk to Ballast Bay', testId: 'nav-town', target: 'Town' },
    { id: 'court', label: 'Practice court', testId: 'nav-court', target: 'Court' },
    { id: 'mine', label: 'Ironroot Quarry', testId: 'nav-mine', target: 'Mine' },
    { id: 'save-quit', label: 'Save & quit to title', testId: 'nav-save-quit', action: 'save-quit' },
  ];

  protected override decorate(scene: Scene): void {
    const house = MeshBuilder.CreateBox('farmhouse', { width: 4, depth: 4, height: 3 }, scene);
    house.position.set(-8, 1.5, -6);
    house.material = flatMaterial(scene, 'farmhouse', PALETTE.wood, 0.25);
    const roof = MeshBuilder.CreateCylinder('farmroof', { height: 1.6, diameterTop: 0, diameterBottom: 6, tessellation: 4 }, scene);
    roof.position.set(-8, 3.8, -6);
    roof.rotation.y = Math.PI / 4;
    roof.material = flatMaterial(scene, 'farmroof', PALETTE.roof, 0.25);

    ([[6, -4], [10, 3], [-3, 8]] as const).forEach(([x, z], i) => {
      const tree = MeshBuilder.CreateCylinder(`tree${i}`, { height: 3, diameterTop: 0, diameterBottom: 2.6, tessellation: 6 }, scene);
      tree.position.set(x, 1.5, z);
      tree.material = flatMaterial(scene, `tree${i}`, PALETTE.grassAlt, 0.25);
    });
  }
}
