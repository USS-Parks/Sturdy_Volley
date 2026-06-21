/**
 * End-to-end asset fixtures (WEF-11b, master Prompt 051). Five reference
 * manifests — a representative humanoid, animal, flora, building module, and
 * loose prop — that the swap factory uses to prove the pipeline: each swaps a
 * graybox's render geometry for an asset while its anchors / collision /
 * navigation / save identity are preserved, and reverts back. All five are
 * **conformant** to the Prompt 050 contract (asserted in the unit test); a real
 * `.glb` replaces the fixture's `buildAsset` callback without touching the factory.
 */
import type { AssetDescriptor } from './asset-contract';

export const FIXTURE_CHARACTER: AssetDescriptor = {
  name: 'sv_player_fixture',
  family: 'character',
  scale: 1,
  forwardAxis: '+z',
  upAxis: '+y',
  rootTransform: { position: [0, 0, 0], rotationDeg: [0, 0, 0], scale: [1, 1, 1] },
  materialCount: 2,
  triangleCount: 1500,
  clips: ['idle', 'walk', 'run', 'tool-swing', 'carry', 'kneel'],
  events: ['tool-impact'],
  hasCollisionProxy: true,
  sockets: ['hand-r', 'head', 'back'],
  maxTextureSize: 2048,
  lodCount: 2,
};

export const FIXTURE_ANIMAL: AssetDescriptor = {
  name: 'sv_animal_fixture',
  family: 'animal',
  scale: 1,
  forwardAxis: '+z',
  upAxis: '+y',
  rootTransform: { position: [0, 0, 0], rotationDeg: [0, 0, 0], scale: [1, 1, 1] },
  materialCount: 2,
  triangleCount: 600,
  clips: ['idle', 'walk'],
  events: [],
  hasCollisionProxy: true,
  sockets: [],
  maxTextureSize: 1024,
  lodCount: 2,
};

export const FIXTURE_FLORA: AssetDescriptor = {
  name: 'sv_flora_fixture',
  family: 'flora',
  scale: 1,
  forwardAxis: '+z',
  upAxis: '+y',
  rootTransform: { position: [0, 0, 0], rotationDeg: [0, 0, 0], scale: [1, 1, 1] },
  materialCount: 1,
  triangleCount: 300,
  clips: [],
  events: [],
  hasCollisionProxy: false,
  sockets: [],
  maxTextureSize: 1024,
  lodCount: 2,
};

export const FIXTURE_BUILDING: AssetDescriptor = {
  name: 'sv_building_fixture',
  family: 'building',
  scale: 1,
  forwardAxis: '+z',
  upAxis: '+y',
  rootTransform: { position: [0, 0, 0], rotationDeg: [0, 0, 0], scale: [1, 1, 1] },
  materialCount: 3,
  triangleCount: 2000,
  clips: [],
  events: [],
  hasCollisionProxy: true,
  sockets: [],
  maxTextureSize: 4096,
  lodCount: 2,
};

export const FIXTURE_PROP: AssetDescriptor = {
  name: 'sv_prop_fixture',
  family: 'prop',
  scale: 1,
  forwardAxis: '+z',
  upAxis: '+y',
  rootTransform: { position: [0, 0, 0], rotationDeg: [0, 0, 0], scale: [1, 1, 1] },
  materialCount: 1,
  triangleCount: 400,
  clips: [],
  events: [],
  hasCollisionProxy: true,
  sockets: [],
  maxTextureSize: 1024,
  lodCount: 1,
};

/** The five reference fixtures, in lab spawn order. */
export const ASSET_FIXTURES: ReadonlyArray<{ key: string; manifest: AssetDescriptor }> = [
  { key: 'humanoid', manifest: FIXTURE_CHARACTER },
  { key: 'animal', manifest: FIXTURE_ANIMAL },
  { key: 'flora', manifest: FIXTURE_FLORA },
  { key: 'building', manifest: FIXTURE_BUILDING },
  { key: 'prop', manifest: FIXTURE_PROP },
];
