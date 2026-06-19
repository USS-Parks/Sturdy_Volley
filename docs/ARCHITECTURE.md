# Sturdy Volley — Architecture Notes

Living document. Conventions established here should hold across the prompt roster.

## Engine

**Babylon.js** (3D), per the revised P-SPR's Theme 3 "N64-era low-poly adventure"
direction. Physics (Havok) and glTF/`.glb` asset loading are added when gameplay
needs them. The art track (models/rigs/animation) is produced separately; the
codebase ships **code-generated placeholder primitives** in the Theme-3 palette
until real `.glb` assets land in `public/assets/`.

## Layers

- **`src/render/`** — Babylon `Engine` setup, the Theme-3 `PALETTE` + flat
  (low-spec, vertex-lit-look) material helper, scene helpers (fog, three-quarter
  camera, lights), and the DOM `FadeLayer` used for transitions.
- **`src/scenes/`** — `SceneManager` (owns the render loop + interrupt-safe fade
  transitions) and one `GameScene` per screen: Boot → Preload → Title → NewGame
  → Farm/Town/Interior/Court/Mine. Each scene builds its own Babylon `Scene`.
- **`src/ui/`** — The **HTML overlay** layer. Menus, forms, panels, and the HUD
  are real DOM elements in `#ui-root`, *above* the Babylon canvas. Rationale:
  accessibility (focus order, keyboard, screen readers, 44–48px touch targets)
  and testability (Playwright + jsdom query real elements). Pure view-model
  builders (`menuModel.ts`) are separated from rendering for unit tests.
- **`src/engine/`** — Renderer-agnostic game logic: save model/store/transfer,
  `gameState`, `format`, `movement`. Kept Babylon-free so it stays unit-testable.
- **`src/data/`** — Typed, zod-validated, data-driven content (Prompt 002).

## Scene contract

- `#game-root` hosts the Babylon `<canvas id="game-canvas">`; `#ui-root` hosts the
  overlay; `#fade` sits above both for transitions.
- `#ui-root` is `pointer-events: none`; only `.menu-panel` / HUD elements
  re-enable pointer events, so canvas input passes through elsewhere.
- Every interactive element carries a stable `data-testid` for Playwright.
- `SceneManager.goTo()` releases its transition guard as soon as the next scene
  is interactive (before the cosmetic fade-in) so input is never dropped.
- Scenes own their overlay lifecycle: render on `enter()`, `overlay.clear()` +
  Babylon `scene.dispose()` on transition.

## Testing strategy

- **Vitest (jsdom)** — renderer-agnostic logic (save, content, format, movement)
  and DOM overlay behavior. Fast, no WebGL.
- **Playwright** — boots the real **production preview** build on
  `desktop-chromium` + `mobile-chromium` (Pixel 5), serially (Babylon on software
  WebGL is CPU-heavy). Asserts menu presence, navigation, save flow, and a
  **canvas-pixel check** (the 3D scene actually renders, not blank/uniform).
  Headless Chromium needs SwiftShader launch flags for WebGL.

## Originality guardrails

No assets, code, names, dialogue, maps, or data may be copied from other games.
Placeholder visuals are generated in-engine (primitives + flat materials) until
the original Theme-3 art replaces them.
