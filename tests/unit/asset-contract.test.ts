import { describe, it, expect } from 'vitest';
import {
  ASSET_FAMILIES,
  assetFamilyIds,
  validateAssetDescriptor,
  isAssetConformant,
  type AssetDescriptor,
  type AssetIssueCode,
} from '../../src/render/asset-contract';

/** A fully conformant hero descriptor; tests mutate one field at a time. */
function conformantCharacter(): AssetDescriptor {
  return {
    name: 'sv_player_default',
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
}

const codes = (desc: AssetDescriptor): AssetIssueCode[] => validateAssetDescriptor(desc).map((i) => i.code);

describe('asset contract — families', () => {
  it('defines every family with complete rules', () => {
    const ids = assetFamilyIds();
    expect(ids).toEqual(expect.arrayContaining(['character', 'npc', 'animal', 'mount', 'flora', 'building', 'terrain', 'tool', 'machine', 'prop']));
    for (const id of ids) {
      const r = ASSET_FAMILIES[id];
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.maxMaterials).toBeGreaterThan(0);
      expect(r.maxTriangles).toBeGreaterThan(0);
      expect(typeof r.requiresCollisionProxy).toBe('boolean');
      expect(r.namePattern.length).toBeGreaterThan(0);
    }
  });

  it('the rideable mount requires the mount-anchor socket + ridden gait clips', () => {
    const mount = ASSET_FAMILIES.mount;
    expect(mount.requiredSockets).toContain('mount-anchor');
    expect(mount.requiredClips).toEqual(expect.arrayContaining(['walk', 'trot', 'canter', 'gallop']));
  });
});

describe('asset contract — validation', () => {
  it('passes a fully conformant asset', () => {
    expect(validateAssetDescriptor(conformantCharacter())).toEqual([]);
    expect(isAssetConformant(conformantCharacter())).toBe(true);
  });

  it('rejects wrong scale', () => {
    expect(codes({ ...conformantCharacter(), scale: 100 })).toContain('wrong-scale');
  });

  it('rejects a non-identity root transform', () => {
    expect(codes({ ...conformantCharacter(), rootTransform: { position: [0, 1, 0], rotationDeg: [0, 0, 0], scale: [1, 1, 1] } })).toContain('non-identity-transform');
  });

  it('rejects wrong axes', () => {
    expect(codes({ ...conformantCharacter(), forwardAxis: '-z' })).toContain('wrong-axis');
  });

  it('rejects an invalid name', () => {
    expect(codes({ ...conformantCharacter(), name: 'hero01' })).toContain('invalid-name');
  });

  it('rejects too many materials and triangles', () => {
    expect(codes({ ...conformantCharacter(), materialCount: 9 })).toContain('too-many-materials');
    expect(codes({ ...conformantCharacter(), triangleCount: 99999 })).toContain('too-many-triangles');
  });

  it('rejects missing clips, collision proxy, and rig sockets', () => {
    expect(codes({ ...conformantCharacter(), clips: ['idle'] })).toContain('missing-clip');
    expect(codes({ ...conformantCharacter(), hasCollisionProxy: false })).toContain('missing-collision-proxy');
    expect(codes({ ...conformantCharacter(), sockets: [] })).toContain('missing-socket');
  });

  it('rejects oversized textures and flags insufficient LODs', () => {
    expect(codes({ ...conformantCharacter(), maxTextureSize: 8192 })).toContain('texture-too-large');
    const lod = validateAssetDescriptor({ ...conformantCharacter(), lodCount: 0 });
    expect(lod.find((i) => i.code === 'insufficient-lods')?.severity).toBe('low');
    // A low-severity LOD note alone still counts as "conformant" for swapping.
    expect(isAssetConformant({ ...conformantCharacter(), lodCount: 0 })).toBe(true);
  });

  it('every high-severity message is actionable (names the asset)', () => {
    const issues = validateAssetDescriptor({ ...conformantCharacter(), scale: 5, materialCount: 9 });
    for (const i of issues) expect(i.message).toContain('sv_player_default');
  });

  it('an unknown family is a single high issue', () => {
    const issues = validateAssetDescriptor({ ...conformantCharacter(), family: 'spaceship' as never });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('unknown-family');
  });
});
