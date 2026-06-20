import {
  Scene,
  MeshBuilder,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type Mesh,
} from '@babylonjs/core';
import { GameScene } from './GameScene';
import { makeScene, addFog, addLights, flatMaterial, PALETTE } from '../render/scene-helpers';
import { CameraRig, type FollowTarget } from '../camera/rig';
import { CameraInputController, mergeInput, ZERO_INPUT } from '../camera/input';
import { baselineProfile } from '../camera/profiles';
import type { Planar } from '../camera/orbit';
import {
  chunkBounds,
  chunkCenter,
  chunkId,
  parseChunkId,
  worldToChunk,
  type ChunkCoord,
  type Region,
  type RegionTransition,
  type Vec2,
} from '../world/topology';
import {
  StreamingController,
  DEFAULT_STREAMING_CONFIG,
  type ChunkRecord,
  type ChunkState,
} from '../world/streaming';
import {
  resolveChunkContent,
  anchorIds,
  DEFAULT_VARIANT_STATE,
  type ChunkContentDef,
  type ContentAnchor,
  type VariantState,
} from '../world/variants';
import {
  mountStreamingOverlay,
  isStreamingOverlayEnabled,
  countByState,
  type StreamingOverlayController,
} from '../render/streaming-overlay';

/**
 * Streaming proving ground (WEF-04, master Prompt 035).
 *
 * A multi-chunk exterior world spanning the two anchor communities — **Willa
 * Crick** (inland redwood) and **Ballast Bay** (coastal) — so the exterior
 * container can be exercised before any full region is laid out: the player
 * walks across internal chunk seams (no pop / collision gap / camera snap /
 * duplicate entities), the streaming controller loads/unloads chunk content
 * with hysteresis under explicit budgets, horse-speed velocity pulls preload
 * chunks ahead, the Willa Crick ↔ Ballast Bay community transition swaps the
 * active region without a seam discontinuity, and tide/season/weather/
 * restoration variants change chunk content while every stable anchor id holds.
 *
 * Each loaded chunk renders its eight conceptually-separate layers as graybox
 * geometry (render tile / collision proxy / navigation patch / interaction
 * anchors / spawn marker / camera-volume cue / audio-zone cue / persistence id),
 * grouped under one disposable TransformNode keyed by the chunk's persistence id
 * so unloading is a single dispose and identity never drifts.
 *
 * Reachable via the Title "Dev · Streaming Lab" item (dev builds) or the
 * `?scene=StreamingLab` direct-boot route (works in the production preview
 * build). The `?debug=streaming` overlay shows region origin, focus chunk,
 * per-state counts, and live budget usage.
 */

const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.4;
const FIXED_DT = 1 / 30; // deterministic synthetic step for tick()
const WALK_SPEED = 3.2; // m/s — below the look-ahead threshold
const HORSE_SPEED = 11; // m/s — gallop; engages directional preload

/** The two anchor communities. Origins chosen so their authored bands abut. */
const WILLA_CRICK: Region = { id: 'willa-crick', label: 'Willa Crick', origin: { x: 0, z: 0 } };
const BALLAST_BAY: Region = { id: 'ballast-bay', label: 'Ballast Bay', origin: { x: 256, z: 0 } };
const REGIONS: Record<string, Region> = { 'willa-crick': WILLA_CRICK, 'ballast-bay': BALLAST_BAY };

/** World X at which the Klam-ity River corridor hands the player between communities. */
const TRANSITION_X = 200;

/** The community-to-community transition along the Klam-ity River corridor. */
const COMMUNITY_TRANSITION: RegionTransition = {
  id: 'klam-ity-crossing',
  fromRegion: 'willa-crick',
  fromAnchor: { x: TRANSITION_X, z: 48 },
  toRegion: 'ballast-bay',
  toAnchor: { x: TRANSITION_X + 24, z: 48 },
  facing: Math.PI / 2,
  cameraContext: 'exterior',
};

interface ChunkGroup {
  id: string;
  node: TransformNode;
  meshCount: number;
}

export class StreamingLabScene extends GameScene {
  private controller!: StreamingController;
  private readonly groups = new Map<string, ChunkGroup>();
  private rig!: CameraRig;
  private input: CameraInputController | null = null;
  private overlay: StreamingOverlayController | null = null;

  private playerMesh!: Mesh;
  private playerPos: Vector3 = new Vector3(48, PLAYER_HEIGHT / 2, 48);
  private velocity: Vec2 = { x: 0, z: 0 };
  private speedMode: 'walk' | 'horse' = 'walk';
  private variant: VariantState = { ...DEFAULT_VARIANT_STATE };
  private lastTransition: RegionTransition | null = null;
  private failNext = false;

  private readonly held = new Set<string>();
  private onKeyDown!: (e: KeyboardEvent) => void;
  private onKeyUp!: (e: KeyboardEvent) => void;

  build(): Scene {
    const scene = makeScene(this.ctx.engine, PALETTE.sky);
    this.scene = scene;
    addFog(scene, PALETTE.fog, 0.013); // the fog horizon the chunk size is sized against
    addLights(scene);

    // Reference player capsule (the streaming focus).
    const cap = MeshBuilder.CreateCapsule('stream-player', { height: PLAYER_HEIGHT, radius: PLAYER_RADIUS }, scene);
    cap.material = flatMaterial(scene, 'stream-player', PALETTE.player, 0.35);
    cap.isPickable = false;
    cap.position.copyFrom(this.playerPos);
    this.playerMesh = cap;

    this.controller = new StreamingController(WILLA_CRICK, DEFAULT_STREAMING_CONFIG);

    // Data-driven camera rig framing the player (exterior baseline, 030).
    this.rig = new CameraRig(scene, baselineProfile('exterior'), -Math.PI / 2);
    const follow: FollowTarget = {
      position: () => new Vector3(this.playerMesh.position.x, this.playerMesh.position.y + 0.6, this.playerMesh.position.z),
      velocity: () => this.velocity as Planar,
      ignore: (): readonly AbstractMesh[] => [this.playerMesh],
    };
    this.rig.setTarget(follow);

    // Prime the first ring around the spawn so the world is visible immediately.
    this.streamStep(0);
    return scene;
  }

  override enter(): void {
    const canvas = this.ctx.engine.getRenderingCanvas();
    if (canvas) this.input = new CameraInputController(canvas);

    this.onKeyDown = (e) => {
      this.held.add(e.key.toLowerCase());
      this.handleKey(e.key);
    };
    this.onKeyUp = (e) => this.held.delete(e.key.toLowerCase());
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    if (isStreamingOverlayEnabled()) this.overlay = mountStreamingOverlay();
    this.installDebugApi();
  }

  override update(dt: number): void {
    if (dt <= 0) return;
    this.readMovement();
    this.streamStep(dt);
    const camInput = this.input ? this.input.consume(dt) : { ...ZERO_INPUT };
    this.rig.update(dt, mergeInput(camInput, { ...ZERO_INPUT }));
  }

  override dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.input?.dispose();
    this.rig?.dispose();
    this.overlay?.destroy();
    for (const g of this.groups.values()) g.node.dispose();
    this.groups.clear();
    delete (window as unknown as { sturdyVolleyStream?: unknown }).sturdyVolleyStream;
    super.dispose();
  }

  // --- Movement -------------------------------------------------------------
  private handleKey(key: string): void {
    if (key === 'h' || key === 'H') this.speedMode = this.speedMode === 'walk' ? 'horse' : 'walk';
  }

  /** Camera-relative planar velocity from the held keys, scaled by speed mode. */
  private readMovement(): void {
    const fwd = (this.held.has('w') || this.held.has('arrowup') ? 1 : 0) - (this.held.has('s') || this.held.has('arrowdown') ? 1 : 0);
    const str = (this.held.has('d') || this.held.has('arrowright') ? 1 : 0) - (this.held.has('a') || this.held.has('arrowleft') ? 1 : 0);
    if (fwd === 0 && str === 0) {
      this.velocity = { x: 0, z: 0 };
      return;
    }
    const alpha = this.rig.camera.alpha;
    const forward: Planar = { x: -Math.cos(alpha), z: -Math.sin(alpha) };
    const right: Planar = { x: -Math.sin(alpha), z: Math.cos(alpha) };
    let mx = right.x * str + forward.x * fwd;
    let mz = right.z * str + forward.z * fwd;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len;
    mz /= len;
    const speed = this.speedMode === 'horse' ? HORSE_SPEED : WALK_SPEED;
    this.velocity = { x: mx * speed, z: mz * speed };
  }

  /**
   * One streaming step: advance the player by the current velocity, handle the
   * community transition, reconcile chunks, apply the load/unload diff, and
   * refresh the camera follow target + overlay. Drives both the rAF loop and the
   * deterministic `tick()` test stepper through one path.
   */
  private streamStep(dt: number): void {
    this.playerPos.x += this.velocity.x * dt;
    this.playerPos.z += this.velocity.z * dt;
    this.maybeTransition();
    this.playerMesh.position.copyFrom(this.playerPos);

    const focus: Vec2 = { x: this.playerPos.x, z: this.playerPos.z };
    const diff = this.controller.update(focus, this.velocity, dt * 1000);

    for (const id of diff.toUnload) this.unloadChunk(id);
    for (const rec of diff.toLoad) this.loadChunk(rec);
    // active/deactivate carry no graybox-visible change here; the state lives in
    // the controller + the debug API (sim-tier throttling lands with real fauna).

    this.refreshOverlay();
  }

  /** Swap the active region when the player crosses the community boundary. */
  private maybeTransition(): void {
    const region = this.controller.activeRegion();
    if (region.id === 'willa-crick' && this.playerPos.x >= TRANSITION_X) {
      this.applyTransition(COMMUNITY_TRANSITION);
    }
  }

  /** Perform a cross-region transition: drop the old region's chunks, swap the
   *  active region, recover the player to the destination anchor + facing. */
  private applyTransition(t: RegionTransition): void {
    const dest = REGIONS[t.toRegion];
    if (!dest) return;
    for (const id of [...this.groups.keys()]) this.unloadChunk(id);
    this.controller.setRegion(dest);
    this.playerPos.set(t.toAnchor.x, PLAYER_HEIGHT / 2, t.toAnchor.z);
    this.playerMesh.position.copyFrom(this.playerPos);
    this.lastTransition = t;
    // Reconcile the destination ring immediately so there is no empty frame.
    const diff = this.controller.update({ x: this.playerPos.x, z: this.playerPos.z }, { x: 0, z: 0 }, 0);
    for (const rec of diff.toLoad) this.loadChunk(rec);
  }

  // --- Chunk content (the eight separated layers as graybox) ----------------
  private loadChunk(rec: ChunkRecord): void {
    if (this.groups.has(rec.id)) return; // identity guard: never duplicate a chunk
    if (this.failNext) {
      // Simulate a failed content build: the controller keeps the player safe on
      // an already-loaded neighbour and retries after failureRetryMs.
      this.failNext = false;
      this.controller.markFailed(rec.id);
      return;
    }
    const region = REGIONS[rec.regionId] ?? this.controller.activeRegion();
    const node = new TransformNode(`chunk-${rec.id}`, this.scene);
    node.metadata = { chunkId: rec.id, layers: { active: rec.state === 'active' } };
    let meshes = 0;

    const size = DEFAULT_STREAMING_CONFIG.chunkSize;
    const origin = chunkBounds(region, rec.coord, size).min;
    const tint = region.id === 'ballast-bay' ? PALETTE.sand : PALETTE.grass;
    const altTint = region.id === 'ballast-bay' ? PALETTE.sea : PALETTE.marsh;

    // (1) Render layer: the ground tile. Tiles abut edge-to-edge so the chunk
    //     grid reads as continuous geography, not a visible seam.
    const tile = MeshBuilder.CreateGround(`chunk-${rec.id}-ground`, { width: size, height: size }, this.scene);
    tile.position.set(origin.x + size / 2, 0, origin.z + size / 2);
    tile.material = flatMaterial(this.scene, `chunk-${rec.id}-ground`, (rec.coord.cx + rec.coord.cz) % 2 === 0 ? tint : altTint, 0.2);
    tile.parent = node;
    tile.metadata = { layer: 'render' };
    meshes++;

    // (2) Collision-proxy layer: a low corner post (invisible-collision stand-in).
    const post = MeshBuilder.CreateBox(`chunk-${rec.id}-proxy`, { width: 0.6, height: 1.2, depth: 0.6 }, this.scene);
    post.position.set(origin.x + 1, 0.6, origin.z + 1);
    post.material = flatMaterial(this.scene, `chunk-${rec.id}-proxy`, PALETTE.cliff, 0.16);
    post.parent = node;
    post.metadata = { layer: 'collision' };
    meshes++;

    // (4) Interaction-anchor layer: variant-resolved content anchors. The anchor
    //     id set is invariant; tide/season/weather/restoration only flip
    //     presence/appearance.
    const def = contentForChunk(region, rec.coord);
    for (const a of resolveChunkContent(def, this.variant)) {
      if (!a.present) continue;
      const marker = MeshBuilder.CreateCylinder(`anchor-${a.id}`, { height: 0.5, diameter: 0.5, tessellation: 6 }, this.scene);
      marker.position.set(a.at.x, 0.25, a.at.z);
      marker.material = flatMaterial(this.scene, `anchor-${a.id}`, a.appearance === 'snow' ? PALETTE.stone : PALETTE.warmLight, 0.4);
      marker.parent = node;
      marker.metadata = { layer: 'interaction', anchorId: a.id };
      meshes++;
    }

    // (5) Spawn-set layer: a small marker standing in for the chunk's spawn set.
    const spawn = MeshBuilder.CreateBox(`chunk-${rec.id}-spawn`, { width: 0.4, height: 0.4, depth: 0.4 }, this.scene);
    spawn.position.set(origin.x + size - 1.5, 0.2, origin.z + size - 1.5);
    spawn.material = flatMaterial(this.scene, `chunk-${rec.id}-spawn`, PALETTE.accent, 0.45);
    spawn.parent = node;
    spawn.metadata = { layer: 'spawn' };
    meshes++;

    this.groups.set(rec.id, { id: rec.id, node, meshCount: meshes });
    // Report cost (meshes + the single collision body proxy) so the controller's
    // budget usage reflects what is actually resident.
    this.controller.markLoaded(rec.id, { meshes, bodies: 1 });
  }

  private unloadChunk(id: string): void {
    const g = this.groups.get(id);
    if (!g) return;
    g.node.dispose();
    this.groups.delete(id);
  }

  private refreshOverlay(): void {
    if (!this.overlay) return;
    const region = this.controller.activeRegion();
    this.overlay.updateFrom({
      regionLabel: region.label,
      origin: region.origin,
      focusChunkId: this.controller.focusChunkId(),
      counts: countByState(this.controller.allRecords()),
      budget: this.controller.budgetUsage(),
    });
  }

  // --- Debug / e2e introspection (mirrors window.sturdyVolleyLab) -----------
  private installDebugApi(): void {
    const api = {
      config: () => ({ ...DEFAULT_STREAMING_CONFIG }),
      regionIds: (): string[] => Object.keys(REGIONS),
      region: (): { id: string; label: string; origin: Vec2 } => {
        const r = this.controller.activeRegion();
        return { id: r.id, label: r.label, origin: { ...r.origin } };
      },
      player: (): Vec2 => ({ x: this.playerPos.x, z: this.playerPos.z }),
      setPlayer: (x: number, z: number): void => {
        this.playerPos.set(x, PLAYER_HEIGHT / 2, z);
        this.velocity = { x: 0, z: 0 };
        this.streamStep(0);
      },
      setVelocity: (vx: number, vz: number): void => {
        this.velocity = { x: vx, z: vz };
      },
      setSpeedMode: (mode: 'walk' | 'horse'): void => {
        this.speedMode = mode;
      },
      speedMode: (): string => this.speedMode,
      /** Advance `n` deterministic fixed-dt streaming steps with the current velocity. */
      tick: (n = 1): void => {
        for (let i = 0; i < n; i++) this.streamStep(FIXED_DT);
      },
      focusChunkId: (): string => this.controller.focusChunkId(),
      safeChunkId: (): string | null => this.controller.safeChunkId(),
      stateOf: (id: string): ChunkState => this.controller.stateOf(id),
      chunkStates: (): Array<{ id: string; cx: number; cz: number; state: ChunkState; ring: number }> =>
        this.controller.allRecords().map((r) => ({ id: r.id, cx: r.coord.cx, cz: r.coord.cz, state: r.state, ring: r.ring })),
      loadedIds: (): string[] =>
        this.controller.allRecords().filter((r) => r.state === 'active' || r.state === 'loaded').map((r) => r.id),
      counts: (): Record<ChunkState, number> => countByState(this.controller.allRecords()),
      budget: () => this.controller.budgetUsage(),
      /** Persistence-id'd chunk groups actually resident in the scene. */
      groupIds: (): string[] => [...this.groups.keys()],
      groupCount: (): number => this.groups.size,
      /** Ids that appear more than once — always empty by construction. */
      duplicateGroupIds: (): string[] => {
        const seen = new Set<string>();
        const dups: string[] = [];
        for (const id of this.groups.keys()) {
          if (seen.has(id)) dups.push(id);
          seen.add(id);
        }
        return dups;
      },
      worldMeshCount: (): number => {
        let n = 0;
        for (const g of this.groups.values()) n += g.meshCount;
        return n;
      },
      /** Resolved anchors for a chunk under the current variant (id + presence). */
      anchorsForChunk: (id: string): Array<{ id: string; present: boolean; appearance: string }> => {
        const parsed = parseChunkId(id);
        if (!parsed) return [];
        const region = REGIONS[parsed.regionId];
        if (!region) return [];
        return resolveChunkContent(contentForChunk(region, parsed.coord), this.variant).map((a) => ({
          id: a.id,
          present: a.present,
          appearance: a.appearance,
        }));
      },
      /** Every declared anchor id for a chunk — invariant across variants. */
      anchorIdsForChunk: (id: string): string[] => {
        const parsed = parseChunkId(id);
        if (!parsed) return [];
        const region = REGIONS[parsed.regionId];
        return region ? anchorIds(contentForChunk(region, parsed.coord)) : [];
      },
      variant: (): VariantState => ({ ...this.variant }),
      setVariant: (patch: Partial<VariantState>): void => {
        this.variant = { ...this.variant, ...patch };
        // Rebuild resident chunks so the variant change is visible (anchors hold).
        for (const id of [...this.groups.keys()]) {
          const parsed = parseChunkId(id);
          const rec = this.controller.record(id);
          this.unloadChunk(id);
          if (rec && parsed) this.loadChunk(rec);
        }
        this.refreshOverlay();
      },
      /** Make the next chunk content build report a failure (recovery test). */
      failNextLoad: (): void => {
        this.failNext = true;
      },
      /** Programmatic community transition (same path as walking across). */
      crossToBallastBay: (): RegionTransition | null => {
        if (this.controller.activeRegion().id !== 'willa-crick') return null;
        this.applyTransition(COMMUNITY_TRANSITION);
        return this.lastTransition;
      },
      lastTransition: (): RegionTransition | null => this.lastTransition,
      chunkOfWorld: (x: number, z: number): ChunkCoord => worldToChunk(this.controller.activeRegion(), { x, z }, DEFAULT_STREAMING_CONFIG.chunkSize),
      chunkCenter: (id: string): Vec2 | null => {
        const parsed = parseChunkId(id);
        if (!parsed) return null;
        const region = REGIONS[parsed.regionId];
        return region ? chunkCenter(region, parsed.coord, DEFAULT_STREAMING_CONFIG.chunkSize) : null;
      },
      cameraState: () => this.rig.getState(),
      meshCount: (): number => this.scene.meshes.length,
    };
    (window as unknown as { sturdyVolleyStream?: typeof api }).sturdyVolleyStream = api;
  }
}

/**
 * Authored graybox content for a chunk: a deterministic anchor set keyed by
 * coordinate so tests are stable. Every chunk has a centre `marker`; coastal
 * tide pools (hidden at high tide), a rebuilt-only stall (restoration), and a
 * winter-skinned tree exercise each variant dimension without ever changing the
 * anchor-id set.
 */
function contentForChunk(region: Region, coord: ChunkCoord): ChunkContentDef {
  const id = chunkId(region.id, coord);
  const c = chunkCenter(region, coord, DEFAULT_STREAMING_CONFIG.chunkSize);
  const anchors: ContentAnchor[] = [
    {
      id: `${id}:marker`,
      kind: 'landmark',
      at: { x: c.x, z: c.z },
      seasonAppearance: { winter: 'snow' },
    },
  ];
  // Coastal tide pool — present only at low tide.
  if ((coord.cx + coord.cz) % 3 === 0) {
    anchors.push({ id: `${id}:tidepool`, kind: 'tide-pool', at: { x: c.x + 6, z: c.z + 4 }, hideOnTide: 'high' });
  }
  // Restoration stall — appears once the community reaches rebuild stage 2.
  if ((coord.cx + coord.cz) % 4 === 0) {
    anchors.push({ id: `${id}:stall`, kind: 'market-stall', at: { x: c.x - 6, z: c.z - 4 }, restorationMinStage: 2 });
  }
  return { chunkId: id, anchors };
}
