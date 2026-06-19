import { PlaceScene, type PlaceNav } from './PlaceScene';

export class InteriorScene extends PlaceScene {
  protected readonly title = 'Sun Loaf Bakery';
  protected readonly backgroundColor = '#2a2230';
  protected readonly navs: PlaceNav[] = [
    { id: 'town', label: 'Step outside', testId: 'nav-town', target: 'Town' },
  ];

  constructor() {
    super('Interior');
  }
}
