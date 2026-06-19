import { PlaceScene, type PlaceNav } from './PlaceScene';

export class CourtScene extends PlaceScene {
  protected readonly title = 'Practice Court';
  protected readonly backgroundColor = '#123a2a';
  protected readonly navs: PlaceNav[] = [
    { id: 'farm', label: 'Leave the court', testId: 'nav-farm', target: 'Farm' },
  ];

  constructor() {
    super('Court');
  }
}
