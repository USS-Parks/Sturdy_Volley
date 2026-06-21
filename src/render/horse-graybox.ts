/**
 * Rideable-horse graybox (master Prompt 044 → shared in 048). A representative
 * low-poly horse parented to `root` (placed at the feet): faceted body + neck +
 * head + four legs + tail + a saddle marker at the family's mount-anchor socket.
 * Withers ≈ 1.6 m, OoT-era panel-11 model economy (`sv_theme_03_004_shape_language.png`).
 * Primitives + `flatMaterial` only (§0.9) so a future `.glb` swaps this one helper
 * without touching the motor / camera / mount-anchor. Returns the part meshes so
 * callers can register them (debug layers) or hand them to the camera's ignore set.
 */
import { MeshBuilder, Vector3, type Mesh, type Scene, type TransformNode } from '@babylonjs/core';
import { flatMaterial, PALETTE } from './scene-helpers';
import type { AnimalFamily } from '../engine/animal-families';

export function buildHorseGraybox(
  scene: Scene,
  root: TransformNode,
  family: AnimalFamily,
  namePrefix = 'horse',
): Mesh[] {
  const out: Mesh[] = [];
  const coat = PALETTE.wood; // warm bay/dun brown
  const part = (
    name: string,
    opts: { w: number; h: number; d: number },
    pos: Vector3,
    color = coat,
    emissive = 0.28,
  ): void => {
    const m = MeshBuilder.CreateBox(`${namePrefix}-${name}`, { width: opts.w, height: opts.h, depth: opts.d }, scene);
    m.parent = root;
    m.position.copyFrom(pos);
    m.material = flatMaterial(scene, `${namePrefix}-${name}`, color, emissive);
    m.isPickable = false;
    out.push(m);
  };
  // Barrel (body): centre ≈ 1.1 m, length 2.0 m.
  part('body', { w: 0.7, h: 0.9, d: 2.0 }, new Vector3(0, 1.1, 0));
  // Neck (angled up-forward) + head.
  part('neck', { w: 0.4, h: 0.9, d: 0.5 }, new Vector3(0, 1.55, 1.05));
  part('head', { w: 0.35, h: 0.45, d: 0.7 }, new Vector3(0, 1.85, 1.45));
  // Four legs (feet at y≈0).
  const legY = 0.5;
  for (const [lx, lz, tag] of [[-0.25, 0.7, 'fl'], [0.25, 0.7, 'fr'], [-0.25, -0.7, 'bl'], [0.25, -0.7, 'br']] as const) {
    part(`leg-${tag}`, { w: 0.18, h: 1.0, d: 0.18 }, new Vector3(lx, legY, lz));
  }
  // Tail.
  part('tail', { w: 0.16, h: 0.5, d: 0.3 }, new Vector3(0, 1.15, -1.1));
  // Saddle marker at the mount anchor (leather red-brown).
  const anchor = family.mountAnchor ?? { x: 0, y: 1.5, z: 0 };
  part('saddle', { w: 0.6, h: 0.25, d: 0.7 }, new Vector3(anchor.x, anchor.y + 0.05, anchor.z), PALETTE.roof, 0.25);
  return out;
}
