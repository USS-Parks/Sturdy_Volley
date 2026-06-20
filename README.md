# Sturdy Volley

An original, browser-first **cozy life sim** set in **Willa Crick,** just upriver of **Ballast Bay** on the Sturdy Coast — farm, fish, craft, befriend a living town, and rebuild a storm-worn harbor through quests and community-building efforts.

> Sturdy Volley is an **original** work, inspired by popular games the developer likes to play. It borrows only general life-sim *genre ideas*. It contains no code, art, audio, dialogue, maps, names, or data from any other game.

Visual direction: **Theme 3 — original N64-era low-poly 3D adventure** (chunky
geometry, hand-painted textures, vertex-style lighting, jewel tones, atmospheric
fog). See `art-production/style-themes/theme-03-n64-low-poly-adventure/`.

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
  render/    Babylon engine, palette/materials, scene helpers, fade layer
  scenes/    Boot, Preload, Title, NewGame, Farm, Town, Interior, Court, Mine + SceneManager
  ui/         HTML overlay layer (menus/forms/HUD) — accessible + testable
  engine/    Renderer-agnostic game logic (save model/store, movement, format, content)
  data/       Typed, data-driven content (crops, NPCs, items …)
public/assets/  Runtime .glb assets (delivered by the art pipeline)
tests/
  unit/      Vitest specs (pure logic + jsdom)
  e2e/       Playwright specs
docs/        Design + architecture notes
```


