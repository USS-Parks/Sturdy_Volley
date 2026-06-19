# Scale and Performance — Sturdy Volley

Last revised: 2026-06-19 (VS-A1)

This document is normative for the Vertical Slice phase. Every prompt under §8.0 (VS-A1..VS-A5) and the §8.1 retrofit pass must respect these conventions.

---

## 1. World scale

| Convention | Value | Notes |
|---|---|---|
| World unit | **1 world unit = 1 meter** | Babylon scenes, collision ellipsoids, camera distances all measured in meters. |
| Player capsule | **1.8 m tall, 0.4 m radius** | Matches the Theme 3 art bible's "approximately 1.7–1.8 m" guidance. |
| Farm cell | **1 m × 1 m, 0.12 m thick** | `FARM_CELL_SIZE = 1`. Tilled soil tile uses 0.94 m width to leave a visible ridge. |
| Building height | **3.0–4.0 m wall, 1.4 m roof peak** | Town buildings, farmhouse exterior, shop kits all read from `TownScene.BUILDINGS`. |
| Doorway clearance | **≥ 1.0 m wide, ≥ 1.8 m tall** | Player capsule passes without clipping. |
| Camera follow radius | **14 m** (Farm) / **22 m** (placeholder scenes) | `ArcRotateCamera` default radius in `FarmScene` / `PlaceScene`. |
| Camera FOV | **0.8 rad ≈ 46°** | Tight enough for adventure framing, wide enough for mobile readability. |
| Reference fog density | **0.014 (Farm) / 0.02 (placeholder)** | `addFog` calls in scene builders. |

Builders adding new geometry must respect the meter convention. Don't drop a 12 m tall placeholder fence in the middle of a 3 m world. When in doubt, drop a 1 m reference cube next to it (`?debug=scale`, planned for VS-A2 follow-up).

---

## 2. Mobile performance budgets

Targets are measured on a Playwright Pixel 5 viewport running software WebGL (SwiftShader). These are **hard ceilings the slice may not exceed** without an explicit waiver entered into the DEVLOG.

| Scene | Min FPS | Max draw calls | Max active meshes | Max triangles |
|---|---|---|---|---|
| Farm | 30 | 220 | 180 | 220,000 |
| Town | 30 | 220 | 200 | 220,000 |
| Interior | 30 | 140 | 120 | 100,000 |
| Beach | 30 | 180 | 140 | 160,000 |
| Mine | 30 | 180 | 140 | 160,000 |

Values are codified in `src/render/perf-overlay.ts` as `MOBILE_BUDGETS`. Desktop has 2× headroom by convention but does not need a separate budget.

### How to measure

1. Append `?debug=perf` to the URL. A perf strip mounts in the upper-left corner showing FPS / draw calls / active meshes / triangles.
2. The strip's cells paint red when the active scene exceeds its budget.
3. Playwright assertion (VS-A1, `tests/e2e/perf-budget.spec.ts`) walks the slice on Pixel 5 and asserts every visited scene is within budget.

### When a budget is breached

1. Don't relax the number. Add the new geometry **after** removing or instancing equivalent triangles elsewhere.
2. If the breach is unavoidable (e.g. a one-time cutscene with many extras), file the waiver in the DEVLOG entry for that prompt with the reason and a recovery date.
3. **Never** disable the perf overlay or the Playwright assertion to ship.

---

## 3. Initial download budget

| Target | Today | Budget |
|---|---|---|
| Main JS chunk (gzip) | ~1.15 MB | ≤ 2.5 MB |
| Total initial download | ~1.2 MB | ≤ 5 MB (35 MB hard cap from §7 P-SPR) |
| First playable load | n/a | ≤ 5 s on average broadband, cached |

Real `.glb` assets are streamed per-region and don't count against the initial-download budget.

---

## 4. Representative-graybox conventions

Per §0.10 of the P-SPR (added VS-A1), every prompt that introduces a new entity ships a representative low-poly mesh in the same commit. Conventions:

- Use Babylon primitives (`MeshBuilder.Create*`) only. No imported assets.
- One material per simple prop. Hand off via the existing `flatMaterial(scene, name, color, emissive)` helper.
- Match the meter scale (§1). A graybox shop is ~4 m wide, ~3 m tall; a graybox NPC is a 1.8 m capsule with a small sphere head.
- When a real `.glb` lands later, the swap site is a single `MeshBuilder.Create*` line per entity — keep the primitive-construction code in one place per scene helper.

---

## 5. Notes carried forward to VS-A2..VS-A5

- VS-A2 adds visible forage / debris / tree meshes on the Farm and asserts they stay within the Farm budget after spawn.
- VS-A3 introduces the `FarmhouseInteriorScene` and reserves the Interior budget.
- VS-A4 lands one live NPC on the Town map — must stay within the Town budget after the NPC mesh is added.
- VS-A5 is the slice-gate Playwright spec; it bundles the perf-budget assertion with the loop assertion.
