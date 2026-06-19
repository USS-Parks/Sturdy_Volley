import {
  Scene,
  MeshBuilder,
  Vector3,
  type AbstractMesh,
} from '@babylonjs/core';
import { flatMaterial, PALETTE } from './scene-helpers';

/**
 * Representative graybox humanoid NPC (VS-A4). Capsule torso + sphere head +
 * thin arm/leg boxes, all parented to the torso so a single position write
 * moves the whole rig. Per §0.10 — primitives only, one material per limb,
 * 1u = 1m scale (~1.8 m total height matches the player capsule).
 */
export interface NpcGrayboxHandles {
  /** The root mesh — moving this moves the whole rig. */
  root: AbstractMesh;
  /** All sub-meshes, for disposal. */
  parts: AbstractMesh[];
}

export interface NpcGrayboxConfig {
  scene: Scene;
  npcId: string;
  /** Base ground-foot position. */
  position: { x: number; y?: number; z: number };
  /** Body diffuse color — distinguishes one NPC from another. */
  bodyColor?: typeof PALETTE.accent;
  headColor?: typeof PALETTE.accent;
}

export function buildNpcGraybox(cfg: NpcGrayboxConfig): NpcGrayboxHandles {
  const groundY = cfg.position.y ?? 0;
  const bodyColor = cfg.bodyColor ?? PALETTE.accent;
  const headColor = cfg.headColor ?? PALETTE.warmLight;

  // Torso = capsule, anchored so the bottom touches the ground.
  const torso = MeshBuilder.CreateCapsule(
    `npc-${cfg.npcId}-torso`,
    { height: 1.2, radius: 0.34 },
    cfg.scene,
  );
  torso.position.set(cfg.position.x, groundY + 0.85, cfg.position.z);
  torso.material = flatMaterial(cfg.scene, `npc-${cfg.npcId}-torso`, bodyColor, 0.3);
  torso.checkCollisions = false;

  const head = MeshBuilder.CreateSphere(
    `npc-${cfg.npcId}-head`,
    { diameter: 0.55 },
    cfg.scene,
  );
  head.position.set(0, 0.95, 0);
  head.material = flatMaterial(cfg.scene, `npc-${cfg.npcId}-head`, headColor, 0.3);
  head.parent = torso;

  const armL = MeshBuilder.CreateBox(
    `npc-${cfg.npcId}-armL`,
    { width: 0.18, depth: 0.18, height: 0.8 },
    cfg.scene,
  );
  armL.position.set(-0.42, 0.0, 0);
  armL.material = flatMaterial(cfg.scene, `npc-${cfg.npcId}-armL`, bodyColor, 0.3);
  armL.parent = torso;

  const armR = MeshBuilder.CreateBox(
    `npc-${cfg.npcId}-armR`,
    { width: 0.18, depth: 0.18, height: 0.8 },
    cfg.scene,
  );
  armR.position.set(0.42, 0.0, 0);
  armR.material = flatMaterial(cfg.scene, `npc-${cfg.npcId}-armR`, bodyColor, 0.3);
  armR.parent = torso;

  const legL = MeshBuilder.CreateBox(
    `npc-${cfg.npcId}-legL`,
    { width: 0.22, depth: 0.22, height: 0.85 },
    cfg.scene,
  );
  legL.position.set(-0.18, -1.0, 0);
  legL.material = flatMaterial(cfg.scene, `npc-${cfg.npcId}-legL`, PALETTE.wood, 0.22);
  legL.parent = torso;

  const legR = MeshBuilder.CreateBox(
    `npc-${cfg.npcId}-legR`,
    { width: 0.22, depth: 0.22, height: 0.85 },
    cfg.scene,
  );
  legR.position.set(0.18, -1.0, 0);
  legR.material = flatMaterial(cfg.scene, `npc-${cfg.npcId}-legR`, PALETTE.wood, 0.22);
  legR.parent = torso;

  return { root: torso, parts: [torso, head, armL, armR, legL, legR] };
}

/** Face the root mesh toward a target XZ point by rotating around Y. */
export function faceTo(root: AbstractMesh, target: Vector3 | { x: number; z: number }): void {
  const dx = target.x - root.position.x;
  const dz = target.z - root.position.z;
  if (dx * dx + dz * dz < 1e-4) return;
  root.rotation.y = Math.atan2(dx, dz);
}

export function disposeNpcGraybox(handles: NpcGrayboxHandles): void {
  for (const part of handles.parts) part.dispose();
}
