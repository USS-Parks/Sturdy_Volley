# Sturdy Volley — Architecture Notes

Living document. Conventions established here should hold across the prompt roster.

## Layers

- **`src/config/`** — Phaser `GameConfig`, design resolution (`1280×720`, `Scale.FIT`),
  and other global constants.
- **`src/scenes/`** — Phaser scenes. Boot → Preload → Title today; NewGame, Farm,
  Town, Interior, Court, Mine follow in Prompt 003+.
- **`src/ui/`** — The **HTML overlay** layer. Menus and panels are real DOM
  elements rendered into `#ui-root`, *above* the Phaser canvas. Rationale:
  accessibility (focus order, keyboard, screen readers, 48px touch targets) and
  testability (Playwright + jsdom can query real elements). Pure view-model
  builders (e.g. `menuModel.ts`) are separated from rendering so they unit-test
  without a browser.
- **`src/engine/`** — Framework-agnostic game logic (save presence today; time,
  inventory, systems later). Keep this Phaser-free where practical so it stays
  unit-testable.
- **`src/data/`** — Typed, data-driven content (Prompt 002).

## DOM overlay contract

- `#game-root` hosts the Phaser canvas; `#ui-root` hosts menus/panels.
- `#ui-root` is `pointer-events: none`; only `.menu-panel` re-enables pointer
  events, so canvas input passes through everywhere else.
- Every interactive element carries a stable `data-testid` for Playwright.
- Scenes own their overlay lifecycle: build on `create()`, `overlay.clear()` on
  `SHUTDOWN`.

## Testing strategy

- **Vitest (jsdom)** — pure logic and DOM overlay behavior. Fast, no canvas.
- **Playwright** — boots the real app (Vite dev server) on `desktop-chromium`
  and `mobile-chromium` (Pixel 5). Asserts no console errors, menu presence,
  navigation, and canvas mount.

## Originality guardrails

No assets, code, names, dialogue, maps, or data may be copied from other games.
Placeholder visuals must be generated in-engine (e.g. gradients/shapes) until
original art replaces them.
