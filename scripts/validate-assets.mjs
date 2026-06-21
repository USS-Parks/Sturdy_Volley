// Asset validation gate (WEF-11a, Prompt 050).
//
// Preserves the original directory check (assets dir well-formed, reports what it
// finds), and adds per-family `.glb` conformance validation: any `*.asset.json`
// sidecar descriptor under public/assets/ is validated against the shared asset
// contract (src/render/asset-contract.json — the SAME data the runtime TS
// validator src/render/asset-contract.ts uses). A HIGH-severity issue fails the
// gate (exit 1) with an actionable message; absent assets keep the gate green.
//
// Authoritative validator: src/render/asset-contract.ts (this is its CLI mirror).
import { readdirSync, existsSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ASSET_DIR = 'public/assets';
const CONTRACT_PATH = 'src/render/asset-contract.json';

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const near = (a, b, t) => Math.abs(a - b) <= t;

/** Validate one descriptor against the contract. Mirrors asset-contract.ts. */
function validateDescriptor(desc, contract) {
  const issues = [];
  const high = (message) => issues.push({ severity: 'high', message: `${desc.name ?? '(unnamed)'}: ${message}` });
  const low = (message) => issues.push({ severity: 'low', message: `${desc.name ?? '(unnamed)'}: ${message}` });
  const rule = contract.families[desc.family];
  if (!rule) {
    high(`unknown family "${desc.family}"`);
    return issues;
  }
  const tol = contract.scaleTolerance;
  if (!near(desc.scale, 1, tol)) high(`root scale ${desc.scale} != 1.0`);
  const rt = desc.rootTransform ?? { position: [0, 0, 0], rotationDeg: [0, 0, 0], scale: [1, 1, 1] };
  const identity = rt.position.every((v) => near(v, 0, 1e-4)) && rt.rotationDeg.every((v) => near(v, 0, 1e-4)) && rt.scale.every((v) => near(v, 1, tol));
  if (!identity) high('root transform is not identity (apply transforms before export)');
  if (desc.forwardAxis !== contract.forwardAxis || desc.upAxis !== contract.upAxis) high(`axes ${desc.forwardAxis}/${desc.upAxis} != ${contract.forwardAxis}/${contract.upAxis}`);
  if (!new RegExp(rule.namePattern).test(desc.name ?? '')) high(`name does not match /${rule.namePattern}/`);
  if (desc.materialCount > rule.maxMaterials) high(`${desc.materialCount} materials > max ${rule.maxMaterials}`);
  if (desc.triangleCount > rule.maxTriangles) high(`${desc.triangleCount} tris > max ${rule.maxTriangles}`);
  for (const clip of rule.requiredClips) if (!(desc.clips ?? []).includes(clip)) high(`missing clip "${clip}"`);
  for (const ev of rule.requiredEvents) if (!(desc.events ?? []).includes(ev)) high(`missing event "${ev}"`);
  if (rule.requiresCollisionProxy && !desc.hasCollisionProxy) high('no collision proxy metadata');
  for (const socket of rule.requiredSockets) if (!(desc.sockets ?? []).includes(socket)) high(`missing rig socket "${socket}"`);
  if (desc.maxTextureSize > rule.maxTextureSize) high(`texture ${desc.maxTextureSize}px > budget ${rule.maxTextureSize}px`);
  if ((desc.lodCount ?? 0) < rule.minLods) low(`${desc.lodCount ?? 0} LOD(s) < expected ${rule.minLods}`);
  return issues;
}

// --- Contract self-check (always runs; catches a malformed contract) ---------
if (!existsSync(CONTRACT_PATH)) {
  console.error(`[validate:assets] missing asset contract ${CONTRACT_PATH}`);
  process.exit(1);
}
const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
const familyCount = Object.keys(contract.families).length;
for (const [id, rule] of Object.entries(contract.families)) {
  if (!(rule.maxTriangles > 0 && rule.maxMaterials > 0 && typeof rule.namePattern === 'string')) {
    console.error(`[validate:assets] contract family "${id}" is malformed`);
    process.exit(1);
  }
}

if (!existsSync(ASSET_DIR)) {
  console.log(`[validate:assets] ${ASSET_DIR}/ not present yet — contract OK (${familyCount} families); no runtime assets to validate.`);
  process.exit(0);
}

const files = walk(ASSET_DIR);
const glb = files.filter((f) => f.toLowerCase().endsWith('.glb'));
const descriptors = files.filter((f) => f.toLowerCase().endsWith('.asset.json'));

let highCount = 0;
for (const path of descriptors) {
  let desc;
  try {
    desc = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`[validate:assets] ${path}: invalid JSON — ${e.message}`);
    highCount++;
    continue;
  }
  const issues = validateDescriptor(desc, contract);
  for (const i of issues) {
    const tag = i.severity === 'high' ? 'FAIL' : 'warn';
    console[i.severity === 'high' ? 'error' : 'log'](`[validate:assets] ${tag} ${path}: ${i.message}`);
    if (i.severity === 'high') highCount++;
  }
}

console.log(
  `[validate:assets] ${files.length} file(s) under ${ASSET_DIR}/ (${glb.length} .glb, ${descriptors.length} descriptor(s)); ` +
    `contract has ${familyCount} families; ${highCount} blocking issue(s).`,
);
process.exit(highCount > 0 ? 1 : 0);
