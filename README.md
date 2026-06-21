# Sturdy Volley

An original, browser-first **cozy life sim** set in **Willa Crick,** just upriver of **Ballast Bay** on the Sturdy Coast — farm, fish, craft, befriend a living town, and rebuild a storm-worn harbor through quests and community-building efforts.

> Sturdy Volley is an **original** work, inspired by popular games the developer likes to play. It borrows only general life-sim *genre ideas*. It contains no code, art, audio, dialogue, maps, names, or data from any other game.

Visual direction: **Theme 3 — original N64-era low-poly 3D adventure** (chunky
geometry, hand-painted textures, vertex-style lighting, jewel tones, atmospheric
fog). See `art-production/style-themes/theme-03-n64-low-poly-adventure/`.

## World Embodiment Foundation (complete)

The **WEF foundation** (roster Prompts 028–053, see
[`PLANNING/MASTER_ROSTER.md`](PLANNING/MASTER_ROSTER.md)) re-platformed the game on
one shared, modular, streamable 3D foundation:

- **Camera** — data-driven profiles + rig + authored volumes + obstruction, with
  one locked baseline per context (incl. the OoT-era **mounted** baseline).
- **Motor** — a kinematic capsule motor over a Havok adapter: grounding, slopes,
  steps, wading/swimming, authored traversal links (no free jump).
- **Interaction**, **navigation** (navmesh + off-mesh links + avoidance + offscreen
  sim), **streaming/topology**, the **interior kit**, and a machine-readable
  **map schema / atlas / blockouts**.
- **Fauna** (domestic + wild families), **flora** motion tiers, and a first-class
  **horseback mount system** (mount/dismount + ridden motor + mounted camera).
- **Five production-foundation maps** on the shared stack — Breakpoint Farm +
  Farmhouse interior, the Ballast Bay town district, the Klam-ity River corridor
  (mounted traversal across the community seam), and the Rainhall Caverns cave
  slice — all reachable through real region transitions.
- **Asset pipeline** — a per-family `.glb` contract + validator + reversible swap
  factories, and a **foundation gate** codifying budgets, quality tiers, and the
  accessibility floor (`docs/SCALE_AND_PERFORMANCE.md`).

Gameplay (quests, festivals, cooking, NPC expansion, narrative, …) resumes at
**Prompt 054** on top of this foundation. Doctrine: mirror Ocarina-of-Time-era
*feel* only — never any other game's source or assets.

## Tech stack

- **Babylon.js** — 3D rendering, scene graph, cameras, lighting (Havok physics + glTF/`.glb` assets added as gameplay needs them)
- **TypeScript** + **Vite** — typed source, fast dev/build
- **Vitest** (jsdom) — pure-logic and DOM-overlay unit tests
- **Playwright** — desktop + mobile smoke / layout / canvas-pixel tests
- **ESLint** (flat config) + `typescript-eslint`

## Getting started

```bash
npm install
npx playwright install chromium   # one-time, for e2e
npm run dev                        # http://localhost:5173
```

## Scripts

| Script               | What it does                                  |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Start the Vite dev server                     |
| `npm run build`      | Type-check, then build to `dist/`             |
| `npm run preview`    | Preview the production build                  |
| `npm run typecheck`  | `tsc --noEmit` over `src` and `tests`         |
| `npm run lint`       | ESLint over the project                       |
| `npm test`           | Run unit tests (Vitest)                       |
| `npm run test:e2e`   | Run Playwright tests (desktop + mobile)       |
| `npm run validate:assets` | Validate runtime `.glb` assets (stub until the art pipeline lands) |

## Project layout

```
src/
  render/    Babylon engine, palette/materials, scene helpers, interior/horse builders, asset contract + swap factory
  camera/    Data-driven camera profiles, rig, volumes, obstruction, input (WEF)
  scenes/    Boot/Preload/Title/NewGame + legacy gameplay (Farm, Town, Interior, Beach, Mine)
             + WEF production maps (BreakpointFarm, FarmhouseInterior, BallastBayTown,
               KlamityRiver, RainhallCavern) + dev proving grounds (CameraLab, NavLab,
               FaunaLab, WildLab, MountLab, FloraLab, AssetSwapLab, …) + SceneManager
  ui/         HTML overlay layer (menus/forms/HUD) — accessible + testable
  engine/    Renderer-agnostic game logic (save, motor, navigation, fauna/flora families,
             mount, interaction, budgets/tiers/accessibility, content)
  world/      Topology/streaming, metric kit, map schema, atlas, blockouts, region transitions
  data/       Typed, data-driven content (crops, NPCs, items …)
public/assets/  Runtime .glb assets (delivered by the art pipeline; validated by the asset contract)
tests/
  unit/      Vitest specs (pure logic + jsdom)
  e2e/       Playwright specs
docs/        Design + architecture notes
```


