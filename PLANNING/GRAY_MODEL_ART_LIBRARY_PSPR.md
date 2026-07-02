# Sturdy Volley — 230 Art Library Gray Model P-SPR

Prepared: 2026-06-23  
Status: **APPROVED 2026-07-02 — STS execution authorized; GML-00 active.**  
Phase shorthand: **GML** (Gray Model Library)  
Primary art source: the 230-image `art-production/current-direction/` library, with
`art-production/current-direction/P-marketing-and-reference-covers/sv_cover_230_world_poster_no_text.png`
as the unifying world-poster reference.

## 0. Authority, protocol, and relationship to existing plans

This P-SPR exists because the user asked to begin the **3D gray model** pass using the
completed 230-image art library. It is intentionally **not** the same as
`PLANNING/STURDY_VOLLEY_ASSET_LIBRARY_PSPR.md`, which is a later/fuller `.glb` production
pipeline. GML builds the canonical in-engine gray model library first: faceted Babylon
primitive assemblies, collision-safe proportions, landmark silhouettes, kit parts, and
showcase placement. Finished `.glb` art can later replace these gray models through the
existing asset contract and swap factory.

Saving this file does **not** approve execution. After the user explicitly approves this
plan or says to run it STS, execute GML-00 through GML-12 in order, without pausing for
approval between prompts.

### 0.1 Governing rules

This phase inherits `AGENTS.md`, `PLANNING/MASTER_ROSTER.md` §0, and
`art-production/CURRENT_ART_DIRECTION.md`.

- One prompt = one completed, visible, verified change.
- Add a top-of-file `DEVLOG.md` entry for every completed prompt.
- Run the full gate required by `MASTER_ROSTER.md` §0.2 unless a prompt explicitly
  names additional checks:
  - both TypeScript configurations;
  - `npm run lint`;
  - `npm test`;
  - `npm run validate:assets`;
  - `npm run build`;
  - relevant Playwright on desktop and mobile;
  - `python tools/local_gitdoctor_scan.py --fail-on high`;
  - reproducible visual evidence for prompts that alter rendered scenes.
- Commit exactly one prompt at a time after the gate is green.
- Stage explicit paths only.
- Do not push unless the user has approved STS with push authority or explicitly asks
  for a push.

### 0.2 Parallel / “numerous sessions” protocol

The implementation may use multiple Codex sessions, but parallel implementation must
respect the project rule: **separate Git worktrees for separate tracks**. The default
roster below is sequential because it is safer for shared scene files. If the user wants
the fastest multi-session execution after approving this plan:

1. Create coordinator session on the main worktree.
2. Create worktree `gml-core` for core gray-model helpers and tests.
3. Create worktree `gml-farm-town` for farm, village, common, and market placement.
4. Create worktree `gml-coast-wilds` for harbor, beach, marsh, quarry, ridge, and
   lighthouse placement.
5. Merge back only at prompt boundaries after each track has a green gate.

No track may edit the same scene/helper file concurrently. Cross-track merge hotspots are
`src/render/scene-helpers.ts`, `src/scenes/*Scene.ts`, `tests/e2e/*.spec.ts`, and
`DEVLOG.md`; the coordinator owns those merges.

### 0.3 Art doctrine for this phase

The 230-image library is treated as a **shape, proportion, mood, and landmark bible**,
not as a literal mesh-tracing source.

- Canonical look: original late-1990s console low-poly adventure, economical faceted
  geometry, restrained material blocks, readable silhouettes, warm practical detail.
- Current-direction anchors remain stronger than any single image: remote northwest
  California coast, redwoods/firs, fog/rain/moss, modest homesteads, village common,
  working harbor, marsh, quarry, ridge, lighthouse, handmade community spaces.
- No sports content: no volleyball, court, net, team branding, tournament, trophies, or
  sports UI.
- No copied maps, symbols, names, characters, or layouts from any other game.
- Gray models are production spatial foundations, not disposable boxes. Final art must
  later replace visible meshes without changing approved anchors, collision, navigation,
  camera intent, or scale.

### 0.4 Source references to use

Required references at prompt start:

- `art-production/CURRENT_ART_DIRECTION.md`
- `art-production/current-direction/P-marketing-and-reference-covers/sv_cover_230_world_poster_no_text.png`
- relevant nearby current-direction art folders:
  - farm / maps / region layouts;
  - town sunny market and winter lantern biome key art;
  - props, decor, interiors, tilesets, and production reference sheets;
  - character portrait sheets only as identity/dialogue/cutscene reference, never as
    literal gameplay mesh requirements.
- `docs/SCALE_AND_PERFORMANCE.md`
- `docs/ASSET_AND_RIG_CONTRACT.md`
- `src/render/asset-contract.json`
- `src/render/asset-factory.ts`
- the scene(s) touched by the prompt.

### 0.5 Existing-change safety

Planning inspection found untracked planning files already present:

- `PLANNING/ASSET_LIBRARY_RESEARCH_AND_ART_SYNTHESIS.md`
- `PLANNING/STURDY_VOLLEY_ASSET_LIBRARY_PSPR.md`

Treat them as pre-existing user/project work. Do not delete, rewrite, stage, or commit
them unless a later approved prompt explicitly includes them.

## 1. Goal, scope, and non-goals

### 1.1 Goal

Create a reusable, canonical **3D gray model library** that translates the completed
230-image art library into visible, playable in-engine forms: landmarks, buildings,
terrain kits, props, flora, animals, NPC scale proxies, and a world-showcase scene. The
result should make Sturdy Volley’s world read as the Prompt 230 poster’s world in motion,
while staying faithful to existing gameplay scale, camera, navigation, and asset-contract
rules.

### 1.2 In scope

- Babylon primitive gray model helpers and reusable kit builders.
- Gray model registry with names, categories, dimensions, source-art traceability, and
  future `.glb` replacement identifiers.
- Farm foreground kit: garden beds, fences, crops, tools, crates, lanterns, dog/chicken
  readable proxies.
- Village/common kit: cozy timber houses, market stalls, common fire/lantern gathering,
  well, planters, crates, benches, signless shop fronts.
- Harbor/beach/lighthouse kit: docks, boats, pier clutter, sea rocks, driftwood,
  lighthouse silhouette, reef/islet markers.
- Marsh kit: boardwalk, reeds, water patches, fog-friendly lantern posts, broken planks.
- Quarry/ridge kit: terraced stone, rail-lift/gantry silhouette, ore nodes, watchtower,
  ridge pines.
- Character and animal gray proxies: scale and silhouette only; not final characters.
- A “World Poster Gray Library” proving scene and/or dev route that arranges the kits into
  a readable Prompt-230-inspired vista.
- Integration into existing playable scenes where appropriate, without breaking current
  navigation/collision/camera.

### 1.3 Non-goals

- No final textured `.glb` asset generation in this phase.
- No AI image-to-3D import/cleanup in this phase.
- No character finalization, facial modeling, rigging, animation set, or romance-candidate
  production pass.
- No replacement of the asset contract; this phase feeds it.
- No new paid tools or third-party asset packs.
- No literal one-to-one reconstruction of the Prompt 230 poster.

## 2. Proposed architecture

```
src/render/gray-models/
  materials.ts          shared neutral gray / warm-lit / debug material helpers
  primitives.ts         faceted low-poly primitive helpers
  registry.ts           model ids, family, dimensions, source references
  terrain-kit.ts        cliffs, terraces, paths, water-edge pieces
  farm-kit.ts           beds, fences, crops, crates, garden/animal proxies
  village-kit.ts        house shells, market stalls, common props, lanterns
  coast-kit.ts          docks, boats, lighthouse, rocks, reef/islets
  wilds-kit.ts          marsh, quarry, ridge, watchtower, gantry
  character-kit.ts      player/NPC/animal silhouette proxies
```

Likely scene consumers:

- `src/scenes/AssetSwapLabScene.ts` for first isolated proof.
- `src/scenes/BreakpointFarmScene.ts` for farm foreground integration.
- `src/scenes/BallastBayTownScene.ts` for village/common/market/harbor integration.
- `src/scenes/KlamityRiverScene.ts`, `BeachScene.ts`, `RainhallCavernScene.ts`, and
  `MineScene.ts` only after the relevant kit is isolated and tested.
- New dev scene if needed: `src/scenes/WorldPosterGrayLibraryScene.ts`.

## 3. Sequential prompt roster

### GML-00 — Art-library audit and gray model taxonomy

Create a traceability document that turns the 230-image art library, with Prompt 230 as the
world-poster summary, into a concrete gray-model taxonomy. Name each model family, priority,
approximate scale, source images, intended scene, replacement family (`building`, `prop`,
`flora`, `terrain`, `animal`, `npc`, etc.), and non-goals.

Files likely touched:

- `docs/GRAY_MODEL_ART_LIBRARY.md` (new)
- `DEVLOG.md`

Acceptance:

- The document names the first production gray model families and explicitly maps them to
  Prompt 230’s farm, town/common, harbor, marsh, quarry, ridge, lighthouse, boats, lanterns,
  animals, and small-prop language.
- It records style constraints and sports-purge rules.
- It identifies which models are gameplay collision foundations vs. visual-only dressing.
- Full verify gate passes; no scene behavior changes yet.

### GML-01 — Core gray-model helper layer

Add reusable gray-model helpers: shared material palette, faceted primitive builders,
grouping/naming conventions, source-reference metadata, and model registry validation.
Prove them in unit tests without altering live scenes.

Files likely touched:

- `src/render/gray-models/materials.ts`
- `src/render/gray-models/primitives.ts`
- `src/render/gray-models/registry.ts`
- `tests/unit/gray-models.test.ts`
- `docs/GRAY_MODEL_ART_LIBRARY.md`
- `DEVLOG.md`

Acceptance:

- Helpers create named meshes with consistent origin, scale, pickability, and material policy.
- Registry ids are kebab-case, family-prefixed, unique, and mapped to future asset-contract
  families.
- Tests cover primitive dimensions, naming, registry uniqueness, and no sports/forbidden ids.
- Full verify gate passes.

### GML-02 — Isolated World Poster Gray Library scene

Create a dev scene that displays the first model gallery without risking playable maps. It
should show a neutral gray 3D “art shelf” of the Prompt-230-derived families with camera,
lighting, labels only if debug-safe and non-diegetic. Avoid generated title/text assets.

Files likely touched:

- `src/scenes/WorldPosterGrayLibraryScene.ts` (new)
- `src/scenes/registry.ts`
- `src/scenes/dev-route.ts`
- `tests/e2e/world-poster-gray-library.spec.ts`
- `DEVLOG.md`

Acceptance:

- Scene is reachable by dev route/query param.
- At least one gray model from each target family appears: farm, village, coast, wilds,
  character/animal, prop.
- Debug telemetry exposes model count, ids, families, and dimensions.
- Playwright desktop and mobile confirm the scene renders and telemetry matches.
- Full verify gate passes.

### GML-03 — Farm foreground gray kit

Build the Prompt-230 foreground farm kit: raised crop beds, low fences, crates/baskets,
simple crops, hand tools, lantern rock, dog/chicken/goat silhouette proxies, and a warm
foreground path cluster. Integrate representative pieces into `BreakpointFarmScene` without
changing gameplay collision unless explicitly named.

Files likely touched:

- `src/render/gray-models/farm-kit.ts`
- `src/scenes/BreakpointFarmScene.ts`
- `tests/unit/gray-farm-kit.test.ts`
- `tests/e2e/breakpoint-farm.spec.ts`
- `DEVLOG.md`

Acceptance:

- Farm kit reads clearly from the existing camera at desktop and Pixel 5 scale.
- Gameplay collision, farm routes, water, stairs, and goat behavior remain unchanged unless a
  documented visual-only mesh is added.
- Debug telemetry exposes placed farm gray models.
- Tests assert stable dimensions and source-art references.
- Full verify gate passes.

### GML-04 — Village/common and market gray kit

Build the village/common kit: timber house shells with low-poly roof language, market stalls,
benches, planters, well, common gathering/fire/lantern cluster, signless storefront dressing,
and small crates/barrels. Integrate into `BallastBayTownScene`.

Files likely touched:

- `src/render/gray-models/village-kit.ts`
- `src/scenes/BallastBayTownScene.ts`
- `tests/unit/gray-village-kit.test.ts`
- `tests/e2e/ballast-bay-town.spec.ts`
- `DEVLOG.md`

Acceptance:

- Market/common feel closer to the sunny-market and winter-lantern references without text,
  branding, banners, sports symbols, or final textures.
- Navigation through market lane remains playable.
- Debug telemetry exposes model ids/families/counts.
- Playwright desktop/mobile covers render, movement through the lane, and no console errors.
- Full verify gate passes.

### GML-05 — Harbor, beach, lighthouse, and reef/islet gray kit

Build docks, small boats, mooring posts, pier clutter, driftwood, reef/islet markers,
sea-rock clusters, and lighthouse silhouette pieces. Integrate safe pieces into town harbor
and/or beach scenes; keep collision and water rules stable.

Files likely touched:

- `src/render/gray-models/coast-kit.ts`
- `src/scenes/BallastBayTownScene.ts`
- `src/scenes/BeachScene.ts`
- `tests/unit/gray-coast-kit.test.ts`
- `tests/e2e/beach.spec.ts`
- `tests/e2e/ballast-bay-town.spec.ts`
- `DEVLOG.md`

Acceptance:

- Harbor/coast silhouettes match the Prompt 230 world-poster language at gray stage.
- Boats are original, modest working craft, not sports or franchise-derived silhouettes.
- Water/wade/dock traversal still passes.
- Full verify gate passes.

### GML-06 — Marsh and boardwalk gray kit

Build marsh boards, broken planks, reed clusters, water-edge stones, fog-friendly lantern
posts, and repairable boardwalk silhouettes. Integrate first in the library scene and then in
the safest current marsh-adjacent scene or blockout surface available.

Files likely touched:

- `src/render/gray-models/wilds-kit.ts`
- `src/scenes/WorldPosterGrayLibraryScene.ts`
- possibly `src/scenes/KlamityRiverScene.ts` or `BallastBayTownScene.ts`
- `tests/unit/gray-wilds-kit.test.ts`
- relevant e2e test
- `DEVLOG.md`

Acceptance:

- Marsh kit has readable boardwalk/reed/lantern language.
- Pieces are authored as visual or collision according to the taxonomy.
- No traversal or camera regressions in the scene that receives them.
- Full verify gate passes.

### GML-07 — Quarry, ridge, and highland gray kit

Build terraced quarry blocks, stacked stone faces, ore nodes, rail-lift/gantry silhouette,
ridge pines, watchtower/lookout, and cliff-path markers. Integrate first into the library
scene and then into the most relevant existing quarry/cave/ridge scene.

Files likely touched:

- `src/render/gray-models/wilds-kit.ts`
- `src/scenes/MineScene.ts` or `RainhallCavernScene.ts`
- `tests/unit/gray-wilds-kit.test.ts`
- relevant e2e test
- `DEVLOG.md`

Acceptance:

- Quarry/ridge reads as the Prompt 230 background language in low-poly gray form.
- Any collision-affecting forms use explicit simple proxies, never render-mesh collision.
- Existing mining/cave interactions still pass.
- Full verify gate passes.

### GML-08 — Character, NPC, and animal silhouette proxies

Create gray silhouette proxy builders for player/NPC scale, townsfolk clusters, working
neighbors, dog, cat, chicken, goat, and small birds. These are **scale and staging proxies
only**, not final character gameplay models.

Files likely touched:

- `src/render/gray-models/character-kit.ts`
- `src/scenes/WorldPosterGrayLibraryScene.ts`
- potentially `BreakpointFarmScene.ts` and `BallastBayTownScene.ts`
- `tests/unit/gray-character-kit.test.ts`
- relevant e2e test
- `DEVLOG.md`

Acceptance:

- Proxies honor existing player/NPC/animal scale and do not override established motor,
  animal-family, or NPC logic.
- Character refs are treated as identity/dialogue/cutscene art direction only.
- The world-poster scene contains readable foreground player/animal grouping.
- Full verify gate passes.

### GML-09 — Prompt 230 world-vista composition pass

Use the kits to create a single dev scene composition inspired by Prompt 230: farm
foreground, village/common middle ground, harbor/beach/lighthouse, marsh, quarry, ridge,
outer islets, lanterns, and NPC/animal scale proxies. This is a spatial art-reference scene,
not a replacement for the actual world map.

Files likely touched:

- `src/scenes/WorldPosterGrayLibraryScene.ts`
- `src/render/gray-models/*`
- `tests/e2e/world-poster-gray-library.spec.ts`
- `DEVLOG.md`

Acceptance:

- The composition reads as the whole-world poster in navigable gray model form.
- Debug telemetry reports all required zones present.
- Desktop and mobile screenshots are captured as visual evidence.
- No title, logo, readable signs, or sports content appears.
- Full verify gate passes.

### GML-10 — Playable scene placement polish

Apply the highest-value gray models to the existing playable scenes in restrained doses:
farm foreground, town/common/market, harbor/coast, and wilds/quarry/cave slices. The goal is
readability, not clutter.

Files likely touched:

- `src/scenes/BreakpointFarmScene.ts`
- `src/scenes/BallastBayTownScene.ts`
- `src/scenes/BeachScene.ts`
- `src/scenes/KlamityRiverScene.ts`
- `src/scenes/MineScene.ts` or `RainhallCavernScene.ts`
- relevant e2e tests
- `DEVLOG.md`

Acceptance:

- Existing gameplay flows still pass.
- Placement honors navigation clearance, camera occlusion, mobile readability, and perf.
- Every placed model has a registry entry and source-art reference.
- Full verify gate passes, including relevant Playwright desktop/mobile coverage.

### GML-11 — Asset-contract bridge and future `.glb` replacement map

Add documentation and data that map each gray model id to a future `.glb` replacement id,
asset family, expected descriptor requirements, collision proxy policy, and integration owner.
Do not generate `.glb` files yet.

Files likely touched:

- `docs/GRAY_MODEL_ART_LIBRARY.md`
- `docs/ASSET_AND_RIG_CONTRACT.md` if a clarifying note is needed
- `src/render/gray-models/registry.ts`
- tests for registry bridge data
- `DEVLOG.md`

Acceptance:

- Every gray model has a future replacement family/id or is explicitly marked visual-only.
- No asset-contract weakening.
- `npm run validate:assets` remains green.
- Full verify gate passes.

### GML-12 — Phase closure, evidence, and handoff

Close the gray-model phase with docs, screenshots, final validation, and a handoff for the
future `.glb` asset-library phase.

Files likely touched:

- `docs/GRAY_MODEL_ART_LIBRARY.md`
- `PLANNING/handoffs/HANDOFF-GML-2026-06-23.md`
- `SESSION_LOG/<date>-gml-gray-model-library.md`
- `DEVLOG.md`

Acceptance:

- Documentation lists shipped gray-model families, where they appear, and what is deferred
  to final asset generation.
- Screenshots/evidence exist for the world-poster library scene and touched playable scenes.
- Full verify gate passes.
- The next recommended phase is clearly named: either continue to final `.glb` asset library
  generation or expand gray models into remaining regions.

## 4. Completion criteria

This phase is complete when:

- A reusable gray-model library exists under `src/render/gray-models/`.
- The Prompt 230 world-poster art has a clear in-engine gray composition reference.
- Representative models are visible in real playable scenes without breaking gameplay.
- Every model has source-art traceability and future replacement metadata.
- All prompt-level DEVLOG entries, tests, evidence, and commits are complete.

## 5. Approval checkpoint

To approve this plan, the user can say:

> Approved — run GML STS.

If the user wants parallel worktrees/sessions, add:

> Use the multi-session worktree protocol.

Until then, Codex may inspect and refine planning materials, but must not implement the
GML roster.
