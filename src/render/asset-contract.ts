/**
 * Asset & rig contract + validator (WEF-11a, master Prompt 050). Pure — no
 * Babylon — so the per-family `.glb` conformance rules are unit-testable and
 * shared by the runtime swap factories (Prompt 051) and the `validate:assets`
 * gate (`scripts/validate-assets.mjs`, which reads the same
 * `asset-contract.json`). The contract is authored in `docs/ASSET_AND_RIG_CONTRACT.md`.
 *
 * The validator rejects wrong scale, non-identity root transforms, wrong axes,
 * missing animation clips/events, excessive materials/triangles, absent collision
 * metadata, missing rig sockets, oversized textures, insufficient LODs, and
 * invalid naming — each with an actionable message — before a non-conformant
 * asset can replace a graybox.
 *
 * Units: metres; one forward axis (+Z); Y-up.
 */
import CONTRACT from './asset-contract.json';

export type AssetFamilyId =
  | 'character'
  | 'npc'
  | 'animal'
  | 'mount'
  | 'flora'
  | 'building'
  | 'terrain'
  | 'tool'
  | 'machine'
  | 'prop';

export interface AssetFamilyRule {
  label: string;
  namePattern: string;
  maxMaterials: number;
  maxTriangles: number;
  requiredClips: string[];
  requiredEvents: string[];
  requiresCollisionProxy: boolean;
  requiredSockets: string[];
  maxTextureSize: number;
  minLods: number;
}

export const ASSET_FAMILIES: Record<AssetFamilyId, AssetFamilyRule> =
  CONTRACT.families as Record<AssetFamilyId, AssetFamilyRule>;
export const SCALE_TOLERANCE: number = CONTRACT.scaleTolerance;
export const FORWARD_AXIS: string = CONTRACT.forwardAxis;
export const UP_AXIS: string = CONTRACT.upAxis;

/** The metadata a `.glb` (its sidecar descriptor) declares for validation. */
export interface AssetDescriptor {
  name: string;
  family: AssetFamilyId;
  /** Root uniform scale (must be 1). */
  scale: number;
  forwardAxis: string;
  upAxis: string;
  /** Root node transform — must be identity (origin at 0, no rotation, scale 1). */
  rootTransform: { position: [number, number, number]; rotationDeg: [number, number, number]; scale: [number, number, number] };
  materialCount: number;
  /** Base-LOD triangle count. */
  triangleCount: number;
  clips: string[];
  events: string[];
  hasCollisionProxy: boolean;
  sockets: string[];
  /** Largest texture dimension (px). */
  maxTextureSize: number;
  lodCount: number;
}

export type AssetIssueCode =
  | 'unknown-family'
  | 'wrong-scale'
  | 'non-identity-transform'
  | 'wrong-axis'
  | 'invalid-name'
  | 'too-many-materials'
  | 'too-many-triangles'
  | 'missing-clip'
  | 'missing-event'
  | 'missing-collision-proxy'
  | 'missing-socket'
  | 'texture-too-large'
  | 'insufficient-lods';

export interface AssetIssue {
  code: AssetIssueCode;
  severity: 'high' | 'low';
  message: string;
}

export function assetFamilyIds(): AssetFamilyId[] {
  return Object.keys(ASSET_FAMILIES) as AssetFamilyId[];
}

function near(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

/**
 * Validate one asset descriptor against its family's contract. Returns every
 * issue found (empty = conformant). Each message is actionable (names the field,
 * the value, and the limit).
 */
export function validateAssetDescriptor(desc: AssetDescriptor): AssetIssue[] {
  const issues: AssetIssue[] = [];
  const rule = ASSET_FAMILIES[desc.family];
  if (!rule) {
    return [{ code: 'unknown-family', severity: 'high', message: `asset "${desc.name}" declares unknown family "${desc.family}"` }];
  }
  const tol = SCALE_TOLERANCE;

  if (!near(desc.scale, 1, tol)) {
    issues.push({ code: 'wrong-scale', severity: 'high', message: `"${desc.name}" root scale ${desc.scale} ≠ 1.0 (export at 1 unit = 1 m)` });
  }
  const rt = desc.rootTransform;
  const idPos = rt.position.every((v) => near(v, 0, 1e-4));
  const idRot = rt.rotationDeg.every((v) => near(v, 0, 1e-4));
  const idScale = rt.scale.every((v) => near(v, 1, tol));
  if (!idPos || !idRot || !idScale) {
    issues.push({ code: 'non-identity-transform', severity: 'high', message: `"${desc.name}" root transform must be identity (origin 0, no rotation, scale 1); apply transforms before export` });
  }
  if (desc.forwardAxis !== FORWARD_AXIS || desc.upAxis !== UP_AXIS) {
    issues.push({ code: 'wrong-axis', severity: 'high', message: `"${desc.name}" axes ${desc.forwardAxis}/${desc.upAxis} ≠ ${FORWARD_AXIS}/${UP_AXIS} (forward/up)` });
  }
  if (!new RegExp(rule.namePattern).test(desc.name)) {
    issues.push({ code: 'invalid-name', severity: 'high', message: `"${desc.name}" does not match the ${desc.family} naming rule /${rule.namePattern}/` });
  }
  if (desc.materialCount > rule.maxMaterials) {
    issues.push({ code: 'too-many-materials', severity: 'high', message: `"${desc.name}" has ${desc.materialCount} materials (${desc.family} max ${rule.maxMaterials}); merge to a shared atlas` });
  }
  if (desc.triangleCount > rule.maxTriangles) {
    issues.push({ code: 'too-many-triangles', severity: 'high', message: `"${desc.name}" base LOD ${desc.triangleCount} tris (${desc.family} max ${rule.maxTriangles})` });
  }
  for (const clip of rule.requiredClips) {
    if (!desc.clips.includes(clip)) {
      issues.push({ code: 'missing-clip', severity: 'high', message: `"${desc.name}" is missing required clip "${clip}" for ${desc.family}` });
    }
  }
  for (const ev of rule.requiredEvents) {
    if (!desc.events.includes(ev)) {
      issues.push({ code: 'missing-event', severity: 'high', message: `"${desc.name}" is missing required animation event "${ev}" for ${desc.family}` });
    }
  }
  if (rule.requiresCollisionProxy && !desc.hasCollisionProxy) {
    issues.push({ code: 'missing-collision-proxy', severity: 'high', message: `"${desc.name}" (${desc.family}) has no collision proxy metadata` });
  }
  for (const socket of rule.requiredSockets) {
    if (!desc.sockets.includes(socket)) {
      issues.push({ code: 'missing-socket', severity: 'high', message: `"${desc.name}" is missing rig socket "${socket}" for ${desc.family}` });
    }
  }
  if (desc.maxTextureSize > rule.maxTextureSize) {
    issues.push({ code: 'texture-too-large', severity: 'high', message: `"${desc.name}" texture ${desc.maxTextureSize}px exceeds ${desc.family} budget ${rule.maxTextureSize}px` });
  }
  if (desc.lodCount < rule.minLods) {
    issues.push({ code: 'insufficient-lods', severity: 'low', message: `"${desc.name}" has ${desc.lodCount} LOD(s); ${desc.family} expects ≥ ${rule.minLods}` });
  }
  return issues;
}

/** Whether a descriptor is fully conformant (no high-severity issues). */
export function isAssetConformant(desc: AssetDescriptor): boolean {
  return validateAssetDescriptor(desc).every((i) => i.severity !== 'high');
}
