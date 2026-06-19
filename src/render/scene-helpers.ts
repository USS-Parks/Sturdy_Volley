import {
  Scene,
  Engine,
  Color3,
  Color4,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';

/**
 * Theme 3 ("N64-era low-poly adventure") placeholder palette + render helpers.
 * Jewel-toned diffuse colors, no specular, a touch of emissive to fake the
 * vertex-lit look, warm key light vs. cool ambient, and atmospheric fog —
 * matching the approved art boards so code-drawn placeholders don't clash with
 * the real .glb assets when they land.
 */
export const PALETTE = {
  sky: new Color4(0.46, 0.58, 0.8, 1),
  fog: new Color3(0.52, 0.63, 0.78),
  grass: new Color3(0.25, 0.49, 0.29),
  grassAlt: new Color3(0.29, 0.56, 0.34),
  sea: new Color3(0.16, 0.43, 0.56),
  sand: new Color3(0.85, 0.76, 0.54),
  soil: new Color3(0.42, 0.3, 0.19),
  cliff: new Color3(0.37, 0.34, 0.31),
  wood: new Color3(0.71, 0.46, 0.29),
  roof: new Color3(0.55, 0.25, 0.2),
  stone: new Color3(0.78, 0.78, 0.82),
  warmLight: new Color3(1.0, 0.86, 0.66),
  accent: new Color3(0.5, 0.82, 0.77),
  player: new Color3(0.18, 0.36, 0.54),
  marsh: new Color3(0.22, 0.32, 0.3),
  quarry: new Color3(0.3, 0.25, 0.2),
  interior: new Color3(0.28, 0.22, 0.3),
} as const;

/** Flat, low-spec material with a hint of emissive — reads as vertex-lit. */
export function flatMaterial(scene: Scene, name: string, color: Color3, emissive = 0.22): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = color;
  mat.specularColor = new Color3(0, 0, 0);
  mat.emissiveColor = color.scale(emissive);
  return mat;
}

export function makeScene(engine: Engine, clear: Color4 = PALETTE.sky): Scene {
  const scene = new Scene(engine);
  scene.clearColor = clear.clone();
  return scene;
}

export function addFog(scene: Scene, color: Color3 = PALETTE.fog, density = 0.018): void {
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = color.clone();
  scene.fogDensity = density;
}

/** Fixed three-quarter adventure camera (no user control by default). */
export function addThreeQuarterCamera(
  scene: Scene,
  target: Vector3 = Vector3.Zero(),
  radius = 26,
): ArcRotateCamera {
  const cam = new ArcRotateCamera('cam', -Math.PI / 2 + 0.65, Math.PI / 3.1, radius, target, scene);
  cam.minZ = 0.1;
  cam.fov = 0.8;
  return cam;
}

export function addLights(scene: Scene): { hemi: HemisphericLight; sun: DirectionalLight } {
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.7;
  hemi.diffuse = new Color3(0.88, 0.92, 1.0);
  hemi.groundColor = new Color3(0.3, 0.34, 0.4);

  const sun = new DirectionalLight('sun', new Vector3(-0.4, -0.85, -0.5), scene);
  sun.intensity = 1.15;
  sun.diffuse = PALETTE.warmLight.clone();
  return { hemi, sun };
}
