import { Scene, ArcRotateCamera, MeshBuilder, Vector3 } from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, PALETTE } from '../render/scene-helpers';
import { buildTitleMenu } from '../ui/menuModel';
import { hasSaveGame, readSave, deleteSave } from '../engine/save';
import { setActiveSave, clearActiveSave } from '../engine/gameState';
import { downloadSave, pickAndImportSave } from '../engine/saveTransfer';
import { getContentReport } from '../data/content';

const RESUMABLE_SCENES = new Set(['Farm', 'Town', 'Interior', 'Court', 'Mine']);

/**
 * Title screen: a slowly-orbiting low-poly Ballast Bay diorama (all placeholder
 * primitives, Theme-3 palette) behind the accessible HTML overlay menu.
 */
export class TitleScene extends GameScene {
  private camera!: ArcRotateCamera;

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    addFog(scene, PALETTE.fog, 0.02);
    this.camera = new ArcRotateCamera('title-cam', -Math.PI / 2 + 0.6, Math.PI / 3.3, 34, new Vector3(0, 3, 0), scene);
    this.camera.fov = 0.8;
    addLights(scene);
    this.buildDiorama(scene);
    this.scene = scene;
    return scene;
  }

  private buildDiorama(scene: Scene): void {
    const sea = MeshBuilder.CreateGround('sea', { width: 140, height: 140 }, scene);
    sea.material = flatMaterial(scene, 'sea', PALETTE.sea, 0.35);

    const island = MeshBuilder.CreateBox('island', { width: 26, depth: 22, height: 4 }, scene);
    island.position.set(0, 2, 0);
    island.material = flatMaterial(scene, 'island', PALETTE.grass, 0.25);

    const cliff = MeshBuilder.CreateBox('cliff', { width: 27.5, depth: 23.5, height: 4 }, scene);
    cliff.position.set(0, -0.4, 0);
    cliff.material = flatMaterial(scene, 'cliff', PALETTE.cliff, 0.18);

    // Lighthouse (the Old Netlight)
    const tower = MeshBuilder.CreateCylinder('tower', { height: 8, diameterTop: 1.6, diameterBottom: 2.4 }, scene);
    tower.position.set(8, 8, -6);
    tower.material = flatMaterial(scene, 'tower', PALETTE.stone, 0.25);
    const lamp = MeshBuilder.CreateCylinder('lamp', { height: 1.4, diameter: 1.9 }, scene);
    lamp.position.set(8, 12.4, -6);
    lamp.material = flatMaterial(scene, 'lamp', PALETTE.warmLight, 0.65);
    const lhRoof = MeshBuilder.CreateCylinder('lhRoof', { height: 1.6, diameterTop: 0, diameterBottom: 2.4 }, scene);
    lhRoof.position.set(8, 13.6, -6);
    lhRoof.material = flatMaterial(scene, 'lhRoof', PALETTE.roof, 0.25);

    // Cottages along the bay
    [-7, -4, -1].forEach((x, i) => {
      const h = 2.4 + (i % 2) * 0.6;
      const house = MeshBuilder.CreateBox(`house${i}`, { width: 2.6, depth: 2.6, height: h }, scene);
      house.position.set(x, 4 + h / 2, 4);
      house.material = flatMaterial(scene, `house${i}`, PALETTE.wood, 0.25);
      const roof = MeshBuilder.CreateCylinder(`roof${i}`, { height: 1.4, diameterTop: 0, diameterBottom: 3.4, tessellation: 4 }, scene);
      roof.position.set(x, 4 + h + 0.7, 4);
      roof.rotation.y = Math.PI / 4;
      roof.material = flatMaterial(scene, `roof${i}`, PALETTE.roof, 0.25);
    });

    // Beach court
    const court = MeshBuilder.CreateBox('court', { width: 6, depth: 4, height: 0.3 }, scene);
    court.position.set(2, 4.15, -3);
    court.material = flatMaterial(scene, 'court', PALETTE.sand, 0.32);
    const net = MeshBuilder.CreateBox('net', { width: 0.12, depth: 4, height: 1 }, scene);
    net.position.set(2, 4.8, -3);
    net.material = flatMaterial(scene, 'net', PALETTE.stone, 0.45);

    // Sea stacks
    ([[-22, 16, 5], [24, 11, 6], [-17, -20, 7]] as const).forEach(([x, z, h], i) => {
      const stack = MeshBuilder.CreateCylinder(`stack${i}`, { height: h, diameterTop: 1.2, diameterBottom: 2.8, tessellation: 6 }, scene);
      stack.position.set(x, h / 2, z);
      stack.material = flatMaterial(scene, `stack${i}`, PALETTE.cliff, 0.2);
    });
  }

  override enter(): void {
    this.showMenu();
  }

  override update(dt: number): void {
    this.camera.alpha += dt * 0.12;
  }

  private showMenu(): void {
    const items = buildTitleMenu(hasSaveGame());
    if (import.meta.env.DEV) {
      items.push({ id: 'dev-data', label: 'Dev · Validate data', enabled: true, testId: 'title-dev-data' });
    }
    this.ctx.overlay.showMenu(
      'Sturdy Volley',
      items,
      (id) => this.onSelect(id),
      'Ballast Bay · rebuild the storm-worn coast',
    );
  }

  private onSelect(id: string): void {
    switch (id) {
      case 'start':
        this.goTo('NewGame');
        break;
      case 'continue': {
        const save = readSave();
        if (save) {
          setActiveSave(save);
          this.goTo(RESUMABLE_SCENES.has(save.location.sceneKey) ? save.location.sceneKey : 'Farm');
        }
        break;
      }
      case 'settings':
        this.showSettings();
        break;
      case 'credits':
        this.ctx.overlay.showPanel(
          'Credits',
          'Sturdy Volley is an original cozy life sim set in Ballast Bay. All names, art, audio, dialogue, maps, and code are original.',
          () => this.showMenu(),
        );
        break;
      case 'dev-data':
        this.showDataReport();
        break;
    }
  }

  private showSettings(status?: string): void {
    const has = hasSaveGame();
    this.ctx.overlay.showMenu(
      'Settings',
      [
        { id: 'export', label: 'Export save', enabled: has, testId: 'settings-export' },
        { id: 'import', label: 'Import save', enabled: true, testId: 'settings-import' },
        { id: 'delete', label: 'Delete save', enabled: has, testId: 'settings-delete' },
        { id: 'back', label: 'Back', enabled: true, testId: 'settings-back' },
      ],
      (id) => this.onSettings(id),
      status ?? 'Manage your save data',
    );
  }

  private onSettings(id: string): void {
    switch (id) {
      case 'export':
        this.showSettings(downloadSave() ? 'Save exported.' : 'No save to export.');
        break;
      case 'import':
        void pickAndImportSave().then((result) =>
          this.showSettings(result.ok ? 'Save imported.' : `Import failed: ${result.error}`),
        );
        break;
      case 'delete':
        deleteSave();
        clearActiveSave();
        this.showSettings('Save deleted.');
        break;
      case 'back':
        this.showMenu();
        break;
    }
  }

  private showDataReport(): void {
    const rows = getContentReport().map((summary) => ({
      label: `${summary.name} (${summary.count})`,
      ok: summary.ok,
      detail: summary.ok ? undefined : summary.issues.slice(0, 3).join('; '),
    }));
    this.ctx.overlay.showReport('Data validation', rows, () => this.showMenu(), 'dev-data-report');
  }
}
