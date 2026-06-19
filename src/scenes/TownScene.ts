import { PlaceScene, type PlaceNav } from './PlaceScene';

export class TownScene extends PlaceScene {
  protected readonly title = 'Ballast Bay';
  protected readonly backgroundColor = '#1a2c3e';
  protected readonly navs: PlaceNav[] = [
    { id: 'farm', label: 'Back to the farm', testId: 'nav-farm', target: 'Farm' },
    { id: 'interior', label: 'Enter the bakery', testId: 'nav-interior', target: 'Interior' },
    { id: 'court', label: 'Beach court', testId: 'nav-court', target: 'Court' },
  ];

  constructor() {
    super('Town');
  }
}
