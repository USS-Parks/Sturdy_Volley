# Sturdy Volley Gray Model Art Library

Status: GML-00 production taxonomy, approved 2026-07-02.

## Purpose

This document translates every identifiable element in the current-direction Art Bible into
the canonical gray-model and final-asset production taxonomy. Gray models establish
silhouette, origin, scale, traversal clearance, collision ownership, camera readability, and
future asset identity. Final Blender builds replace their visible geometry without changing
those approved spatial contracts.

The production target is an original late-1990s-console low-poly adventure: economical
facets, strong silhouettes, restrained material blocks, warm practical detail, and the
northwestern California coast's redwoods, firs, fog, rain, moss, weathered timber, modest
homesteads, working harbor, marsh, quarry, ridge, and lighthouse. Painterly boards direct
lighting and atmosphere; faceted boards direct geometry.

## Canonical-reference coverage

Every file under `art-production/current-direction/` participates in production reference.
Every identifiable element receives one explicit disposition in the final manifest:

1. unique 3D asset;
2. reusable modular asset or state/palette/upgrade variant;
3. scene effect, material, lighting, camera, layout, animation, portrait, or UI reference;
4. documented non-mesh reference.

No physical object, creature, building, terrain feature, kit piece, or prop may disappear
between the Art Bible and the manifest. UI boards, portraits, maps, covers, lighting studies,
and animation sheets guide other production properties and do not automatically become one
mesh per image. `archive/` sports material is superseded and excluded. The three
`work-in-progress/` painterly-drift images are cautionary references only.

## Governing references

- `art-production/CURRENT_ART_DIRECTION.md` overrides every superseded sports image.
- P-230 is the whole-world composition summary, not a literal map or tracing source.
- A-004/005/007 govern facets, material blocks, and readable scale.
- B and D govern region identity, landmarks, weather, and lighting.
- C, I, J, N, and O govern kits, crops, tools, machines, buildings, props, interiors,
  tiles, and animation economy.
- H governs animal silhouettes. E/F/G govern character identity and staging.
- `docs/SCALE_AND_PERFORMANCE.md`, `docs/world/METRIC_KIT.md`, and
  `docs/ASSET_AND_RIG_CONTRACT.md` are the metric and replacement contracts.

## Rejected legacy prototypes

The five existing `.glb` files in `art-production/current-direction/Q-gray-model-demos/`
are rejected, non-production prototypes. They are not reusable geometry, quality targets,
cleanup candidates, or integration inputs. Their represented subjects remain in scope, but
must be rebuilt from scratch in Blender using the complete Art Bible. Until an approved
prompt retires them, they remain historical evidence only and are marked **DO NOT USE**.

## Non-negotiable production rules

1. One Babylon unit is one metre. Human reference height is 1.8 m; a farm cell is 1 m²;
   doors are at least 1.0 × 1.8 m; building walls are normally 3–4 m.
2. Render meshes never silently become gameplay collision. Collision foundations use named,
   simple proxies owned by the scene/blockout; visual dressing is non-colliding.
3. Every model id is kebab-case, family-prefixed, source-traceable, and mapped to a future
   game asset id. Replacement keeps approved origins, anchors, clearance, and collision.
4. Final authoring uses Blender `.blend` source and exports `.glb` for Babylon. `.obj` is
   optional interchange, not the runtime source of truth.
5. No title, logo, readable diegetic sign, team mark, court, net, ball, tournament object,
   trophy, sports banner, or other sports residue may appear.
6. No copied character, landmark, symbol, map, silhouette, costume, or layout from another
   game. References communicate physical and aesthetic qualities only.

## Priority and ownership vocabulary

- **P0:** required for the World Poster Gray Library and first playable integration.
- **P1:** required for all named zones and core interactions.
- **P2:** dressing or variant depth after main silhouettes are stable.
- **Foundation:** preserves or deliberately owns gameplay collision/navigation.
- **Visual:** non-pickable, non-colliding dressing around existing foundations.
- **Hybrid:** render assembly plus an explicit, separately named simple collision proxy.

