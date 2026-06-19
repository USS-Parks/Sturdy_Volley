import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { UIOverlay } from '../ui/overlay';
import { createNewSave } from '../engine/saveModel';
import { writeSave } from '../engine/save';
import { setActiveSave } from '../engine/gameState';

export class NewGameScene extends GameScene {
  private overlay!: UIOverlay;

  constructor() {
    super('NewGame');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b1b2b');
    this.fadeIn();

    this.overlay = new UIOverlay();
    this.overlay.showForm(
      'New Game',
      [
        { id: 'name', label: 'Your name', value: 'Coast Keeper', maxLength: 40 },
        { id: 'farmName', label: 'Farm name', value: 'Breakpoint Farm', maxLength: 40 },
      ],
      'Begin',
      (values) => {
        const save = createNewSave({ name: values.name, farmName: values.farmName });
        setActiveSave(save);
        writeSave(save);
        this.fadeTo('Farm');
      },
      () => this.fadeTo('Title'),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.overlay.clear());
  }
}
