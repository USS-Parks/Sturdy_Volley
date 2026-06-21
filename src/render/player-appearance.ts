import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  type AbstractMesh,
} from '@babylonjs/core';
import { resolveAppearanceColors, type AppearanceState } from '../engine/appearance';

/**
 * Apply a player {@link AppearanceState} to a graybox capsule (Prompt 060).
 * Recolours the capsule body in place and (re)builds two child sub-meshes — a
 * knit beanie cap and an accent band — so a wardrobe change is immediately
 * visible without rebuilding the scene. Idempotent: calling it again disposes the
 * previous beanie/accent and recolours, so it doubles as the live-update path.
 *
 * The capsule + sub-meshes are the placeholder until the hero rig lands
 * (Prompts 062–063); the swap then reuses the same `AppearanceState`.
 */

function color3(rgb: readonly [number, number, number]): Color3 {
  return new Color3(rgb[0], rgb[1], rgb[2]);
}

function flatMat(scene: Scene, name: string, color: Color3, emissive = 0.32): StandardMaterial {
  const existing = scene.getMaterialByName(name);
  const mat = existing instanceof StandardMaterial ? existing : new StandardMaterial(name, scene);
  mat.diffuseColor = color;
  mat.specularColor = new Color3(0, 0, 0);
  mat.emissiveColor = color.scale(emissive);
  return mat;
}

function disposeByName(scene: Scene, name: string): void {
  scene.getMeshByName(name)?.dispose();
}

export function applyPlayerAppearance(
  scene: Scene,
  mesh: AbstractMesh,
  appearance: AppearanceState,
): void {
  const colors = resolveAppearanceColors(appearance);

  // Body — recolour the capsule's own material in place when possible.
  const bodyMat = mesh.material instanceof StandardMaterial ? mesh.material : null;
  if (bodyMat) {
    bodyMat.diffuseColor = color3(colors.body);
    bodyMat.specularColor = new Color3(0, 0, 0);
    bodyMat.emissiveColor = color3(colors.body).scale(0.35);
  } else {
    mesh.material = flatMat(scene, `${mesh.name}-appearance-body`, color3(colors.body), 0.35);
  }

  // Beanie — a flattened cap at the top of the capsule (1.8 m tall, origin at centre).
  const beanieName = `${mesh.name}-beanie`;
  disposeByName(scene, beanieName);
  const beanie = MeshBuilder.CreateSphere(beanieName, { diameter: 0.56, segments: 8 }, scene);
  beanie.scaling = new Vector3(1, 0.6, 1);
  beanie.parent = mesh;
  beanie.position = new Vector3(0, 0.82, 0);
  beanie.material = flatMat(scene, `${beanieName}-mat`, color3(colors.beanie), 0.3);
  beanie.isPickable = false;

  // Accent — a thin band around the chest (the canonical rust suspenders).
  const accentName = `${mesh.name}-accent`;
  disposeByName(scene, accentName);
  const band = MeshBuilder.CreateTorus(
    accentName,
    { diameter: 0.86, thickness: 0.12, tessellation: 10 },
    scene,
  );
  band.parent = mesh;
  band.position = new Vector3(0, 0.18, 0);
  band.material = flatMat(scene, `${accentName}-mat`, color3(colors.accent), 0.3);
  band.isPickable = false;
}
