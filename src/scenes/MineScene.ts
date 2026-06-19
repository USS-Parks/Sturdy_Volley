import { PlaceScene, type PlaceNav } from './PlaceScene';

export class MineScene extends PlaceScene {
  protected readonly title = 'Ironroot Quarry';
  protected readonly backgroundColor = '#241c14';
  protected readonly navs: PlaceNav[] = [
    { id: 'farm', label: 'Leave the quarry', testId: 'nav-farm', target: 'Farm' },
  ];

  constructor() {
    super('Mine');
  }
}
