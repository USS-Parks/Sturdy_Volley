# Scale and Performance — Sturdy Volley

Last revised: 2026-06-21 (WEF-12, Prompt 052 — post-foundation budgets)

Normative for the whole project from the foundation onward. The WEF foundation
(Prompts 028–053) re-platformed camera, motor, collision, navigation, streaming,
fauna, flora, the mount system, and the production-foundation maps; this document
now codifies the **measured/targeted budgets, quality tiers, and accessibility
floor** every gameplay prompt (054+) must respect. Budgets are mirrored in
`src/engine/foundation-budget.ts`; tiers in `src/engine/quality-tiers.ts`;
accessibility in `src/engine/accessibility.ts`; the gate manifest in
`src/engine/foundation-coverage.ts`; the gate test is
`tests/unit/foundation-gate.test.ts`.

---

## 1. World scale

| Convention | Value | Notes |
|---|---|---|
| World unit | **1 unit = 1 m** | Babylon scenes, collision, camera distances in metres. |
| Player capsule | **1.8 m tall, 0.4 m radius** | `DEFAULT_MOTOR_CONFIG` (`src/engine/motor.ts`). |
| Farm cell | **1 m × 1 m** | `FARM_CELL_SIZE = 1`. |
| Building / wall | **3.0–4.0 m wall, 1.4 m roof peak** | `INTERIOR_METRICS.wallHeight = 3.2`. |
| Doorway clearance | **≥ 1.0 m × 1.8 m** | `INTERIOR_METRICS.doorway` (1.2 × 2.0). |
| Camera baselines | **per §2 of the master roster** | Locked in `src/camera/profiles.ts` (`CAMERA_BASELINES`), incl. the `mounted` baseline. |
| Withers (mount) | **≈ 1.6 m** | Rideable-horse graybox economy. |

Builders respect the metre convention from the first primitive (§0.9). The
representative-graybox conventions (Babylon primitives + `flatMaterial`, one
material per simple prop, one swap site per entity) carry forward unchanged.

---

## 2. Foundation performance budgets (hard ceilings)

Every WEF environment must hold these with representative populations, on desktop
and on a Pixel 5. A breach is a budget **failure** — file a waiver in the DEVLOG
with a recovery prompt; never relax the number or disable the gate. Mobile values
below; **desktop carries 2× headroom** on the GPU-bound metrics (draw calls,
triangles, active/skinned meshes, deforming flora) and 60 FPS.

| Environment (mobile) | Min FPS | Max draws | Max tris | Max meshes | Phys bodies | Motors | Nav agents | Skinned | Flora | Mem MB | Chunk ms | Region MB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| breakpoint-farm | 30 | 240 | 240k | 220 | 24 | 12 | 16 | 14 | 48 | 96 | 250 | 12 |
| farmhouse-interior | 30 | 140 | 100k | 120 | 12 | 12 | 8 | 14 | 48 | 96 | 250 | 12 |
| ballast-bay-town | 30 | 260 | 260k | 240 | 24 | 12 | 16 | 14 | 48 | 96 | 250 | 12 |
| klam-ity-river | 30 | 220 | 220k | 200 | 24 | 12 | 16 | 14 | 48 | 96 | 250 | 12 |
| rainhall-caverns | 30 | 200 | 180k | 180 | 24 | 12 | 16 | 14 | 48 | 96 | 250 | 12 |

The full metric set (FPS / frame time, draw calls, triangles, active meshes,
physics bodies, character motors, navigation agents, animated/skinned meshes,
deforming flora, streamed memory, chunk-transition time, region download) is in
`FOUNDATION_BUDGETS`; `withinBudget(metrics, budget)` returns each breach. The
per-map Playwright tours + the `?debug=perf` overlay measure mesh/draw live;
**real-device FPS is a documented manual check** (§0.2 #8 — automation of true
on-device FPS is impractical in CI under SwiftShader).

---

## 3. Initial-download budget

| Target | Budget |
|---|---|
| Main JS chunk (gzip) | ≤ 2.5 MB |
| Total initial download | ≤ 5 MB |
| Hard cap | 35 MB (§7 P-SPR) |
| First playable load | ≤ 5 s on broadband, cached |

Codified in `INITIAL_DOWNLOAD_BUDGET`. Real `.glb` assets are streamed per region
and don't count against the initial download.

---

## 4. Quality tiers (density / effects only)

`QUALITY_TIERS` (`low` / `medium` / `high`, default `medium` on mobile) change
**only** flora/fauna/particle density, shadows, fog quality, post-processing,
render scale, and draw distance. They **never** change interaction reach,
collision, route availability, schedules, or simulation outcomes — the invariant
is structural (a `QualityTier` carries only visual fields; `INVARIANT_CONCERNS`
names what it may not touch, and the gate test asserts no invariant leaks into a
tier). Mobile optimisation polish (Prompt 068) tunes dynamic resolution / shadow
tiers / fog range / LOD bias on top of this floor.

---

## 5. Accessibility floor (not deferred)

`DEFAULT_ACCESSIBILITY` + `validateAccessibility` cover the twelve required
controls: input **remapping**, **touch-target size** (≥ 44 CSS px floor), **camera
sensitivity**, **separate X / Y inversion**, a **recenter control**, **reduced
motion**, **camera shake**, hold/toggle interaction, **auto-facing assistance**,
**high-contrast focus**, **subtitles**, and a **no-time-pressure** mode. The
accessibility-complete pass (Prompt 070) finishes flashing / timing / contrast /
font / colour / audio-cue coverage on this foundation.

---

## 6. The foundation gate

`FOUNDATION_TOUR` (`src/engine/foundation-coverage.ts`) lists every environment,
transition, camera context, traversal type, interaction target, NPC state, animal
family, and simulation tier the foundation must tour, each cross-referenced to its
proving Playwright spec (`TOUR_SPECS`). `tests/unit/foundation-gate.test.ts`
asserts the manifest is **complete** against the real source enums
(`CAMERA_CONTEXTS`, `ANIMAL_FAMILIES`, the budget environments) — so a new
context / family / environment cannot ship untoured — plus the budget checker, the
tier invariants, and the accessibility floor. The live environment tours
themselves are the per-map / per-lab specs in `tests/e2e/`.
