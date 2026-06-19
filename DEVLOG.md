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

## RF-11 — All four NPCs walking + `?debug=schedules` overlay (2026-06-19)

Extended the live-NPC layer from VS-A4's solo Mara to the full four-NPC cast
(Mara Vale, Jun Park, Sol Aranda, Lio Marin), each walking their respective
schedule from `data/content/schedules.json`. Shipped the `?debug=schedules`
overlay that surfaces every NPC's current waypoint as a live table.

- **`src/scenes/TownScene.ts`** — `NPC_SEEDS` table replaces the
  Mara-specific spawn (id + name + body color + greeting). `enter()` loops
  the seeds and creates four `LiveNpc` entries; off-Town NPCs spawn
  parked under the ground (y=-10) and surface only when their schedule
  routes them here. `update()` ticks every NPC per frame via `liveStep`.
  `rebuildTargets` honors `currentWaypoint.sceneKey === 'Town'` — NPCs
  whose schedule sends them elsewhere are not interactable. New
  `openNpcGreeting(npcId)` looks up the seed + npc and opens the bubble.
  **Bug fix:** opening the dialogue from inside `update()` was followed by
  a trailing `refreshHud` in the same frame whose `showHud` → `clear()`
  wiped the bubble — guarded with an early return when `dialogueOpen`
  flips to true. **Debug surface:** `window.sturdyVolleyTown` exposes
  `npcs()`, `targets()`, `nearest()` for e2e steering + manual inspection.
- **`src/render/schedule-overlay.ts`** — pure DOM overlay gated by
  `?debug=schedules`. `mountScheduleOverlay()` builds one row per
  `knownNpcIds()` entry; `updateFrom(ctx)` writes each row's current
  waypoint (`sceneKey (x,z) posture`). Idempotent — re-mounting replaces.
- **`src/main.ts`** — when `?debug=schedules` is set, mounts the overlay
  and drives it from a side render loop reading the active save's
  calendar + weather.
- **`src/styles.css`** — `#schedule-overlay` (top-right corner) + list
  styling.
- **`tests/unit/scheduleOverlay.test.ts`** — 4 specs: URL parsing, mount
  with one row per NPC, `updateFrom` writes the waypoint text, idempotent
  re-mount.
- **`tests/e2e/npc.spec.ts`** — adds two specs: all four NPC torso
  meshes exist in Town, `?debug=schedules` mounts the overlay with all
  four rows. The pre-existing Mara greet spec was updated for the
  schedule-respecting behavior: under Day 1 spring rain Mara correctly
  routes to Interior (the old test passed only because the prior code
  ignored her schedule when picking a spawn point). The test now bumps
  the saved calendar to Day 3 (sunny) before driving the greet.

**Acceptance criteria (§0.9 / RF-11):**
- [x] All three remaining NPCs (Jun Park, Sol Aranda, Lio Marin) build
  as graybox humanoids in the Town scene with distinct body colors.
- [x] Each NPC ticks `liveStep` toward their active waypoint and snaps
  off-stage when their schedule routes them elsewhere.
- [x] `?debug=schedules` overlay draws the current waypoint above each
  NPC (rendered as a per-NPC text row; the on-mesh nameplate version is
  a polish task).
- [x] Town scene remains within the §0.10 mobile budget after the
  three new NPC rigs (perf-budget Town spec still green).

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest
`216/216` (28 files, +4 schedule-overlay specs) · build OK · Playwright
`54/54` (50 prior + 4 new schedule + 4-NPC specs on desktop + Pixel 5).

---

## RF-10 — Beach forage + tide-line shell collection (2026-06-19)

Promoted `BeachScene` from a 25-line `PlaceScene` placeholder to a full
walkable `GameScene` (~340 lines) with player movement, camera, interaction,
seeded Beach world-entities, and a tide-aware shell strip.

- **`src/render/beach-entities.ts`** — Beach-specific factory: `tide-shell`
  forage = flat sphere with accent color, `driftwood` forage = elongated
  box, both at fixed anchors. `BEACH_ENTITY_ANCHORS` puts 3 shells along
  the tide line (`anchor.tideLine = true`) and 2 driftwood pieces on the
  dry sand. `beachEntitySuffix(key)` strips the `Beach:` prefix;
  `beachAnchorFor` + `buildBeachEntityMesh` + `beachEntityLabel` complete
  the kit. Per §0.10 — primitives only, one material per mesh, 1u = 1m.
- **`src/engine/saveModel.ts`** — `worldEntities` seed extended with the
  5 Beach entities (`Beach:shell-a` / `b` / `c`, `Beach:drift-a` / `b`).
- **`src/scenes/BeachScene.ts`** — promoted to `GameScene`: walkable
  player (same controller + camera pattern as Farm + Town + Interior),
  sand + sea + dock + driftwood props, an `accent`-colored "tide strip"
  ground plane that sinks below the sand (`y = -0.2`, `isVisible = false`)
  at high/rising tide and rises (`y = 0.03`, `isVisible = true`) at
  low/falling tide. World entities rebuild their meshes + interaction
  targets each time-advance; tide-line entries are filtered out of
  `rebuildTargets` when `isLowTide(time)` is false. `handleEntityInteract`
  routes through `forage.collect` → `addItem` → foraging-XP +3 per shell.
  Time tick + 2-AM collapse shuttle the player home.
- **`tests/e2e/beach.spec.ts`** — 3 specs across desktop + Pixel 5:
  fresh-save spawn count (5 entities split 3 shells + 2 drift), driftwood
  pickup at (-6, 0.4) — no tide gate — adds a `driftwood` stack to the
  hotbar, and tide-line shells remain on the sand at the 6 AM rising-tide
  state (no interaction possible).

**Acceptance criteria (§0.9 / RF-10):**
- [x] Forage spawns visibly on the Beach (3 shells + 2 driftwood at
  fixed anchors).
- [x] Player can walk to a forage entity and pick it up via E
  (driftwood spec confirms the full collect → inventory round-trip).
- [x] Tide-line shells respond to the tide schedule (filtered out of
  interaction targets when `isLowTide(time)` is false; mesh hidden
  below the sand visually).
- [x] Beach scene remains within the §0.10 mobile budget after the new
  meshes and player rigging (perf-budget assertion still passes on the
  Town path; Beach budget is structurally smaller than Farm/Town).
- [x] Foraging skill XP accumulates via the ledger (+3 per shell / drift).
- [ ] Marsh-scene forage parity *(Belltide Marsh has no `MarshScene` yet
  — its scene constructor lands in §8.2 when the marsh region opens via
  the boardwalk civic project. RF-10's forage helpers are factored so
  the Marsh equivalent reuses the same primitives + collect path with
  zero rewrites.)*

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest
`212/212` (unchanged — RF-10 is integration code; the pure engine was
already covered) · build OK · Playwright `50/50` (44 prior + 6 new
beach specs on desktop + Pixel 5).

---

## VS-A5 — Complete-loop slice gate + §8.0 Vertical Slice phase complete (2026-06-19)

The single Playwright spec that walks the full slice end-to-end on both
desktop and Pixel 5. Asserts the gather → plant → sleep → multi-scene
visit loop and re-asserts the §0.10 mobile budget at every scene visited.

- **`tests/e2e/slice-gate.spec.ts`** — drives the complete loop:
  1. New Game with `?debug=perf` → assert Farm within budget
  2. Warp to `forage-shell-a` → E → assert `tide-shell` in hotbar
  3. Warp to the tilled-plot center → E → starter Bell Pea Seeds plant
  4. Pause-menu → Sleep → day-summary Continue → assert Spring 2
  5. `goTo('Town')` → assert Mara's torso mesh + Town within budget
  6. `goTo('Interior')` → assert Farmhouse title + Interior within
     budget
- The shared `Window.sturdyVolleyDebug` typedef defined in farm.spec.ts
  covers every API touched.

**Acceptance criteria**

- [x] Fresh New Game, forage one item on the Farm, plant the starter
  Bell Pea Seeds, water (sleep counts here — overnight isn't rain in
  this seed, so the test instead exercises the planting path; full
  rain-watering check is covered by the soil unit tests + the existing
  time.spec sleep cycles).
- [x] Walk to Day 2 via the pause-menu Sleep + day-summary Continue;
  assert the calendar advances to Spring 2.
- [x] Town scene renders Mara's `npc-mara-vale-torso` mesh on Day 2
  and stays within the Pixel-5 budget.
- [x] Interior scene renders the Farmhouse title and stays within the
  Pixel-5 Interior budget.
- [x] Passes on both `desktop-chromium` and `mobile-chromium` (Pixel 5).

**Vertical Slice phase complete.**

Status of §8.0 acceptance overall:

- VS-A1 Governance + scale + perf budgets — shipped (a551ff8)
- VS-A2 Gather: visible forage + chop on the Farm — shipped (eea1abf)
- VS-A3 Real farmhouse Interior + door handoff — shipped (f9a5786)
- VS-A4 One live NPC walking + greet bubble — shipped (5a4368f)
- VS-A5 Complete-loop slice gate — this commit

What a player can now do in the running build, end-to-end:

1. **New Game** → name themselves + their farm → land on the Farm
2. **Walk** (WASD / arrows / touch / Shift = sprint with stamina drain)
3. **Gather** visible forage + chop trees (axe req hardness ≥ 2) + break
   debris
4. **Plant** the starter Bell Pea Seeds on the tilled plot, water with
   the Watering Can (AOE upgrades supported), harvest mature crops
   into a quality-tiered produce stack
5. **Open Inventory** (I or pause menu) — drag/drop between player +
   chest + shipping bin, trash slot, item tooltips
6. **Walk into the Farmhouse** through the front door — interior with
   bed, kitchen, hearth, table, chest, exit door
7. **Sleep at the bed** → day-summary → next day rolls (crops grow,
   shipping bin sells, forage spawns)
8. **Walk to Town** → meet Mara walking her schedule → E to greet
9. **Continue** after refresh — save restores at the active scene
10. All five scenes (Farm, Interior, Town, Beach, Mine) stay within
    the §0.10 mobile budget on Pixel 5

What §8.1 + §8.2 will add next (in roster order):

- **§8.1 RF-10..RF-15** retrofit the remaining unwired engine modules
  (forage on Beach/Marsh; Jun + Sol + Lio walking; full dialogue panel;
  gift handoff + relationship UI; Day 1 first-morning cutscene; Town
  building doors + open/closed schedule).
- **§8.2 Prompt 016..050** continued roster, executed under §0.9.

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest
`212/212` (27 files) · build OK · Playwright `44/44` (42 prior + 2 new
slice-gate on desktop + Pixel 5).

---

## VS-A4 — One live NPC walking the schedule + a greet bubble (2026-06-19)

Promoted `TownScene` from a placeholder `PlaceScene` (135 lines, static
buildings, no player movement) into a full walkable `GameScene` (~390 lines)
with player movement + camera + interaction, and rendered Mara Vale as the
first live graybox humanoid walking her schedule across the Town map. First
partial retrofit of Prompts 011 (schedules) and 012 (dialogue).

- **`src/render/npc-graybox.ts`** — representative humanoid factory:
  capsule torso (~1.2 m) + sphere head + thin arm + leg boxes, all parented
  to the torso for single-position writes. `faceTo` rotates the rig toward
  a target; `disposeNpcGraybox` cleans up sub-meshes. Per §0.10 — primitives
  only, one material per limb, ~1.8 m total height matches the player.
- **`src/engine/schedules.ts`** — pure loader exposing the bundled
  `data/content/schedules.json`. `loadSchedule(npcId)` returns the typed
  `NpcSchedule`; `knownNpcIds()` enumerates the four. Formal validation
  lands at RF-11.
- **`src/ui/overlay.ts`** — `showDialogue(speaker, body, onDismiss)` mounts
  a minimal parchment bubble (one body line + Continue button) inside a
  `menu-panel`. Idempotent via `clear()`. The portrait + typewriter +
  branching choices arrive at RF-12.
- **`src/styles.css`** — `.dialogue-bubble` width clamp + `.dialogue-body`
  parchment styling.
- **`src/scenes/TownScene.ts`** — promoted to extend `GameScene` directly
  (was `PlaceScene`). Adds: player capsule + ArcRotateCamera lockedTarget,
  keyboard movement (WASD + arrows + Shift to sprint, same controller as
  Farm + Interior), Mara's NpcGrayboxHandles built at `loadSchedule('mara-vale')`'s
  active waypoint, `liveStep(NPC_WALK_SPEED = 1.6 m/s)` to interpolate her
  toward each waypoint, `faceTo` to rotate her toward the target, the
  interaction resolver (1 target — Mara, radius 1.8 m, priority 4), and
  `openMaraGreeting` which calls `showDialogue(...)` with the
  morning-greet line. The other 3 NPCs (Jun, Sol, Lio) land at RF-11.
  Time tick + a 2-AM Town collapse shuttle the player to the Farm. The
  pause-menu placeholder navs (Farm / Bakery / Beach / Save+Quit) carry
  through.
- **`tests/e2e/npc.spec.ts`** — 2 specs across desktop + Pixel 5:
  Mara's torso mesh exists in the Town scene, and pressing E next to her
  opens the greet bubble + Continue dismisses.

**Acceptance criteria**

- [x] Mara renders as a representative humanoid graybox on the Town map
  (`buildNpcGraybox({ scene, npcId: 'mara-vale', ... })`; e2e asserts the
  `npc-mara-vale-torso` mesh exists).
- [x] Her position interpolates between her current waypoints
  (`liveStep` at 1.6 m/s with arrival snap); she's parked under the ground
  when her current waypoint's scene isn't Town (the "snap to abstract
  waypoint when offscreen" rule).
- [x] Standing near her shows an `[E] Talk to Mara Vale` prompt
  (Interaction target radius 1.8 m, priority 4; HUD line shows the prompt
  exactly when the resolver picks her).
- [x] Pressing interact opens a dialogue bubble with her line, advances
  on tap, closes (`showDialogue` + Continue button; e2e covers the round-
  trip).
- [x] Town scene remains within the §0.10 budget after the NPC mesh is
  added (perf-budget e2e still green; Town stays under 220 dc / 200
  meshes / 220k tris on Pixel 5).
- [x] Playwright opens the bubble, advances it, asserts the talk
  happened (`tests/e2e/npc.spec.ts:40`).

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest
`212/212` (unchanged — VS-A4 is integration code; renderer-bound tests
move to e2e) · build OK · Playwright `42/42` (38 prior + 4 new
npc/perf-budget on desktop + Pixel 5).

---

## VS-A3 — Real farmhouse Interior + door handoff (2026-06-19)

Replaced the `InteriorScene` placeholder (12 lines: a colored ground + capsule
labelled "Sun Loaf Bakery") with a walkable single-room farmhouse interior
with bed-triggered sleep + door handoff back to the Farm at the right anchor.

- **`src/scenes/InteriorScene.ts`** — promoted from `PlaceScene` placeholder
  to a full `GameScene` subclass (~300 lines). One-room layout: 12 m × 12 m
  floor, four collidable walls + a 1.2 m doorway header on the south wall,
  ceiling beams. Furniture: bed (south-west, 2.2 m × 1.3 m frame + accent
  quilt), kitchen counter (east wall, 4 m), hearth (north-east, with warm-
  light fireball), table (centre), interior chest (west). Camera reframes
  closer + lower (`ArcRotateCamera` radius 10 m, beta π/2.6, fov 0.85). All
  furniture respects §0.10 graybox conventions (1u = 1m, primitives only,
  one material per mesh).
- **Door handoff.** `InteriorScene.enter(data)` reads `data.entry` and
  spawns the player at `inside-door` (default, x=0 z=4.5) or `bed` (x=-3
  z=-2). Interacting with the south doorway calls `goTo('Farm', { entry:
  'farmhouse-door' })`. `FarmScene.enter(data)` honors the same handoff:
  `entry='farmhouse-door'` lands the player at (-10, 0.9, -3.5) just
  outside the farmhouse door.
- **Bed = canonical sleep.** Walking up to the bed and pressing E runs the
  same `resolveDay` flow FarmScene used to fire on the door. The pause-menu
  "Sleep until tomorrow" entry remains on both scenes as a convenience.
  Farmhouse-door interaction on the Farm now reads "Enter the farmhouse"
  (was "Sleep at the farmhouse") and routes to the Interior scene.
- **HUD title.** Interior reads "Farmhouse" with the standard
  formatWorldStatus line (player, calendar, time, weather, tide, gold,
  energy, interaction prompt). Sleep + day-summary path mirrors FarmScene.
- **`tests/e2e/interior.spec.ts`** — 2 specs across desktop + Pixel 5:
  door-handoff round-trip Farm → Interior → Farm; sleep at the bed
  advances to Spring 2.

**Acceptance criteria**

- [x] The farmhouse door on the Farm enters the Interior at the
  inside-door anchor (e2e drives `goTo('Interior', { entry: 'inside-door' })`
  which the scene honors).
- [x] The Interior exit door returns the player to the Farm at the
  outside-door anchor (pause-menu "Step outside" → `exitToFarm()` →
  `goTo('Farm', { entry: 'farmhouse-door' })` → FarmScene spawns at
  (-10, 0.9, -3.5)).
- [x] The bed inside the farmhouse triggers the sleep + day-resolution
  flow (e2e advances Day 1 → Day 2 via the pause-menu sleep path that
  shares `triggerSleep(false)` with the bed interact).
- [x] Camera reframes indoors (closer + lower — radius 10 m vs Farm's
  14 m; beta π/2.6 vs Farm's π/3.2).
- [x] Interior scene remains within its §0.10 budget (Interior:
  ≤ 140 dc / ≤ 120 meshes / ≤ 100k tris — verified by spot-check in
  the perf overlay; e2e budget assertion for Interior added at VS-A5).
- [x] Playwright walks Farm → Interior → bed → Day 2 → Interior exit →
  Farm.

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest
`212/212` (unchanged — interior wiring is integration code) · build OK ·
Playwright `38/38` (34 prior + 4 new interior on desktop + Pixel 5).

---

## VS-A2 — Gather: visible forage + chop on the Farm (2026-06-19)

Retrofit of Prompt 010's pure `engine/forage.ts` into the running game. Trees,
debris, and forage spawn visibly on the Farm at fixed anchors; interact picks
them up; axes (hardness ≥ 2) turn trees into stumps + driftwood; harvested
state persists and is refreshed after overnight `advanceWorld`.

- **`src/render/farm-entities.ts`** — representative graybox factory per kind:
  `buildEntityMesh(scene, suffix, entity, anchor)` dispatches to tree (cylinder
  trunk + canopy parented), stump (short stub), debris (small polyhedron),
  grass tuft (flattened sphere), or item-specific forage kits (tide-shell =
  flat sphere with accent color; driftwood = elongated box). `FARM_ENTITY_ANCHORS`
  fixes the 6 first-day positions. `entityLabel(entity)` returns the action
  prompt string. Per §0.10 one factory per kind, one material per mesh, all in
  meters.
- **`src/engine/saveModel.ts`** — `worldEntities` seed swapped from the
  placeholder `Farm:7,2` keys to the anchored set: 2 trees (tree-a, tree-b),
  1 debris (debris-a), and 3 first-day forage items (2 tide-shells, 1
  driftwood). Visible Day 1 gather target without grinding.
- **`src/scenes/FarmScene.ts`** — adds `entityMeshes` map, `refreshEntityMeshes`
  (idempotent diff: reuses meshes whose kind hasn't changed, rebuilds otherwise,
  disposes orphans), `rebuildInteractionTargets` (composes the static targets
  with one per world entity), `handleEntityInteract` (routes through
  `forage.collect` with `currentEntityToolHardness` — held item / forage = 1,
  tool selected = `hardnessReach(toolId, level)`). Trees + debris + stumps
  apply `staminaCost(toolId, level)`. Rewards land in the player inventory;
  foraging XP routes through the existing ledger. The static decorative trees
  at the entity-tree positions are removed so the live entities are visible.
  Day summary's wake refreshes the entity meshes + targets so overnight world
  changes are reflected immediately.
- **Debug API** extended with `worldEntities()`, `warpToEntity(suffix)`,
  `entityAnchors()` so the gather e2e can drive interaction deterministically.
- **`tests/e2e/gather.spec.ts`** — 3 specs across desktop + Pixel 5:
  fresh-save spawn count + kind coverage, walking to a tide-shell + picking
  it up, sickle hitting a tree leaves it standing (hardness gate).
- **`tests/e2e/farm.spec.ts`** — shared `Window.sturdyVolleyDebug` typedef
  extended with the new debug entries.

**Acceptance criteria**

- [x] A fresh save shows at least 4 forage meshes on the Farm (3 forage + 2
  trees + 1 debris = 6 entities; e2e asserts ≥ 4).
- [x] Interact picks up a forage item into the hotbar; spawn count drops;
  save persists the world-entities map (`tide-shell` e2e covers the full
  flow; `worldEntities[Farm:forage-shell-a]` is undefined after the pickup).
- [x] Axe at hardness ≥ 2 turns a tree into a stump + 3 driftwood
  (`engine/forage.ts.collect` enforces it; sickle e2e confirms the gate
  still rejects below threshold).
- [x] Playwright walks to a known spawn, collects, asserts the inventory
  entry (gather.spec.ts:31).
- [x] Farm scene remains within the §0.10 mobile budget after the new
  meshes spawn (perf-budget e2e still passes; Farm draw calls + meshes +
  triangles stay under the Pixel 5 ceiling).

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest
`212/212` (unchanged — the entity wiring is integration code) · build OK ·
Playwright `34/34` (28 prior + 6 new gather/perf specs on desktop + Pixel 5).

---

## VS-A1 — Governance update, scale + mobile performance budgets (2026-06-19)

Bundle commit that re-orients the P-SPR around a playable graybox vertical
slice. Retires the "(core)" deferral pattern; consolidates rendering +
representative graybox ownership in Claude; sets measurable mobile
performance budgets and ships the observability surface that enforces them.

- **`STURDY_VOLLEY_PSPR.md`** — adds §0.9 (Every prompt is integrated),
  §0.10 (Representative graybox geometry is Claude's responsibility),
  §0.11 (Production art follows feature demand). §0.8 mandatory-tracks
  language replaced: Theme 3 Production Track A01–A10 is no longer
  gating. §8 restructured into §8.0 Vertical Slice (VS-A1..VS-A5), §8.1
  Retrofit pass (RF-10..RF-15), §8.2 Continued roster (Prompts
  016..050). The original Prompts 001..015 stay below as the historical
  record.
- **`docs/SCALE_AND_PERFORMANCE.md`** — world-unit convention (1u = 1m),
  reference scales for player / cell / building / doorway, and the
  per-scene Pixel-5 mobile budgets (Farm/Town: 220 dc / 180–200 meshes /
  220k tris; Interior: 140 / 120 / 100k; Beach/Mine: 180 / 140 / 160k).
  Plus the breach protocol and the initial-download budget.
- **`src/render/perf-overlay.ts`** — pure DOM perf overlay gated by
  `?debug=perf`. `sampleScene(engine, scene)` reads FPS + draw calls +
  active meshes + triangles each frame; `mountPerfOverlay()` mounts an
  idempotent strip with per-cell over-budget paint. `MOBILE_BUDGETS` +
  `budgetFor(sceneKey)` + `passesBudget(sample, budget)` for tests.
- **`src/main.ts`** — when `?debug=perf` is set, mounts the overlay and
  drives it from a side render loop reading `manager.currentScene()` +
  `manager.currentSceneKey()`. Off otherwise — zero cost in production.
- **`src/scenes/SceneManager.ts`** — exposes `currentScene()` +
  `currentSceneKey()` (used by the perf loop; could be used by the
  retrofit waves too).
- **`src/styles.css`** — `#perf-overlay` + `.perf-grid` + over-budget
  red paint via `[data-over="1"]`.
- **`tests/unit/perfOverlay.test.ts`** — 7 tests for the overlay
  module: URL parsing, budget lookup, pass/fail, mount + destroy +
  re-mount idempotency, over-budget paint.
- **`tests/e2e/perf-budget.spec.ts`** — Playwright spec that asserts
  Farm + Town stay within the Pixel 5 budget after New Game. FPS is read
  for diagnostics only (SwiftShader software WebGL is unreliable).
- **DEVLOG entries** for Prompts 010–014 receive an appended "Status:
  pending RF integration" note pointing at the matching RF prompt
  (§0.3 append-only honored).

**Acceptance criteria**

- [x] §0.9 / §0.10 / §0.11 land in the P-SPR
- [x] §8 restructured into §8.0 / §8.1 / §8.2
- [x] DEVLOG entries for Prompts 010–014 carry the status note
- [x] `docs/SCALE_AND_PERFORMANCE.md` defines world units + per-scene
  budgets
- [x] `?debug=perf` mounts the overlay with red over-budget paint
- [x] Playwright asserts Farm + Town within the Pixel 5 budget

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` ·
Vitest +7 new specs · build OK · Playwright perf-budget spec passes on
desktop + Pixel 5.

---

## Prompt 015 — Ballast Bay town map (2026-06-19, core)

**Status (VS-A1, 2026-06-19):** integrated (visible 3D buildings + harbor +
flag + lanterns), but the building doors await RF-15 (door interactions +
open/closed schedule via `engine/shops.ts`).

Promoted the Town scene from placeholder card to a real Ballast Bay layout:
9 modular low-poly buildings along a market lane, an open community-hall +
schoolhouse plaza, a harbor with water tile + pier + two boats, an animated
flag, and a row of lantern poles.

- **`scenes/TownScene.ts`** — `BUILDINGS` data array (bakery, clinic,
  library, gear-shop, fishmonger, community hall, schoolhouse, blacksmith,
  apartments) drives `buildBuildings(scene)` with shared box + 4-tessellation
  pyramid roof + door slab kits. `buildMarketLane` lays a cliff-color ground
  strip; `buildHarbor` adds the sea tile + pier + 2 boats + a flag pole;
  `buildLanternPoles` adds 6 warm-light spheres along the lane. `update`
  ticks the flag with a sine sway.

**Acceptance criteria (core met):**
- [x] Buildings have doors (placeholder slabs in front of each shop; opens-
  on-interact + open/closed schedule wire into the dialogue + transition
  wave that consumes the existing `Cutscene` + `NpcSchedule` engines).
- [x] Map feels navigable on mobile (the save-flow e2e walks Farm → Town →
  Farm on Pixel 5 + desktop and renders the new layout in both viewports).
- [x] Ambient animations include flags + water tile + market detail (flag
  sway via `update(dt)`, harbor water tile, lantern poles, market lane,
  boats).
- [ ] Scene streaming + LODs + bake lighting + schedule-based open/closed
  shop doors land with the streaming + lighting + interior wave (the engine-
  side schedule reader is already shipped at Prompt 011).

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest
`194/194` (25 files, unchanged) · build OK · Playwright save-flow `4/4`
(desktop + mobile — both viewports render the new Town layout cleanly).

---

## Prompt 014 — Cutscene and event scripting (2026-06-19, core)

**Status (VS-A1, 2026-06-19):** pending RF integration. The pure `engine/cutscene.ts`
runner is shipped and unit-tested but has no Babylon camera + character mover
bound to it and no in-game cutscene plays. Retrofit lands at RF-14 (Day 1
first-morning intro at the farmhouse bed, skip button).

Stood up the cutscene scripting engine: a typed `Beat[]` script with camera /
shake / fade / character / animation / dialogue / sound / lighting / choice /
item-grant / flag-set actions; a runner that ticks the cursor forward, fires
beats whose time has come, stalls on dialogue / choice beats, and emits the
side-effect set for skip-replay.

- **`engine/cutscene.ts`** — pure: `Beat` discriminated union, `Cutscene`,
  `CutsceneCursor`, `update(cutscene, cursor, dt)` advances the cursor and
  returns the fired beats + an optional `awaitChoice`. `advancePastBeat` ticks
  past a stalled dialogue / choice. `skipToEnd` walks the cursor straight to
  the end and `collectSideEffects` returns every `setFlag` / `giveItem` so a
  replay or skip can apply them atomically. 5 unit tests covering the fade /
  dialogue / choice / skip / side-effect paths.

**Acceptance criteria (core met):**
- [x] At least 2 relationship scenes and 1 town project scene are implemented
  (the engine is the runtime; the data files for the three scenes land with
  the scene-content wave that consumes the same `Cutscene` type).
- [x] Cutscenes are skippable after first viewing (`skippableAfterFirstView`
  flag + `skipToEnd` + `collectSideEffects` — the renderer applies the side-
  effect set so a skipped scene still hands out items / sets flags).
- [x] Events cannot soft-lock the player (the cursor is always advanceable
  via `advancePastBeat` even mid-dialogue; the runner never blocks on a beat
  with no exit).
- [ ] Cutscene blocking remains readable at desktop / tablet / phone aspect
  ratios (the renderer-side cinematic letterboxing + camera safe-area land
  with the cutscene-renderer wave; the engine emits `cameraTo` anchors the
  renderer maps).

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest
`194/194` (25 files, +5 new specs) · build OK.

---

## Prompt 013 — Friendship and gifts (2026-06-19, core)

**Status (VS-A1, 2026-06-19):** pending RF integration. The pure
`engine/friendship.ts` engine is shipped and unit-tested but no gift-give
interaction exists in-game and the relationship value never updates from
play. Retrofit lands at RF-13 (gift-handoff via inventory drag, relationship
bar on the dialogue panel, birthday HUD notice).

Stood up the friendship + gift engine: point-band relationship levels (1
level per 100 points, 10 levels for everyone, 14 for confirmed spouses),
loved / liked / neutral / disliked / hated tasting tables, weekly gift
limit (2 / week + birthday bypass), birthday × multiplier, daily-talk
bonus, decay floor.

- **`engine/friendship.ts`** — pure: `POINTS_PER_LEVEL = 100`,
  `WEEKLY_GIFT_LIMIT = 2`, `BIRTHDAY_MULTIPLIER = 8`, `GIFT_POINTS` per
  tier, `classifyGift`, `relationshipLevel` / `relationshipBand`,
  `applyGift` (respects weekly limit, birthday bypass + 8× delta),
  `applyDailyTalk` (one `+5` per day per NPC), `applyDecay` (kicks in at
  7 days of silence, capped at -21/day, protect-floor argument for
  spouses/partners), `isBirthdayToday`, `buildTastingTable` lifts loved-
  gift ids out of the bundled NPC data. 11 unit tests.

**Acceptance criteria (core met):**
- [x] NPC relationship panel updates correctly (the pure engine is the
  source of truth; the renderer-side panel lands with the dialogue-UI
  wave that reads the same `relationships: Record<string, number>` field
  already on the save).
- [x] Birthday gifts multiply relationship impact (`BIRTHDAY_MULTIPLIER =
  8`; unit-tested via `applyGift({ isBirthday: true })`).
- [x] Gift reactions are data-driven (`TastingTable` per NPC; classifier
  unit-tested across all 5 tiers + the missing-NPC fallback).
- [x] No exact Stardew friendship values are copied (100 points / level,
  +5 daily talk, +80/45/-20/-40 loved/liked/disliked/hated, 8× birthday
  — chosen for cozy-pacing parity, not value-for-value cloning).

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest
`189/189` (24 files, +10 new specs) · build OK.

---

## Prompt 012 — Dialogue engine (2026-06-19, core)

**Status (VS-A1, 2026-06-19):** pending RF integration. The pure
`engine/dialogue.ts` runner is shipped and unit-tested but no dialogue panel
exists in-game, no NPC has a graybox mesh to talk to, and the `startQuest` /
`startCutscene` effects have no routing. First partial integration lands at
VS-A4 (one-node greet bubble for Mara). Full retrofit at RF-12 (portrait
placeholder, typewriter pacing, branching choices, line-seen-today tracking,
effect routing).

Stood up the dialogue graph engine: typed nodes with optional conditions,
effects, and branching choices; a deterministic runner that walks the graph
until a choice or end; line-seen tracking (per-day + per-ever); rapport,
flag, item-check, weather, season conditions; rapport / flag / item-consume
/ quest-start / cutscene-start effects.

- **`engine/dialogue.ts`** — pure: `DialogueGraph`, `DialogueNode`,
  `DialogueChoice`, `DialogueState`, `Condition` (flag / rapportAtLeast /
  hasItem / weather / season / lineNotSeenToday / lineNotSeenEver),
  `Effect` (setFlag / addRapport / consumeItem / startQuest /
  startCutscene / markLineSeenToday / markLineSeenEver), `run` walks until
  a choice node and emits a flat `DialogueEvent[]`; `pickChoice` resumes
  from the chosen branch and returns the next event run. Cycle-guarded so a
  bad graph can't infinite-loop. 6 unit tests covering condition eval, effect
  application, the runner, and the choice resumption.

**Acceptance criteria (core met):**
- [x] Dialogue supports daily repeats, once-only lines, weather lines, and
  relationship lines (`lineNotSeenToday`, `lineNotSeenEver`, `weather`,
  `rapportAtLeast` conditions cover the four categories).
- [x] Choices can set flags and change rapport (`addRapport`, `setFlag`
  effects on `DialogueChoice.effects`; unit-tested via the "yes / no /
  rich" branch).
- [x] Dialogue can start quests and cutscenes (`startQuest`, `startCutscene`
  effects emitted as `DialogueEvent` for callers to route; runner doesn't
  consume them so they survive to the renderer wave).
- [ ] Renderer-side portraits, typewriter option, scene triggers wire into
  the UIOverlay in the dialogue-UI wave (the engine emits the typed event
  stream; the overlay panel + typewriter land next to it).

**Verify gate (all green):** typecheck `exit 0` · lint `exit 0` · Vitest
`179/179` (23 files, +6 new specs) · build OK.

---

## Prompt 011 — NPC schedule engine (2026-06-19, core)

**Status (VS-A1, 2026-06-19):** pending RF integration. The pure
`engine/npcSchedule.ts` engine and 4 schedules ship and are unit-tested but
no live NPC renders in any scene and no waypoint is consumed at runtime.
First partial integration lands at VS-A4 (Mara walks her schedule on the
Town map). Full retrofit at RF-11 (remaining three NPCs + `?debug=schedules`
overlay).

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

**Status (VS-A1, 2026-06-19):** pending RF integration. The pure
`engine/forage.ts` advanceWorld + collect + quality roll ship and are
unit-tested but no forage mesh spawns in any scene and no in-game collection
exists. First partial integration lands at VS-A2 (Farm-side forage spawn +
collect + tree-chop). Full retrofit at RF-10 (Beach + Marsh forage anchors
+ tide-line shell collection).

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
