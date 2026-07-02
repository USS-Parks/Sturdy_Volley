import { Color3, StandardMaterial, type Scene } from '@babylonjs/core';

export const GRAY_MATERIAL_SPECS = {
  neutral: { color: [0.58, 0.6, 0.62], emissive: 0.08 },
  warm: { color: [0.62, 0.55, 0.47], emissive: 0.09 },
  cool: { color: [0.45, 0.53, 0.57], emissive: 0.08 },
  dark: { color: [0.31, 0.33, 0.35], emissive: 0.06 },
  light: { color: [0.72, 0.73, 0.71], emissive: 0.1 },
  debugFoundation: { color: [0.32, 0.55, 0.72], emissive: 0.12 },
  debugVisual: { color: [0.62, 0.7, 0.45], emissive: 0.12 },
} as const;

export type GrayMaterialKey = keyof typeof GRAY_MATERIAL_SPECS;

/** Scene-shared, low-spec material for honest silhouette and proportion review. */
export function grayMaterial(scene: Scene, key: GrayMaterialKey): StandardMaterial {
  const name = `gray-material-${key}`;
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) return existing;

  const spec = GRAY_MATERIAL_SPECS[key];
  const color = new Color3(...spec.color);
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = Color3.Black();
  material.emissiveColor = color.scale(spec.emissive);
  material.roughness = 1;
  return material;
}
