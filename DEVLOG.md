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
manager + saves) ✓ on Babylon. Prompt 004+ (3D world renderer onward) are
**paused pending the art track**; meantime work is the renderer-agnostic
simulation core.
