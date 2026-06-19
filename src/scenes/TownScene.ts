import { Scene, MeshBuilder, type Color3, type AbstractMesh } from '@babylonjs/core';
import { PlaceScene, type PlaceNav } from './PlaceScene';
import { flatMaterial, PALETTE } from '../render/scene-helpers';

interface TownBuilding {
  id: string;
  label: string;
  position: [number, number];
  width: number;
  depth: number;
  height: number;
  color: Color3;
  roofColor: Color3;
}

const BUILDINGS: TownBuilding[] = [
  { id: 'market-bakery', label: 'Bakery', position: [-12, -4], width: 4, depth: 3.6, height: 3.0, color: PALETTE.wood, roofColor: PALETTE.roof },
  { id: 'market-clinic', label: 'Clinic', position: [-7, -4], width: 4, depth: 3.6, height: 3.0, color: PALETTE.stone, roofColor: PALETTE.roof },
  { id: 'market-library', label: 'Library', position: [-2, -4], width: 4.5, depth: 4, height: 3.4, color: PALETTE.wood, roofColor: PALETTE.roof },
  { id: 'market-gear', label: 'Gear Shop', position: [3, -4], width: 4, depth: 3.6, height: 3.0, color: PALETTE.wood, roofColor: PALETTE.roof },
  { id: 'fishmonger', label: 'Fishmonger', position: [8, -4], width: 4, depth: 3.6, height: 2.8, color: PALETTE.wood, roofColor: PALETTE.sea },
  { id: 'community-hall', label: 'Community Hall', position: [-5, 3], width: 7, depth: 5, height: 4.0, color: PALETTE.stone, roofColor: PALETTE.roof },
  { id: 'schoolhouse', label: 'Schoolhouse', position: [4, 4], width: 5, depth: 4, height: 3.2, color: PALETTE.wood, roofColor: PALETTE.roof },
  { id: 'blacksmith', label: 'Blacksmith', position: [11, 3], width: 4.5, depth: 4, height: 3.0, color: PALETTE.cliff, roofColor: PALETTE.roof },
  { id: 'apartments', label: 'Apartments', position: [-12, 4], width: 4, depth: 4.5, height: 4.0, color: PALETTE.wood, roofColor: PALETTE.roof },
];

/**
 * Ballast Bay — the main town map (Prompt 015, core). Modular low-poly
 * buildings along a market lane, an open community-hall plaza, a harbor with
 * pier, beach access, and a few ambient details (animated flag, market awnings,
 * lantern poles). Doors are placeholder boxes — the open/closed schedule
 * surfaces via labels on the building tooltips since the dialogue + door
 * scene-transition wave is still queued.
 */
export class TownScene extends PlaceScene {
  protected readonly sceneKey = 'Town';
  protected readonly title = 'Ballast Bay';
  protected readonly ground: Color3 = PALETTE.sand;
  protected readonly navs: PlaceNav[] = [
    { id: 'farm', label: 'Back to the farm', testId: 'nav-farm', target: 'Farm' },
    { id: 'interior', label: 'Enter the bakery', testId: 'nav-interior', target: 'Interior' },
    { id: 'beach', label: 'Driftwood Beach', testId: 'nav-beach', target: 'Beach' },
  ];

  private flag: AbstractMesh | null = null;
  private flagAge = 0;

  protected override decorate(scene: Scene): void {
    this.buildMarketLane(scene);
    this.buildBuildings(scene);
    this.buildHarbor(scene);
    this.buildLanternPoles(scene);
  }

  private buildMarketLane(scene: Scene): void {
    const lane = MeshBuilder.CreateGround('market-lane', { width: 36, height: 4.2 }, scene);
    lane.position.set(-2, 0.01, 0);
    lane.material = flatMaterial(scene, 'market-lane', PALETTE.cliff, 0.18);
  }

  private buildBuildings(scene: Scene): void {
    for (const b of BUILDINGS) {
      const [x, z] = b.position;
      const body = MeshBuilder.CreateBox(`town-${b.id}-body`, {
        width: b.width,
        depth: b.depth,
        height: b.height,
      }, scene);
      body.position.set(x, b.height / 2, z);
      body.material = flatMaterial(scene, `mat-${b.id}-body`, b.color, 0.22);
      const roof = MeshBuilder.CreateCylinder(`town-${b.id}-roof`, {
        height: 1.4,
        diameterTop: 0,
        diameterBottom: Math.max(b.width, b.depth) + 0.6,
        tessellation: 4,
      }, scene);
      roof.position.set(x, b.height + 0.7, z);
      roof.rotation.y = Math.PI / 4;
      roof.material = flatMaterial(scene, `mat-${b.id}-roof`, b.roofColor, 0.22);
      const door = MeshBuilder.CreateBox(`town-${b.id}-door`, { width: 0.9, depth: 0.1, height: 1.6 }, scene);
      door.position.set(x, 0.8, z + b.depth / 2 + 0.05);
      door.material = flatMaterial(scene, `mat-${b.id}-door`, PALETTE.interior, 0.22);
    }
  }

  private buildHarbor(scene: Scene): void {
    const water = MeshBuilder.CreateGround('harbor-water', { width: 40, height: 16 }, scene);
    water.position.set(0, 0.02, -16);
    water.material = flatMaterial(scene, 'harbor-water', PALETTE.sea, 0.32);

    const pier = MeshBuilder.CreateBox('harbor-pier', { width: 12, depth: 1.6, height: 0.4 }, scene);
    pier.position.set(0, 0.2, -10);
    pier.material = flatMaterial(scene, 'harbor-pier', PALETTE.wood, 0.22);

    const boatA = MeshBuilder.CreateBox('harbor-boatA', { width: 3, depth: 1.2, height: 0.7 }, scene);
    boatA.position.set(-4, 0.45, -13);
    boatA.material = flatMaterial(scene, 'boat-a', PALETTE.wood, 0.22);

    const boatB = MeshBuilder.CreateBox('harbor-boatB', { width: 3.5, depth: 1.4, height: 0.7 }, scene);
    boatB.position.set(4, 0.45, -14);
    boatB.material = flatMaterial(scene, 'boat-b', PALETTE.wood, 0.22);

    const flagPole = MeshBuilder.CreateCylinder('flag-pole', { height: 5, diameter: 0.2 }, scene);
    flagPole.position.set(-5, 2.5, 3);
    flagPole.material = flatMaterial(scene, 'flag-pole', PALETTE.cliff, 0.22);
    const flag = MeshBuilder.CreateBox('flag', { width: 1.4, depth: 0.05, height: 0.8 }, scene);
    flag.position.set(-4.2, 4.5, 3);
    flag.material = flatMaterial(scene, 'flag', PALETTE.accent, 0.3);
    this.flag = flag;
  }

  private buildLanternPoles(scene: Scene): void {
    const offsets: Array<[number, number]> = [
      [-14, 0], [-9, 0], [-3, 0], [3, 0], [9, 0], [14, 0],
    ];
    offsets.forEach(([x, z], i) => {
      const pole = MeshBuilder.CreateCylinder(`lantern-pole-${i}`, { height: 3, diameter: 0.18 }, scene);
      pole.position.set(x, 1.5, z);
      pole.material = flatMaterial(scene, `lantern-pole-${i}`, PALETTE.cliff, 0.18);
      const lamp = MeshBuilder.CreateSphere(`lantern-lamp-${i}`, { diameter: 0.55 }, scene);
      lamp.position.set(x, 3.05, z);
      lamp.material = flatMaterial(scene, `lantern-lamp-${i}`, PALETTE.warmLight, 0.45);
    });
  }

  override update(dt: number): void {
    super.update(dt);
    if (this.flag) {
      this.flagAge += dt;
      this.flag.rotation.y = Math.sin(this.flagAge * 1.6) * 0.25;
      this.flag.position.y = 4.5 + Math.sin(this.flagAge * 2.2) * 0.05;
    }
  }
}
