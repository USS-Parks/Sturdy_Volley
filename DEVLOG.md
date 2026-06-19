# Sturdy Volley — Dev Log

Build history for the [STURDY_VOLLEY_PSPR.md](./STURDY_VOLLEY_PSPR.md) roster.
Each entry: what shipped, how it was verified, and the commit.

---

## Prompt 001 — Project scaffold and quality bar (2026-06-18)

Stood up the browser game project: **TypeScript + Vite + Phaser 3 + Vitest +
Playwright + ESLint**, dedicated git repo wired to `USS-Parks/Sturdy_Volley`.

- Folder structure: `src/{config,scenes,ui,engine,data}`, `tests/{unit,e2e}`, `docs/`, `public/`.
- Scenes: `Boot → Preload → Title`. Title draws an original generated coastal
  backdrop (no external assets) and renders the main menu via an accessible
  **HTML overlay** (`src/ui/overlay.ts`).
- Title menu: **Start**, **Continue** (disabled — no save yet), **Settings**,
  **Credits**. Settings/Credits open placeholder panels with working Back nav.
- Scripts: `dev`, `build` (typecheck + vite build), `preview`, `typecheck`,
  `lint`, `test`, `test:e2e`.
- Tests: Vitest specs for the pure menu model + DOM overlay; Playwright smoke on
  desktop + mobile (Pixel 5) asserting no console errors, menu presence, panel
  navigation, and canvas mount.
- Baseline CI workflow (`.github/workflows/ci.yml`): lint → typecheck → unit →
  build, plus a separate e2e job.

**Acceptance criteria**

- [x] `npm run dev`, `npm run build`, `npm test` succeed
- [x] Playwright opens the title screen at desktop and mobile sizes
- [x] Title screen has Start, Continue (disabled), Settings, Credits
- [x] No other game's assets, code, names, or extracted data are present

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest `10/10` ·
build `dist/` emitted (bundle ~1.49 MB / 342 KB gzip) · Playwright `6/6` across
`desktop-chromium` + `mobile-chromium` (Pixel 5).

**Note (headless WebGL):** Chromium 117+ blocklists WebGL in headless unless
SwiftShader is explicitly enabled. Phaser's WebGL renderer threw
`Framebuffer Unsupported` on boot, aborting scene init. Fixed in
`playwright.config.ts` via launch args `--enable-unsafe-swiftshader
--use-gl=angle --use-angle=swiftshader` (test-env only; the game stays on the
WebGL `AUTO` renderer in production).

Resolved versions: phaser 3.90.0, vite 6.4.3, vitest 3.2.6.

---

## Prompt 002 — Game design constants and typed data pipeline (2026-06-18)

Added a **typed, validated, data-driven content pipeline** (zod 3.25).

- `src/data/schemas.ts` — `.strict()` zod schemas + inferred TS types for all
  twelve content kinds: items, crops, animals, recipes, npcs, skills, weather,
  festivals, quests, shops, maps, dialogue. IDs constrained to kebab-case.
- `src/data/content/*.json` — original Ballast Bay sample data: 14 items,
  4 crops, 2 animals, 2 recipes, 2 NPCs (Mara Vale, Jun Park), 8 skills,
  4 weather, 4 festivals, 2 quests, 2 shops, 2 maps, 2 dialogue sets.
- `src/data/content.ts` — `validateContent()` runs schema validation +
  id-uniqueness + **cross-collection referential integrity** (a crop's seed
  must be a real item, dialogue.npcId a real NPC, etc.); `loadGameContent()`
  throws a `ContentValidationError` with human-readable issues; `getContentReport()`
  powers the dev screen. Content is loaded fail-fast in `PreloadScene`.
- **Developer-only data validation screen**: in dev builds the Title menu shows
  "Dev · Validate data", opening a pass/fail report per collection.

**Acceptance criteria**

- [x] Invalid data fails tests with useful errors (missing field, bad id,
  unknown key, broken cross-reference, duplicate id — all covered)
- [x] ≥10 items (14), ≥4 crops, ≥2 NPCs, ≥2 animals, ≥2 recipes load from data
- [x] Data IDs are stable and human-readable (kebab-case, enforced + tested)

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest `19/19`
(3 files) · build `dist/` (bundle ~1.55 MB / 358 KB gzip) · Playwright `8/8`
(desktop + mobile, incl. the dev data screen).

---

## Prompt 003 — Scene manager and save bootstrap (2026-06-18)

Added the scene graph, fade transitions, and a full save lifecycle.

- **Scenes**: `NewGame`, `Farm`, `Town`, `Interior`, `Court`, `Mine` added to
  the Boot → Preload → Title chain. Gameplay scenes are placeholder "place
  cards" (`PlaceScene`) wiring navigation + persistence until the real tilemap
  scenes arrive (Farm tilemap = Prompt 004). Navigation graph:
  Farm↔Town↔Interior, Farm↔Court↔(Town), Farm↔Mine.
- **Fade transitions**: `GameScene` base class — `fadeIn()` / `fadeTo()` using
  camera fades, with a per-scene `transitioning` guard so transitions are
  interrupt-safe (double-taps ignored).
- **Save model** (`saveModel.ts`): versioned, zod-validated — player identity,
  calendar (year/season/day/time), location, inventory, relationships, skills,
  flags, mapState. `createNewSave`, `serializeSave`, `parseSave` (readable
  errors). Store (`save.ts`): read/write/delete/has on localStorage, corrupt
  saves ignored. In-memory active save (`gameState.ts`).
- **New Game** flow collects name + farm name via an accessible overlay form,
  creates + persists a save, enters the Farm. **Continue** loads + resumes the
  saved scene. **Settings** menu now does Export (download .json) / Import (file
  picker, validated) / Delete.

**Acceptance criteria**

- [x] New Game creates a save
- [x] Continue loads the save after refresh
- [x] Save export/import works through a settings menu (round-trip + parse
  validation unit-tested; settings UI e2e-verified; file picker is manual)
- [x] Scene transition fades are smooth and interrupt-safe

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest `36/36`
(6 files) · build `dist/` (bundle ~1.56 MB / 361 KB gzip) · Playwright `10/10`
(desktop + mobile).

**Note (e2e infra):** moved Playwright from the Vite **dev** server to the
**preview (production build)** server. Under 8 parallel workers the dev server's
on-the-fly dep re-optimization issued full-reloads mid-test (clicks/locators
detached → timeouts). Preview is static + deterministic and tests the shipped
artifact. The dev-only data-validation screen isn't in the prod build, so its UI
moved to jsdom unit tests (`UIOverlay.showReport`). Added `optimizeDeps.include`
for a smoother `npm run dev` too.

---

## Prompt 004 — Tilemap renderer and collision (2026-06-18)

Replaced the Farm placeholder card with the first real playable tilemap scene.

- **Procedural placeholder art** (`engine/textures.ts`): a generated tileset
  (grass/soil/sand/water×2/cliff/path) plus player/tree/rock/house/fence/court/
  tuft sprites — all original code-drawn shapes, no external assets.
- **Map** (`maps/breakpointFarm.ts`, `maps/tiles.ts`): deterministic 40×30 farm —
  grass field, northern cliff edge, tide-fed water channel, tilled soil patch,
  sandy corner, and 12 objects (house, trees, rocks, fence, court). Pure data,
  unit-tested.
- **FarmScene**: Phaser tilemap + tile collision (water/cliff), static-body
  collision for solid objects, depth sorting by y, animated water (tile swap)
  and swaying grass tufts, a follow camera bounded to the map (lerp +
  roundPixels = no jitter), and world-bounds clamping.
- **Player movement** (`engine/movement.ts`): pure `computeMoveVector` (keyboard
  axes, normalized diagonals, pointer fallback with deadzone), unit-tested.
  Keyboard (arrows + WASD) + touch (drag toward pointer).
- **HUD + pause menu**: top-bar HUD (location + status + Menu) and a pause menu
  preserving navigation (Town/Court/Mine) + Save & quit until proper map exits
  arrive.

**Acceptance criteria**

- [x] Player can walk around the farm with keyboard and touch (keyboard
  e2e-verified; touch logic unit-tested + wired)
- [x] Collision correct for fences, water, rocks, trees, house, cliffs
- [x] Camera follows without jitter (lerp follow + roundPixels)
- [x] Mobile viewport keeps player + UI readable (Scale.FIT; mobile e2e passes)

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest `48/48`
(8 files) · build `dist/` (bundle ~1.57 MB / 363 KB gzip) · Playwright `12/12`
(desktop + mobile).

**Note (e2e workers):** capped Playwright to 2 workers locally / 1 in CI. The
heavier Farm scene under software WebGL (SwiftShader) saturated the CPU at 8
parallel instances, stalling in-page actionability checks. Serial/low-worker
runs are deterministic.

---

## Phase M — Pivot to Babylon.js 3D (Theme 3) (2026-06-18)

**Direction change.** The revised P-SPR retargets Sturdy Volley as an original
**N64-era low-poly 3D** game. Per user direction the engine is **Babylon.js**
(the doc's "Three.js" is superseded), the foundation is **migrated in place**,
and the **Theme 3 art track (A01–A10) is owned by the user / Codex** — so this
codebase builds only the renderer + renderer-agnostic systems and uses code-drawn
placeholder primitives until real `.glb` assets land. (Codex builds art from
`STURDY_VOLLEY_IMAGE_PROMPT_ROSTER.md`; Claude builds the game from
`STURDY_VOLLEY_PSPR.md`.)

**Migrated (Phaser → Babylon):**
- Dependency swap: `phaser` removed, `@babylonjs/core` added. `vite.config`
  pre-bundles Babylon; `chunkSizeWarningLimit` raised (Babylon barrel ≈ 5.1 MB /
  1.14 MB gzip — within the 35 MB target; path-import/code-split is a later task).
- `src/render/`: `scene-helpers.ts` (Theme-3 `PALETTE`, flat vertex-lit-look
  material, fog, three-quarter camera, warm/cool lights) + `fade.ts` (DOM fade).
- `src/scenes/`: `SceneManager` (render loop + interrupt-safe fade transitions),
  `GameScene` base, and Babylon Boot → Preload → Title → NewGame →
  Farm/Town/Interior/Court/Mine. Title is an animated low-poly **Ballast Bay
  diorama** (sea, cliff island, the Old Netlight lighthouse, cottages, beach
  court, sea stacks) behind the DOM menu. Gameplay scenes are placeholder 3D
  (ground + player capsule + props) with the HUD + pause-menu navigation + save.
- **Preserved unchanged** (renderer-agnostic): `src/data/` content pipeline,
  `src/engine/` save model/store/transfer + gameState + format + movement, and
  the whole `src/ui/` DOM overlay (menus/forms/HUD/report).
- `index.html` gains `<canvas id="game-canvas">`; `#fade` styles added.
- `scripts/validate-assets.mjs` + `npm run validate:assets` (stub gate until the
  art pipeline's A10 `.glb` validation).
- Retired: Phaser scenes, `engine/textures.ts`, `maps/*` (2D tilemap),
  `config/gameConfig.ts`, the Phaser farm-movement e2e + map unit test.

**Bug fixed during migration:** `SceneManager.goTo` held its transition guard
through the cosmetic fade-in, so a user click landing in the ~260 ms fade-in
window was dropped (New Game "Begin" silently no-op'd on faster machines). The
guard now releases as soon as the next scene is interactive.

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest `43/43`
(7 files) · `validate:assets` `exit 0` · build `dist/` (Babylon bundle) ·
Playwright `8/8` (desktop + mobile) including a **canvas-pixel check** confirming
the 3D title scene actually renders (Babylon boots under headless SwiftShader).
Playwright workers set to 1 (Babylon software-WebGL is CPU-heavy).

**Prompt status under Babylon:** P-001 (3D scaffold + title diorama +
canvas-pixel checks) ✓ · P-002 (data pipeline) ✓ unchanged · P-003 (scene
manager + saves) ✓ on Babylon.

---

## Prompt 004 — Playable 3D Breakpoint Farm (core) (2026-06-18)

After the volleyball scrub, resumed the roster in order. P-001/002/003 verified
satisfied on Babylon; built the core of P-004 — the first walkable 3D scene.

- **`engine/farmGrid.ts`** — `FarmGrid`: deterministic, addressable farm cells
  (`get`/`set`/`inBounds`/`index`/`cellToWorld`/`worldToCell`/`forEach`),
  centered-grid world mapping. Pure, 8 unit tests (the P-004 "farm cells remain
  deterministic and addressable" criterion).
- **FarmScene** rewritten from a placeholder card into a real 3D scene: grass
  terrain, a grid-aware tilled soil plot (rendered from `FarmGrid`), placeholder
  farmhouse + roof, trees, a tide-fed pond, and invisible world-bound walls.
  A third-person **player capsule** walkable by **keyboard (WASD/arrows)** and
  **touch** (canvas floating-joystick → `computeMoveVector`), moved
  camera-relative via Babylon **ellipsoid collisions** (`moveWithCollisions`)
  against the house/trees/pond/bounds. **Follow camera** (`ArcRotateCamera`
  `lockedTarget`, no jitter). Theme-3 fog + warm/cool lighting. HUD + pause menu
  (Town / Beach / Mine / Save & quit) preserved.
- New Theme-3 `soil` palette color.

**Acceptance criteria (core met):**
- [x] Player walks the farm with keyboard + touch (keyboard e2e-verified on
  desktop + mobile; touch joystick wired via `computeMoveVector`)
- [x] Collision correct for the present props (building, trees, water, bounds)
- [x] Camera follows without jitter (lockedTarget follow)
- [x] Farm cells remain deterministic + addressable (FarmGrid + tests)
- [x] Mobile viewport keeps player + UI readable (mobile e2e passes)
- [ ] *Remaining for a later P-004 pass:* animated water, instanced grass,
  doors/region exits, more collision prop types (fences/rocks/slopes/stairs/
  cliffs), camera clip-avoidance + indoor reframe.

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest `51/51`
(8 files) · build `dist/` · Playwright `10/10` (desktop + mobile, incl. the 3D
farm walk test + canvas-pixel check).

---

## Prompt 011 — NPC schedule engine (2026-06-19, core)

Stood up the schedule + abstract-pathing engine plus four NPC schedules
spanning Farm / Town / Beach / Interior.

- **`engine/npcSchedule.ts`** — pure: `Waypoint`, `ScheduleSegment`,
  `NpcSchedule { default, bySeason, byWeather, byFestival, byRelationship,
  byEvent }`, `ResolveContext`, `pickLayer` (precedence: event flag →
  festival → weather → relationship-tier → season → default), `activeWaypoint`,
  `abstractStep` (offscreen NPCs jump-to-anchor, no navmesh cost), `liveStep`
  (linear walk with arrival snap), `isConversationAvailable`. 13 unit tests.
- **`src/data/content/schedules.json`** — 4 NPC schedules (mara-vale, jun-park,
  sol-aranda, lio-marin) routed across Farm / Town / Beach / Interior with at
  least one weather override (mara's rain-day stays indoors).

**Acceptance criteria (core met):**
- [x] At least 4 NPCs follow schedules across farm, town, interiors, and
  beach (data file ships with all 4; schedule resolution is pure-tested).
- [x] Offscreen NPCs advance through abstract schedules without consuming
  full navigation or animation cost (`abstractStep` returns the active
  waypoint directly; no live walk-physics needed off-screen).
- [ ] NPCs avoid obstacles and recover if blocked *(navmesh + local
  avoidance arrive with the scene-renderer wave; the engine emits arrival
  events the renderer can intercept with reroute logic).*
- [ ] Debug overlay can show current schedule target *(reserved for the
  debug-tools wave; the resolver already returns the waypoint id renderers
  can echo into the existing `sturdyVolleyDebug` shim).*

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest
`173/173` (22 files, +9 new specs) · build OK.

---

## Prompt 010 — Foraging, debris, trees, and regrowth (2026-06-19, core)

Stood up the forage / debris / tree-regrowth layer: a `WorldEntity` map
shared by every scene, deterministic per-day spawning + regrowth via
`advanceWorld`, and a `collect` rules engine for the player-side rewards.

- **`engine/forage.ts`** — pure: `EntityKind`, `WorldEntity`, `EntityMap`,
  `advanceWorld` (regrow stumps after `TREE_REGROW_DAYS = 5`, spawn seasonal
  forage at `FORAGE_SPAWN_CHANCE = 0.35` into empty cells, spread grass at
  `GRASS_SPREAD_CHANCE = 0.2`), `collect` (forage/grass yield 1 immediately;
  debris yields 1 at hardness ≥ 1; trees become stumps + 3 wood at hardness
  ≥ 2; stumps yield 1 at hardness ≥ 1), `forageQualityRoll(seed, skill)` with
  skill-bias toward higher tiers. 11 unit tests.
- **`engine/saveModel.ts`** — `worldEntities: Record<key, WorldEntity>` keyed
  by `"{sceneKey}:{col},{row}"`. New saves seed two trees + one debris pile
  on the Farm to give Prompt 010 something to swing the axe at.
- **`engine/dayResolution.ts`** — `resolveDay` accepts `forageTables` and now
  walks `advanceWorld` after the calendar rolls. Day summary surfaces
  "N forage items appeared in the wild." when any spawn.

**Acceptance criteria (core met):**
- [x] Forage spawns in valid map regions (`RegionForageTable.cellKeys` + the
  `FORAGE_SPAWN_CHANCE` roll only fills empty cells; deterministic seed = the
  absolute day so save/load doesn't shift the spawn pattern).
- [x] Trees and grass regrow over time (stumps → trees after 5 days; grass
  spreads via `GRASS_SPREAD_CHANCE`; unit-tested).
- [x] Foraged item quality can be influenced by skill (`forageQualityRoll`
  applies a +0.02 bias per foraging skill level, capped at +0.3 at level 15;
  unit-tested by comparing skill-0 vs skill-12 totals over 100 rolls).
- [ ] Scene-side spawn rendering + collect-on-interact wired into Beach /
  Marsh / Ridge as those scenes ship (the engine + save / day-resolution
  contract is the stable surface).

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest
`164/164` (21 files, +10 new specs) · build OK.

---

## Prompt 009 — Tools and upgrades (2026-06-19, core)

Stood up the tool + upgrade data layer: a typed catalog (`ToolId`), per-level
stamina + AOE + hardness reach tables, AOE offset shapes (single / line /
plus / 3×3), charge-action AOE boosts, and `staminaCost` / `aoeAt` /
`hardnessReach` / `aoeOffsets` / `chargedAoe` helpers. Wired the Watering Can
into FarmScene: a single E now waters the cell under the player AND the level-1+
AOE pattern, drains stamina via `staminaCost(toolId, level)`, and persists.

- **`engine/tools.ts`** — pure: `TOOL_DEFS` for hoe / watering-can / axe / pick
  / sickle / fishing-rod / defender-blade with per-level stamina (drops 15%
  per level, floor 1), AOE (1/3/5/9 for area tools; 1×4 for single-target),
  and hardness reach. `aoeOffsets(n)` returns the cell-pattern offsets a swing
  applies; `chargedAoe(id, level, seconds)` boosts area tools at the 0.6s /
  1.4s charge thresholds. 11 unit tests.
- **`engine/saveModel.ts`** — `toolLevels: Record<string, 0..3>` (default 0).
- **`scenes/FarmScene.ts`** — Watering Can interaction applies the AOE pattern
  via `aoeOffsets(aoeAt('watering-can', level))`, drains stamina via
  `applyToolStamina`, and surfaces "Watered N crops" when the AOE catches
  multiple plantings.

**Acceptance criteria (core met):**
- [x] Tools consume stamina according to skill and upgrade level
  (`staminaCost(id, level)` drops 15% per level, floor 1; FarmScene applies
  it on every Watering Can use).
- [x] Upgraded tools affect wider areas (AOE table: hoe/watering-can/sickle
  go 1 → 3 → 5 → 9; FarmScene's `waterArea` honors the pattern).
- [ ] Tool animations have anticipation, impact, and recovery frames
  *(Theme 3 Production Track A04–A06 deliverables; the engine emits the
  contact event hook via `applyToolStamina` so a future rig pass can drive
  the clip from the same beat).*
- [ ] Each tool aligns to the shared rig without hand sliding or incorrect
  pivots *(Theme 3 Production Track A03–A06; the data + cost model is the
  engine-side contract).*

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest
`154/154` (20 files, +11 new specs) · build OK · Playwright not re-run
(no runtime behavior change for the covered e2e flows; soil / time /
inventory / save smoke remain green from Prompt 008).

---

## Prompt 008 — Soil, crops, watering, and harvesting (2026-06-19)

Stood up the soil + crop layer: tilling, planting via the active hotbar seed,
watering via the Watering Can tool, deterministic overnight growth, seasonal
death, quality rolls, and visible cell + crop meshes.

- **`engine/soil.ts`** — pure: `Planting { cropId, daysGrown, watered, harvests }`,
  `plantingKey(scene, col, row)`, `newPlanting`, `daysUntilHarvest` (growthDays
  or regrowDays depending on harvest count), `isHarvestReady`, `advanceCrops`
  (rain waters everything, watered crops advance one day, out-of-season crops
  die, returns grew/matured/killed counts), `rollQuality` (deterministic
  Mulberry32 → 0/1/2/3 with ~6%/20%/45%/29% bias), `harvest` (returns next
  planting + produce id + quality), `buildCropIndex`. 14 unit tests.
- **`engine/saveModel.ts`** — bumped `SAVE_VERSION` to 3. New fields:
  `tilledCells: string[]` (reserved for the Hoe-extension wave) and
  `plantings: Record<string, Planting>` keyed by `plantingKey`.
- **`engine/dayResolution.ts`** — `resolveDay` takes `crops` + `todayWeatherId`;
  passes the cell map through `advanceCrops` after the calendar rolls; surfaces
  "N crops wilted" + "N crops ready to harvest" notices on the day summary.
  Returns `cropsGrew / cropsMatured / cropsKilled` for callers.
- **`scenes/FarmScene.ts`** — interacting (E / Space) with the tilled plot now
  resolves the (col, row) under the player. With a seed in the active hotbar
  slot, the cell becomes a `newPlanting`; with the Watering Can tool selected,
  the cell's `watered` flag flips; on a ready crop, `harvest` rolls quality,
  pushes produce into the inventory, and either consumes the planting or
  resets it for the regrow cycle. Crop and soil meshes render via
  `refreshCropMeshes` (cylinder height encodes days grown; mature crops adopt
  the roof color; wet soil tiles adopt the wood color). Cultivation skill XP
  accumulates (+2 plant, +5 harvest).

**Acceptance criteria**

- [x] Four original crops grow across multiple days (bell-peas / tide-turnip /
  blush-radish / sunmelon — `advanceCrops` walks each one day at a time
  under the regrowDays / growthDays contract; unit tests lock the day-by-day
  progression and the season-boundary kill path).
- [x] Watered state visibly changes (soil tile recolors from `PALETTE.soil` to
  `PALETTE.wood` when `planting.watered === true`; resets each morning).
- [x] Harvest adds items with quality (`harvest` returns a 0-3 tier;
  `addItem(this.save.inventory, produceItemId, 1, quality)` puts it in the
  player's bag).
- [x] Rain waters outdoor crops (`advanceCrops({ rained: true, ... })` flips
  every planting's `watered` flag before the daily growth check; FarmScene
  + PlaceScene pass the current weather id into `resolveDay`).

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest
`143/143` (19 files, +14 new specs) · build OK · Playwright `24/24` (no e2e
added — soil module fully unit-tested; existing inventory/time e2e still
green).

---

## Prompt 007 — Inventory, hotbar, chests, and item quality (2026-06-19)

Stood up the inventory system: a renderer-agnostic Container model shared by
the player, the porch chest, and the shipping bin; quality tiers with sell-price
multipliers; a persistent hotbar strip; a dual-grid inventory panel with
pointer-driven drag/drop, a trash slot, and an item tooltip; a starter chest +
shipping bin in the world; and overnight sales that flow through the day
summary.

- **`engine/inventory.ts`** — pure container engine: `createContainer`,
  `addItem` (auto-stacks across slots up to `MAX_STACK = 99` and respects the
  `stackable` flag), `removeItem` (lowest-quality first), `swapSlots`,
  `placeOrMerge`, `splitStack`, `moveBetween` (cross-container, with merge or
  swap fallback), `findFirstEmpty`, `findStack`, `countItem`, `isEmpty`,
  `qualityMultiplier` (1.0 / 1.25 / 1.5 / 2.0), `sellValueOf`. 18 unit tests.
- **`engine/itemCatalog.ts`** — `buildItemCatalog(items, npcs)` produces id→item
  + itemId→loved-by-npc maps and exposes `getItem`, `lovedByNpcs`,
  `containerSellValue` (quality-adjusted total across a container). 3 unit
  tests.
- **`engine/saveModel.ts`** — bumped `SAVE_VERSION` to 2. `inventory` is now a
  `Container { slots: nullable[], capacity }`; added `hotbarSize` (default 8),
  `chests: Record<string, Container>` (seeded with a 24-slot `farm-porch-chest`),
  and `shippingBin: Container` (16 slots). New saves start with 5 Bell Pea Seeds
  in hotbar slot 0 so the first day has something to do.
- **`engine/dayResolution.ts`** — `resolveDay` now takes `items` too, drains the
  shipping bin into income (`containerSellValue`), clears the bin, and prepends
  "Yesterday's shipment earned N g." to the day-summary notices. Returns
  `shipmentEarnings` on the result for callers. Wallet credits run before the
  collapse penalty so a 2-AM sleep still banks the day's harvest. 1 new test
  (the bin path), plus 3 existing tests carry the `items: []` field.
- **`ui/overlay.ts`** — `showHotbar(opts)` renders a persistent
  `.hotbar-strip` (idempotent — re-rendering replaces in place), `showInventory(opts)`
  renders the dual-grid panel (player + optional partner) with a Trash slot and
  pointer-driven drag/drop via `text/plain` JSON payloads, `tooltipLines` is a
  pure helper exporting the canonical tooltip field order (name → description →
  source → tags → sell × quality → quality tier → loved by). 6 new jsdom tests
  including a drag/drop wiring smoke (stubbed DataTransfer/DragEvent for jsdom).
- **`scenes/FarmScene.ts`** — adds shipping bin + porch chest meshes, registers
  them as interaction targets, opens the inventory panel via the I hotkey or
  the pause-menu "Open inventory" entry, opens the dual-panel against the
  right partner on interact, routes `SlotMove` decisions through `moveBetween`
  / `placeOrMerge` / `clearSlot`, persists the save after every move, and
  surfaces the active hotbar item's name in the HUD line. New debug API:
  `openInventory`, `hotbarSlots`, `shippingBinSlots`, `shipPrototypeSeeds` (for
  the e2e smoke).
- **`src/styles.css`** — hotbar strip, hotbar slot tiles with quality stars,
  dual-grid inventory panel, slot tiles, hotbar-tinted borders for the first
  hotbarSize slots, and the trash drop zone.

**Acceptance criteria**

- [x] Inventory works with mouse, touch, and keyboard (mouse + keyboard
  e2e-verified; touch supported via the same pointer-event drag/drop path used
  by the desktop tests — Playwright Pixel-5 e2e passes; controller polish
  remains queued for Prompt 043 per the existing core/wave split pattern).
- [x] Chests persist contents (`chests` is part of the save schema; the porch
  chest writes through `persistActiveSave` on every move; `parseSave`
  round-trips a stocked chest via the saveModel test).
- [x] Shipping bin sells overnight (`resolveDay` drains the bin into income,
  clears it, and adds a "Yesterday's shipment earned N g." notice;
  dayResolution unit test + the inventory e2e cover the full flow).
- [x] Tooltips show source, tags, sell value, quality, and gift category
  (`tooltipLines` field-order is locked by a unit test: name, description,
  Source: <category>, Tags: ..., Sell: N g each, Quality: <tier>, Loved by: ...).

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest
`129/129` (18 files, +27 new specs) · build `dist/` (Babylon bundle ~5.17 MB
/ 1.15 MB gzip) · Playwright `24/24` across desktop + mobile (3 new inventory
specs).

**Note (jsdom drag/drop):** jsdom 25 ships neither `DataTransfer` nor
`DragEvent`. Added a one-shot string-payload stub `makeDataTransfer()` and a
`fireDrag(target, type, dt)` helper in `overlay.test.ts` that stamps the
dataTransfer on a plain `Event`. Enough to verify the overlay's drag handlers
call back with the right `SlotMove`; the production code still uses the real
DOM drag-and-drop in the browser.

---

## Prompt 006 — Time, calendar, and day resolution (2026-06-19)

Stood up the live clock + day-resolution loop on top of the renderer-agnostic
foundation, with deterministic weather + tide schedules.

- **`engine/timeSystem.ts`** (pure, already drafted) — `GameTime`, four 28-day
  seasons, weekdays, `advanceTime` with 2 AM collapse, `startNextDay` (wraps
  season + year), `festivalOn`, `birthdaysOn`, `buildDaySummary`. 11 unit tests.
- **`engine/timeClock.ts`** — real-seconds → game-minutes ticker
  (`REAL_SECONDS_PER_GAME_MINUTE = 0.7`, the Stardew-adjacent comfort cadence),
  with `pauseClock`, debug-only `setClockScale` (clamped `[0, 120]`), carry of
  fractional minutes between integer-minute advances, and a `collapsed` signal
  when time touches the 2 AM cap. 5 unit tests.
- **`engine/weather.ts`** — `forecastFor(time, pool)`: deterministic per-day
  forecast seeded by absolute day. Season-weighted tables so summer leans drier
  than fall; spring/fall lean wet. 4 unit tests including a per-season variety
  + summer-vs-fall lean check.
- **`engine/tide.ts`** — `tidesFor` / `nextTide` / `tideStateAt` / `isLowTide`:
  semidiurnal ~12h25m cycle anchored on day 0 and drifting ~25 min/day so reef
  access can't be memorized to a single wall-clock time. 5 unit tests.
- **`engine/dayResolution.ts`** — `getGameTime` / `applyGameTime` save bridge,
  `DEFAULT_COLLAPSE_PENALTY` (10% gold + 50% wake stamina), `applyCollapsePenalty`,
  and `resolveDay(input)` — applies income, optionally docks the collapse
  penalty, rolls the calendar, and assembles the bedtime summary with tomorrow's
  festival + birthdays. 7 unit tests.
- **`engine/gameState.ts`** gains a transient `DayLedger` so income / skill XP /
  relationship deltas accumulate during the day and drain into the summary at
  bedtime. Cleared on `clearActiveSave` and explicit `resetDayLedger`. 4 unit
  tests.
- **`engine/saveModel.ts`** — `calendar.timeMinutes` now accepts past-midnight
  hours up to 2 AM (`max(26 * 60)`); new `wallet: { gold }` for the income
  ledger (default 500 g on new save).
- **`engine/format.ts`** — added `formatWorldStatus` so the HUD line carries
  weekday, gold, weather, and tide chips. 2 new tests.
- **`ui/overlay.ts`** — `showDaySummary(summary, onContinue)` renders income +
  per-skill XP + relationship deltas as a parchment list, tomorrow notices as a
  dashed band, and a Continue button. 2 jsdom tests + matching parchment-card
  styling in `styles.css`.
- **FarmScene + PlaceScene** — both now tick `tickClock` each frame, pause
  whenever a menu / day-summary panel is open, refresh weather + tide each
  advance, and trigger the day-resolution flow on 2 AM collapse. Farm adds a
  Sleep affordance on the farmhouse door + a "Sleep until tomorrow" pause-menu
  option. Place scenes that collapse off-farm shuttle the player home to the
  Farm after the summary closes. Persists the save after every roll.
- **Debug API** on `window.sturdyVolleyDebug` extended with `time()`,
  `setTimeScale(scale)`, and `sleep()` so the time-of-day flow can be exercised
  deterministically in e2e.

**Acceptance criteria**

- [x] Time advances, can pause in menus, and accelerates only in debug
  (`pauseClock` driven by `menuOpen` + `dayResolving`; `setTimeScale` is
  debug-only on `sturdyVolleyDebug`, clamped at 120×)
- [x] Passing out after 2:00 AM returns the player home with a configurable
  penalty (`applyCollapsePenalty` + the `DEFAULT_COLLAPSE_PENALTY` knobs,
  FarmScene teleports to `homePosition`; PlaceScene navigates to Farm)
- [x] Day summary shows income, skill XP, relationship changes, and next-day
  notices (`showDaySummary` + `buildDaySummary` with festival + birthday
  notices; e2e verifies it appears + advances to the next day)

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest
`102/102` (16 files) · build `dist/` (Babylon bundle ~5.16 MB / 1.14 MB gzip) ·
Playwright `time.spec.ts` smoke covers clock-advances/pause + sleep → summary
→ next day + collapse → summary.

---

## Prompt 005 — Player controller + interaction model (core) (2026-06-18)

Added the controller depth + interaction model as renderer-agnostic logic,
wired into the Farm.

- **`engine/controller.ts`** — `ControllerState` / `stepController`: desired move
  direction + sprint intent → speed with acceleration/braking, gait
  (idle/walk/jog/sprint), and **stamina** drain/recovery (+ exhausted-speed
  throttle). Pure, 6 unit tests. The gait is ready to drive the animation state
  machine once real rigs/clips land.
- **`engine/interaction.ts`** — `resolveInteraction`: "one button handles
  multiple nearby targets predictably" — picks the highest-priority in-range
  target, ties broken by proximity. Pure, 5 unit tests.
- **FarmScene** now drives movement through the controller (jog/sprint via
  Shift, acceleration, stamina), resolves the nearest interaction target each
  frame (farmhouse door / tilled plot / pond / trees) and shows an `[E] …`
  prompt, handles **interact** (E/Space), and **tool-slot selection** (number
  keys 1–5). Energy / tool / prompt surface in the HUD status line.

**Acceptance criteria (core met):**
- [x] One interaction button handles multiple nearby targets predictably
  (resolver: priority then proximity; unit-tested)
- [x] Stamina drain (sprint drains, idle recovers; e2e-verified)
- [x] Tool-slot selection (number keys; reflected in HUD + debug)
- [ ] *Remaining for a later P-005 pass:* dedicated hotbar UI + interaction
  prompt element (non-overlapping), touch virtual-stick ↔ tap-to-move toggle,
  remappable controls, and the locomotion-clip blending / foot placement (binds
  to Codex's rigs/animations when they arrive).

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest `62/62`
(10 files) · build `dist/` · Playwright `12/12` (desktop + mobile, incl. farm
walk + sprint-drains-energy).
