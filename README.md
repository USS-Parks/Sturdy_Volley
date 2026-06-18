# Sturdy Volley

An original, browser-first **cozy life sim** set in **Ballast Bay** on the Sturdy Coast — farm, fish, craft, befriend a living town, and rebuild a storm-worn harbor through expressive volleyball play.

> Sturdy Volley is an **original** work. It borrows only general life-sim *genre ideas*. It contains no code, art, audio, dialogue, maps, names, or data from any other game.

## Tech stack

- **Phaser 3** — rendering, input, tilemaps, arcade physics
- **TypeScript** + **Vite** — typed source, fast dev/build
- **Vitest** (jsdom) — pure-logic and DOM-overlay unit tests
- **Playwright** — desktop + mobile smoke / layout tests
- **ESLint** (flat config) + `typescript-eslint`

## Getting started

```bash
npm install
npx playwright install chromium   # one-time, for e2e
npm run dev                        # http://localhost:5173
```

## Scripts

| Script             | What it does                                  |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Start the Vite dev server                     |
| `npm run build`    | Type-check, then build to `dist/`             |
| `npm run preview`  | Preview the production build                  |
| `npm run typecheck`| `tsc --noEmit` over `src` and `tests`         |
| `npm run lint`     | ESLint over the project                       |
| `npm test`         | Run unit tests (Vitest)                       |
| `npm run test:e2e` | Run Playwright tests (desktop + mobile)       |

## Project layout

```
src/
  config/    Phaser game config + design constants
  scenes/    Boot, Preload, Title (more added per prompt)
  ui/         HTML overlay layer (menus/panels) — accessible + testable
  engine/    Framework-agnostic game logic (save, time, systems …)
  data/       Typed, data-driven content (crops, NPCs, items …)
tests/
  unit/      Vitest specs (pure logic + jsdom)
  e2e/       Playwright specs
docs/        Design + architecture notes
```

See [`STURDY_VOLLEY_PSPR.md`](./STURDY_VOLLEY_PSPR.md) for the full design and the
sequential prompt roster, and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for
implementation conventions. Build progress is tracked in [`DEVLOG.md`](./DEVLOG.md).
