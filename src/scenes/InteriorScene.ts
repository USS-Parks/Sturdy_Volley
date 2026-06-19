import { type Color3 } from '@babylonjs/core';
import { PlaceScene, type PlaceNav } from './PlaceScene';
import { PALETTE } from '../render/scene-helpers';

export class InteriorScene extends PlaceScene {
  protected readonly sceneKey = 'Interior';
  protected readonly title = 'Sun Loaf Bakery';
  protected readonly ground: Color3 = PALETTE.interior;
  protected readonly navs: PlaceNav[] = [
    { id: 'town', label: 'Step outside', testId: 'nav-town', target: 'Town' },
  ];
}
