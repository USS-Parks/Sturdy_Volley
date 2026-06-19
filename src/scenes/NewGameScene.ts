import { Scene, ArcRotateCamera, MeshBuilder, Vector3 } from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, PALETTE } from '../render/scene-helpers';
import { createNewSave } from '../engine/saveModel';
import { writeSave } from '../engine/save';
import { setActiveSave } from '../engine/gameState';

export class NewGameScene extends GameScene {
  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    addFog(scene, PALETTE.fog, 0.025);
    const cam = new ArcRotateCamera('ng-cam', -Math.PI / 2 + 0.4, Math.PI / 3, 24, new Vector3(0, 2, 0), scene);
    cam.fov = 0.8;
    addLights(scene);
    const sea = MeshBuilder.CreateGround('sea', { width: 100, height: 100 }, scene);
    sea.material = flatMaterial(scene, 'sea', PALETTE.sea, 0.35);
    const isle = MeshBuilder.CreateBox('isle', { width: 14, depth: 12, height: 3 }, scene);
    isle.position.set(0, 1.5, 0);
    isle.material = flatMaterial(scene, 'isle', PALETTE.grass, 0.25);
    this.scene = scene;
    return scene;
  }

  override enter(): void {
    this.ctx.overlay.showForm(
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
        this.goTo('Farm');
      },
      () => this.goTo('Title'),
    );
  }
}
