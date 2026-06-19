import { PlaceScene, type PlaceNav } from './PlaceScene';

export class FarmScene extends PlaceScene {
  protected readonly title = 'Breakpoint Farm';
  protected readonly backgroundColor = '#16361f';
  protected readonly navs: PlaceNav[] = [
    { id: 'town', label: 'Walk to Ballast Bay', testId: 'nav-town', target: 'Town' },
    { id: 'court', label: 'Practice court', testId: 'nav-court', target: 'Court' },
    { id: 'mine', label: 'Ironroot Quarry', testId: 'nav-mine', target: 'Mine' },
    { id: 'save-quit', label: 'Save & quit to title', testId: 'nav-save-quit', action: 'save-quit' },
  ];

  constructor() {
    super('Farm');
  }
}
