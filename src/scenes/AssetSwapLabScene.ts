import {
  Scene,
  MeshBuilder,
  Vector3,
  type Mesh,
} from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, addThreeQuarterCamera, PALETTE } from '../render/scene-helpers';
import {
  createSwappable,
  applySwap,
  revertSwap,
  activeMesh,
  semanticSnapshot,
  semanticUnchanged,
  type SwappableEntity,
  type SemanticLayer,
} from '../render/asset-factory';
import { ASSET_FIXTURES } from '../render/asset-fixtures';
import type { AssetDescriptor } from '../render/asset-contract';
import { createFacetedBox, metadataFor } from '../render/gray-models/primitives';
import {
  grayModelDefinition,
  type GrayModelDefinition,
} from '../render/gray-models/registry';

const FIXTURE_MODELS: Readonly<Record<string, string>> = {
  humanoid: 'character-player-proxy',
  animal: 'animal-dog-proxy',
  flora: 'flora-rock-cluster',
  building: 'building-village-house',
  prop: 'prop-crate',
};

/**
 * Asset-swap proving ground (WEF-11b, master Prompt 051). Spawns the five
 * reference fixtures (humanoid, animal, flora, building, prop) through the
 * source-traceable gray-model core, then swaps each one's render geometry for a validated asset
 * entities, then swaps each one's render geometry for a validated asset
 * stand-in via the swap factory — proving the entity's anchors / collision /
 * navigation / save identity survive the swap, the graybox is retained as a
 * fallback, the swap is reversible, and a non-conformant asset is refused.
 *
 * The asset stand-in is a distinct graybox (no real `.glb` exists yet); a real
 * `.glb` loader replaces the `buildAsset` callback without touching the factory.
 *
 * Reachable via the Title "Dev · Asset Swap Lab" item or `?scene=AssetSwapLab`.
 */

interface LabEntity {
  entity: SwappableEntity<Mesh>;
  family: AssetDescriptor['family'];
  manifest: AssetDescriptor;
  buildAsset: () => Mesh;
  model: GrayModelDefinition;
}

export class AssetSwapLabScene extends GameScene {
  private readonly entities = new Map<string, LabEntity>();

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    this.scene = scene;
    addFog(scene, PALETTE.fog, 0.006);
    addLights(scene);
    addThreeQuarterCamera(scene, new Vector3(0, 0, 0), 24);

    const ground = MeshBuilder.CreateGround('swap-ground', { width: 40, height: 24 }, scene);
    ground.material = flatMaterial(scene, 'swap-ground', PALETTE.grass, 0.2);
    ground.isPickable = false;

    ASSET_FIXTURES.forEach((fixture, i) => this.spawn(scene, fixture.key, fixture.manifest, i));
    return scene;
  }

  override enter(): void {
    this.installDebugApi();
  }

  override dispose(): void {
    delete (window as unknown as { sturdyVolleySwap?: unknown }).sturdyVolleySwap;
    super.dispose();
  }

  private spawn(scene: Scene, key: string, manifest: AssetDescriptor, index: number): void {
    const x = -16 + index * 8;
    const semantic: SemanticLayer = {
      anchorIds: [`${key}-anchor-a`, `${key}-anchor-b`],
      collisionId: `${key}-collision`,
      navId: `${key}-nav`,
    };

    const modelId = FIXTURE_MODELS[key];
    const model = modelId ? grayModelDefinition(modelId) : undefined;
    if (!model) throw new Error(`Missing gray-model registry entry for fixture: ${key}`);

    // Source-traceable, base-origin graybox render mesh. Semantic collision/nav
    // remains in the entity layer and never moves into render geometry.
    const graybox = createFacetedBox(scene, model.dimensions, {
      name: `graybox-${key}`,
      material: model.policy === 'visual' ? 'debugVisual' : 'debugFoundation',
      metadata: metadataFor(model),
    });
    graybox.position.set(x, 0, 0);

    // Asset stand-in builder (a visibly distinct mesh at the same anchor). A real
    // `.glb` loader plugs in here without changing the factory contract.
    const buildAsset = (): Mesh => {
      const asset = MeshBuilder.CreateCapsule(`asset-${key}`, { height: 1.8, radius: 0.6 }, scene);
      asset.position.set(x, 0.9, 0);
      asset.material = flatMaterial(scene, `asset-${key}`, PALETTE.accent, 0.45);
      return asset;
    };

    const entity = createSwappable<Mesh>({ id: key, saveId: `save-${key}`, semantic, graybox });
    this.entities.set(key, { entity, family: manifest.family, manifest, buildAsset, model });
    this.syncVisibility(key);
  }

  private syncVisibility(key: string): void {
    const le = this.entities.get(key);
    if (!le) return;
    le.entity.graybox.setEnabled(le.entity.active === 'graybox');
    if (le.entity.asset) le.entity.asset.setEnabled(le.entity.active === 'asset');
  }

  private installDebugApi(): void {
    const api = {
      meshCount: (): number => this.scene.meshes.length,
      keys: (): string[] => [...this.entities.keys()],
      state: (key: string): { active: string; meshName: string; saveId: string; anchorIds: string[]; collisionId: string; navId: string; family: string; modelId: string; dimensions: readonly number[]; sourceRefs: readonly string[]; policy: string } | null => {
        const le = this.entities.get(key);
        if (!le) return null;
        return {
          active: le.entity.active,
          meshName: activeMesh(le.entity).name,
          saveId: le.entity.saveId,
          anchorIds: [...le.entity.semantic.anchorIds],
          collisionId: le.entity.semantic.collisionId,
          navId: le.entity.semantic.navId,
          family: le.family,
          modelId: le.model.id,
          dimensions: le.model.dimensions,
          sourceRefs: le.model.sourceRefs,
          policy: le.model.policy,
        };
      },
      /** Swap to the validated asset; returns ok + whether the semantic layer held. */
      swap: (key: string): { ok: boolean; issues: string[]; semanticHeld: boolean } => {
        const le = this.entities.get(key);
        if (!le) return { ok: false, issues: ['unknown'], semanticHeld: false };
        const before = semanticSnapshot(le.entity);
        const r = applySwap(le.entity, le.manifest, le.buildAsset);
        this.syncVisibility(key);
        return { ok: r.ok, issues: r.issues.map((i) => i.code), semanticHeld: semanticUnchanged(before, semanticSnapshot(le.entity)) };
      },
      revert: (key: string): boolean => {
        const le = this.entities.get(key);
        if (!le) return false;
        revertSwap(le.entity);
        this.syncVisibility(key);
        return le.entity.active === 'graybox';
      },
      /** Attempt a deliberately non-conformant swap (must be refused). */
      swapBad: (key: string): { ok: boolean; active: string } => {
        const le = this.entities.get(key);
        if (!le) return { ok: false, active: 'none' };
        // A deliberately over-budget manifest must be refused (graybox stays).
        const bad = { ...le.manifest, triangleCount: 999999 };
        const r = applySwap(le.entity, bad, le.buildAsset);
        this.syncVisibility(key);
        return { ok: r.ok, active: le.entity.active };
      },
    };
    (window as unknown as { sturdyVolleySwap?: typeof api }).sturdyVolleySwap = api;
  }
}
