import { Scene, ArcRotateCamera, MeshBuilder, Vector3 } from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, PALETTE } from '../render/scene-helpers';
import { buildTitleMenu } from '../ui/menuModel';
import { hasSaveGame, readSave, deleteSave } from '../engine/save';
import { setActiveSave, clearActiveSave } from '../engine/gameState';
import { downloadSave, pickAndImportSave } from '../engine/saveTransfer';
import { getContentReport } from '../data/content';
import { getWorldMapReport } from '../world/sample-map';
import { getAtlasReport } from '../world/atlas';

const RESUMABLE_SCENES = new Set(['Farm', 'Town', 'Interior', 'Beach', 'Mine']);

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

    // Harbor market stall
    const stall = MeshBuilder.CreateBox('stall', { width: 3, depth: 2, height: 1.4 }, scene);
    stall.position.set(2, 4.7, -3);
    stall.material = flatMaterial(scene, 'stall', PALETTE.wood, 0.28);
    const canopy = MeshBuilder.CreateBox('canopy', { width: 3.4, depth: 2.4, height: 0.3 }, scene);
    canopy.position.set(2, 5.55, -3);
    canopy.material = flatMaterial(scene, 'canopy', PALETTE.accent, 0.4);

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
      items.push({ id: 'dev-camera-lab', label: 'Dev · Camera Lab', enabled: true, testId: 'title-dev-camera-lab' });
      items.push({ id: 'dev-streaming-lab', label: 'Dev · Streaming Lab', enabled: true, testId: 'title-dev-streaming-lab' });
      items.push({ id: 'dev-interior-lab', label: 'Dev · Interior Lab', enabled: true, testId: 'title-dev-interior-lab' });
      items.push({ id: 'dev-nav-lab', label: 'Dev · Nav Lab', enabled: true, testId: 'title-dev-nav-lab' });
      items.push({ id: 'dev-fauna-lab', label: 'Dev · Fauna Lab', enabled: true, testId: 'title-dev-fauna-lab' });
      items.push({ id: 'dev-wild-lab', label: 'Dev · Wild Lab', enabled: true, testId: 'title-dev-wild-lab' });
      items.push({ id: 'dev-mount-lab', label: 'Dev · Mount Lab', enabled: true, testId: 'title-dev-mount-lab' });
      items.push({ id: 'dev-flora-lab', label: 'Dev · Flora Lab', enabled: true, testId: 'title-dev-flora-lab' });
      items.push({ id: 'dev-breakpoint-farm', label: 'Dev · Breakpoint Farm', enabled: true, testId: 'title-dev-breakpoint-farm' });
      items.push({ id: 'dev-farmhouse', label: 'Dev · Farmhouse', enabled: true, testId: 'title-dev-farmhouse' });
      items.push({ id: 'dev-ballast-bay-town', label: 'Dev · Ballast Bay Town', enabled: true, testId: 'title-dev-ballast-bay-town' });
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
      case 'dev-camera-lab':
        this.goTo('CameraLab');
        break;
      case 'dev-streaming-lab':
        this.goTo('StreamingLab');
        break;
      case 'dev-interior-lab':
        this.goTo('InteriorLab');
        break;
      case 'dev-nav-lab':
        this.goTo('NavLab');
        break;
      case 'dev-fauna-lab':
        this.goTo('FaunaLab');
        break;
      case 'dev-wild-lab':
        this.goTo('WildLab');
        break;
      case 'dev-mount-lab':
        this.goTo('MountLab');
        break;
      case 'dev-flora-lab':
        this.goTo('FloraLab');
        break;
      case 'dev-breakpoint-farm':
        this.goTo('BreakpointFarm');
        break;
      case 'dev-farmhouse':
        this.goTo('FarmhouseInterior');
        break;
      case 'dev-ballast-bay-town':
        this.goTo('BallastBayTown');
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
    const contentRows = getContentReport().map((summary) => ({
      label: `${summary.name} (${summary.count})`,
      ok: summary.ok,
      detail: summary.ok ? undefined : summary.issues.slice(0, 3).join('; '),
    }));
    // World-map documents validate against the WEF-06a map schema (Prompt 037).
    const mapRows = getWorldMapReport().map((summary) => ({
      label: `${summary.name} (${summary.count})`,
      ok: summary.ok,
      detail: summary.ok ? undefined : summary.issues.slice(0, 3).join('; '),
    }));
    // The world atlas validates against the WEF-06b structural invariants (Prompt 038).
    const atlasRows = getAtlasReport().map((summary) => ({
      label: `${summary.name} (${summary.count})`,
      ok: summary.ok,
      detail: summary.ok ? undefined : summary.issues.slice(0, 3).join('; '),
    }));
    this.ctx.overlay.showReport('Data validation', [...contentRows, ...mapRows, ...atlasRows], () => this.showMenu(), 'dev-data-report');
  }
}
