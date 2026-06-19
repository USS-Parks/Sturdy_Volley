import { Scene, MeshBuilder, type Color3 } from '@babylonjs/core';
import { PlaceScene, type PlaceNav } from './PlaceScene';
import { flatMaterial, PALETTE } from '../render/scene-helpers';

export class CourtScene extends PlaceScene {
  protected readonly sceneKey = 'Court';
  protected readonly title = 'Practice Court';
  protected readonly ground: Color3 = PALETTE.sand;
  protected readonly navs: PlaceNav[] = [
    { id: 'farm', label: 'Leave the court', testId: 'nav-farm', target: 'Farm' },
  ];

  protected override decorate(scene: Scene): void {
    const court = MeshBuilder.CreateBox('court', { width: 12, depth: 8, height: 0.2 }, scene);
    court.position.set(0, 0.1, 0);
    court.material = flatMaterial(scene, 'court', PALETTE.sand, 0.32);
    const net = MeshBuilder.CreateBox('net', { width: 0.15, depth: 8, height: 1.4 }, scene);
    net.position.set(0, 0.9, 0);
    net.material = flatMaterial(scene, 'net', PALETTE.stone, 0.45);
  }
}
