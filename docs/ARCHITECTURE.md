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
- **`src/audio/`** — The audio system (Prompt 061). A guarded WebAudio synth
  (`audio-engine.ts`) driven by a scene-spanning singleton `audio-director.ts`
  that selects music + ambient layers from a pure model (`engine/audio-model.ts`)
  and a per-category mixer persisted on the save. `scene-audio.ts` is the
  scene→audio glue; `cues.ts` are one-shot blips routed through the same mixer.

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
the original Theme-3 art replaces them. **OoT-era *feel* only** — never the
`zeldaret/oot` decompilation or any PC port source/assets (master roster §0.7).

## World Embodiment Foundation (WEF, Prompts 028–053 — complete)

The foundation re-platforms the game on one shared, modular, streamable 3D stack.
Render meshes, collision proxies, navigation surfaces, interaction anchors, camera
volumes, spawn points, audio zones, streaming bounds, and persistence identifiers
are **separate concerns** (§3.1).

- **Camera** — `src/camera/`: data-driven `profiles` (one locked baseline per §2
  context, incl. `mounted`), the `rig` (binds a profile to an `ArcRotateCamera`),
  authored `volumes` (profile override + obstruction mode + blend hysteresis),
  `orbit` math, and `input` (keyboard/mouse, controller right-stick, touch drag).
- **Motor** — `src/engine/motor.ts` (pure kinematic capsule: grounding, gravity,
  slopes, steps, wade/swim, authored traversal links — no free jump) over
  `src/physics/` (a narrow Havok adapter + a ray-pick fallback).
- **Interaction** — `src/engine/interaction-targeting.ts` (candidate discovery →
  scoring → selection → facing → commit).
- **Navigation** — `src/engine/navigation.ts` (navmesh + A\* + off-mesh links),
  `nav-avoidance.ts`, `npc-sim.ts` (sim tiers + offscreen abstraction).
- **World** — `src/world/`: `topology`/`streaming`/`variants`, `interior-kit`,
  `metric-kit`, `map-schema` (+ validator), `atlas`, `blockouts/`, and
  `region-transition` (the `goTo` payload preserving anchor/facing/camera/clock/NPC).
- **Fauna / flora / mount** — `engine/animal-families.ts` (domestic + wild +
  `rideable-mount`), `fauna-behavior.ts`, `flora-motion.ts`, and `mount.ts` (ridden
  motor + mount state machine + mounted-camera handoff). Horse graybox in
  `render/horse-graybox.ts`.
- **Production-foundation maps** — `scenes/BreakpointFarmScene`,
  `FarmhouseInteriorScene`, `BallastBayTownScene`, `KlamityRiverScene`,
  `RainhallCavernScene`: graybox geometry over production collision / navigation /
  anchor / camera-volume / transition data, each with five toggleable debug
  layers, reachable through real region transitions.
- **Asset pipeline** — `render/asset-contract.{json,ts}` (per-family `.glb`
  conformance validator), `render/asset-factory.ts` (reversible graybox↔asset swap
  preserving anchors/collision/nav/save id), `render/asset-fixtures.ts`.
- **Foundation gate** — `engine/foundation-budget.ts` (hard ceilings, full metric
  set, per map, desktop+mobile), `quality-tiers.ts` (density/effects only),
  `accessibility.ts` (twelve controls), `foundation-coverage.ts` (the tour
  manifest); `docs/SCALE_AND_PERFORMANCE.md` is the normative budget doc.

### Migration status (WEF-13)

The shared stack is the foundation for all gameplay from **Prompt 054**. The new
production-foundation maps use it end to end. The **legacy gameplay scenes**
(`FarmScene`, `TownScene`, `InteriorScene`, `BeachScene`, `MineScene`) remain the
live home of shipped gameplay (save, farming, forage, crops, tools, machines,
animals, pets, fishing, reefs, mining, combat, shops, NPCs, dialogue, friendship,
cutscenes, time/weather/tide) and are **migrated, not discarded** — their content
moves onto the production-foundation maps as the gameplay continuation (054+)
builds on the shared stack. **Retirement criterion:** a legacy scene's scene-local
camera/movement/collision/direct-navigation path is removed only when repository
search proves the equivalent content has moved to a foundation map and no live
consumer remains. No such path is safely removable at the close of WEF (every
legacy scene is still a live consumer); the adapters stay until 054+ migrates them.
