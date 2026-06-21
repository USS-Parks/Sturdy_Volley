# Asset & Rig Contract — Sturdy Volley

Last revised: 2026-06-21 (Prompt 050 / WEF-11a)

Normative for every production `.glb` asset that replaces a graybox. Defines the
per-family geometry, transform, naming, material, texture, rig, LOD, collision,
and animation requirements, and the **validator** that enforces them. A
non-conformant asset is rejected — with an actionable message — **before** it can
swap a graybox (Prompt 051), so finished art never silently breaks collision,
navigation, anchors, scale, or save identity.

Source of truth: `src/render/asset-contract.json` (the per-family rule **data**),
`src/render/asset-contract.ts` (the runtime validator + types — what the Prompt
051 swap factories call), and `scripts/validate-assets.mjs` (the `npm run
validate:assets` gate — the CLI mirror, reading the same JSON). Gate:
`tests/unit/asset-contract.test.ts`.

---

## 1. Universal rules (every family)

- **Units:** 1 unit = 1 metre. Honour `docs/SCALE_AND_PERFORMANCE.md` (player
  capsule 1.8 m; farm cell 1 m²; walls 3–4 m; doorways ≥ 1 m × 1.8 m).
- **Axes:** one forward axis **+Z**, **Y-up**. `forwardAxis`/`upAxis` must read
  `+z`/`+y`.
- **Root transform = identity:** origin at (0, 0, 0), no rotation, scale 1 on the
  root node. Apply all transforms before export (`wrong-scale` /
  `non-identity-transform`).
- **Origins:** authored at the gameplay anchor (characters/animals at the feet
  centre; buildings at the doorway-aligned ground origin; props at their rest
  base) so a `.glb` swap lands on the graybox's anchor without re-offset.
- **Naming:** kebab-case, family-prefixed (`^sv_<family>_<name>$`), matching
  `src/data/schemas.ts` id rules (`invalid-name`).
- **Materials + UVs:** shared atlas per area; material count is capped per family
  (`too-many-materials`); UVs packed into the family's atlas; no per-instance
  unique textures.
- **Texture budget:** the largest texture dimension is capped per family
  (`texture-too-large`) — the §1.4 "~4K per area" economy, smaller per asset.
- **Triangles:** base-LOD triangle budget per family (`too-many-triangles`) — the
  §1.4 panel-11 model economy (representative NPC ≈ 120–180 tris at the lowest LOD;
  these caps are the *base* LOD ceiling, refined to measured budgets in Prompt 052).
- **LODs:** ≥ the family's `minLods`; distant plants/FX use billboards/impostors
  (`insufficient-lods`, advisory).
- **Collision proxy:** families that collide must ship collision-proxy metadata
  (never render-mesh collision — §1.2); `requiresCollisionProxy`
  (`missing-collision-proxy`).
- **Rig sockets:** required attachment sockets per family
  (`missing-socket`) — e.g. the hero's `hand-r`/`head`/`back`, the mount's
  `mount-anchor`, a tool's `grip`.
- **Animation clips + events:** required clips per family (`missing-clip`) with
  required events (`missing-event`) — e.g. the character's `tool-impact`, the
  mount's `footfall`.
- **Root-motion policy:** in-place clips by default (the motor owns translation);
  root motion only for authored set-pieces, baked to a documented convention.
- **Bounds:** a tight, correct bounding volume (no stray geometry inflating it).
- **Export:** glTF 2.0 binary (`.glb`), +Z forward / Y-up, metres, transforms
  applied, one sidecar `<name>.asset.json` descriptor for the gate.

---

## 2. Per-family budgets

| Family | Name prefix | Max mats | Max tris (base LOD) | Collision | Sockets | Tex px | LODs | Required clips |
|---|---|---:|---:|---|---|---:|---:|---|
| `character` | `sv_player_` | 2 | 1800 | yes | hand-r, head, back | 2048 | 2 | idle, walk, run, tool-swing, carry, kneel (+`tool-impact` event) |
| `npc` | `sv_npc_` | 2 | 900 | yes | hand-r | 1024 | 2 | idle, walk |
| `animal` | `sv_animal_` | 2 | 800 | yes | — | 1024 | 2 | idle, walk |
| `mount` | `sv_mount_` | 2 | 1400 | yes | mount-anchor | 2048 | 2 | idle, walk, trot, canter, gallop (+`footfall`) |
| `flora` | `sv_flora_`/`sv_crop_` | 1 | 400 | no | — | 1024 | 2 | — (wind is shader, not a clip) |
| `building` | `sv_building_` | 3 | 2500 | yes | — | 4096 | 2 | — |
| `terrain` | `sv_terrain_` | 2 | 3000 | yes | — | 4096 | 1 | — |
| `tool` | `sv_tool_` | 1 | 300 | no | grip | 512 | 1 | — |
| `machine` | `sv_machine_` | 2 | 1500 | yes | — | 1024 | 1 | idle, active |
| `prop` | `sv_prop_` | 1 | 500 | yes | — | 1024 | 1 | — |

The contract covers the §4.2 / acceptance reference families — the player + NPCs,
animals/fauna (incl. the rideable mount), flora, buildings, terrain modules, tools,
machines, and loose props.

---

## 3. The validator

`validateAssetDescriptor(descriptor)` (`src/render/asset-contract.ts`) returns
every issue found — `wrong-scale`, `non-identity-transform`, `wrong-axis`,
`invalid-name`, `too-many-materials`, `too-many-triangles`, `missing-clip`,
`missing-event`, `missing-collision-proxy`, `missing-socket`, `texture-too-large`,
`insufficient-lods` (advisory), `unknown-family` — each with an **actionable**
message naming the asset, the offending value, and the limit. `isAssetConformant`
is true when there are no HIGH-severity issues (an advisory LOD note still swaps).

`npm run validate:assets` (`scripts/validate-assets.mjs`) self-checks the contract,
then validates every `*.asset.json` sidecar under `public/assets/` against it; a
HIGH issue fails the gate (exit 1). With no assets present yet, the gate reports
the contract is OK and stays green — ready for the first real `.glb`.

## 4. What this does not do yet

- Live `.glb` mesh inspection (triangle/material counts read from the binary) —
  lands with the real art pipeline; until then the sidecar `*.asset.json`
  descriptor declares the metadata the validator checks.
- The swap factories that consume conformant assets — Prompt 051.
- Measured (vs. budgeted) triangle/draw ceilings — Prompt 052.
