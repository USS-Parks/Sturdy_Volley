// Asset validation gate (stub).
//
// The full Blender -> browser .glb validation pipeline is the user-owned
// "Theme 3 Production Track" prompt A10. Until approved .glb assets land in
// public/assets/, this script just verifies the assets directory is well-formed
// and reports what it finds, exiting 0 so the build gate stays green.
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASSET_DIR = 'public/assets';

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

if (!existsSync(ASSET_DIR)) {
  console.log(`[validate:assets] ${ASSET_DIR}/ not present yet — no runtime assets to validate.`);
  process.exit(0);
}

const files = walk(ASSET_DIR);
const glb = files.filter((f) => f.toLowerCase().endsWith('.glb'));
console.log(
  `[validate:assets] ${files.length} file(s) under ${ASSET_DIR}/ (${glb.length} .glb). ` +
    `Full .glb conformance checks land with the art pipeline (A10).`,
);
process.exit(0);
