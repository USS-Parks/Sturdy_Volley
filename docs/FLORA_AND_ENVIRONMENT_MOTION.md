# Flora & Environment Motion — Sturdy Volley

Last revised: 2026-06-21 (Prompt 045 / WEF-09)

Normative for flora + ambient environment motion. A **Tier-1 visual** layer
(§3.3): authored deformation — wind sway, gust response, and transient
interaction bend — for grass, crops, shrubs, flowers, trees, reeds, kelp, hanging
props (nets/flags), and shoreline foam, with **distance tiers**, **reduced
motion**, **season/weather** inputs, and a hard **active-deformation ceiling**.

**Determinism boundary (§3.2).** This layer **never writes gameplay state**. It
returns a transform offset the renderer applies; crop / forage / harvest /
regrowth outcomes stay deterministic and are owned elsewhere. Physical bodies are
reserved for gameplay-relevant close interaction — vegetation fields are not
simulated rigid bodies.

Source of truth: `src/engine/flora-motion.ts` (`FLORA_FAMILIES`, wind, sway,
interaction, tiers). Proving ground: `src/scenes/FloraLabScene.ts`
(`?scene=FloraLab`). Silhouettes follow the shape-language families — flowing reef
plants as crossed cards + fronds, wind-shaped ridge trees
(`sv_theme_03_004_shape_language.png` panels 4–5); distant plants/FX fall back to
billboards/impostors per the panel-11 model economy.

---

## 1. Motion families

| Family | Source | Bend pts | Stiffness | Sway (rad) | Interaction | Dormant (winter) | Tiers near/mid (m) | Reduced amp | Mobile |
|---|---|---:|---:|---:|---|---|---|---:|---|
| `grass` | wind | 1 | 0.10 | 0.22 | part | no | 14 / 30 | 0.02 | billboard |
| `crop` | wind | 1 | 0.35 | 0.12 | brush | yes | 16 / 32 | 0.015 | static |
| `shrub` | wind | 2 | 0.55 | 0.08 | brush | no | 18 / 36 | 0.012 | static |
| `flower` | wind | 1 | 0.20 | 0.18 | brush | yes | 12 / 26 | 0.02 | billboard |
| `tree` | wind | 3 | 0.80 | 0.045 | none | no | 40 / 80 | 0.008 | billboard |
| `reed` | wind | 2 | 0.25 | 0.26 | push | no | 16 / 32 | 0.02 | billboard |
| `kelp` | water | 3 | 0.15 | 0.30 | push | no | 14 / 28 | 0.04 | reduced |
| `hanging` | wind | 2 | 0.30 | 0.20 | none | no | 20 / 40 | 0.02 | static |
| `foam` | tide | 1 | 0.50 | 0.12 | none | no | 16 / 30 | 0.03 | reduced |

Each family also declares a **secondary amplitude** (tip/branch flutter) and a
**gust response** (how strongly it answers gusts); see `FLORA_FAMILIES`.

---

## 2. Wind, gusts, and phase variation

- **Coherent direction + gust timing** — `windStrength(time, wind)` blends a base
  with two incommensurate gust waves (period + a 0.37× harmonic) so gusts arrive
  on a believable cadence, never a robotic single sine. `windVector` adds the
  prevailing `direction`. Driven from explicit `time` so the proving ground is
  reproducible.
- **No lockstep** — `swayAngle(family, instancePhase, time, wind, reducedMotion)`
  carries a **stable per-instance phase**; a field of one family is always out of
  phase, never marching in unison.
- **Source-specific** — wind families track the gusting wind; `water` (kelp) and
  `tide` (foam) families undulate on a steady current independent of wind config.
- **Season / weather** — `modulateWind(base, season, weather)`: storm ×2.2, rain
  ×1.4, snow ×0.8, fog ×0.5; winter ×0.85 (stiffer). Clamped to [0,1].

## 3. Interaction (movers) — clear ownership

`interactionBend(family, distance, radius)` is a **transient** bend owned by the
mover (player / tool / animal) passing through, **separate** from wind:

- `push` (reeds, kelp) bend hardest, `part` (grass) next, `brush` (crops, shrubs,
  flowers) lightest; `none` (trees, hanging props, foam) ignore movers entirely.
- Read-only: a mover bending crops never changes their growth/harvest state.
- **Preserved under reduced motion / lower tiers** — the bend is a gameplay cue
  (you can see you're wading through reeds), so it stays even when ambient sway is
  stilled.

## 4. Distance tiers + the active-deformation ceiling

- `floraTier(distance, family)` → `full` (≤near) · `reduced` (≤mid) · `billboard`
  (beyond). `reduced` drops the secondary flutter and runs at lower amplitude;
  `billboard` is static / impostor.
- `assignFloraTiers(instances, cfg)` enforces a **hard ceiling**: the nearest
  instances get `full` up to `activeCap` (default 48), the next get `reduced` up
  to `reducedCap` (96), the rest fall back to `billboard` — so a dense field never
  exceeds the mobile active-deformation budget. `activeDeformingCount` reports it.
  Deterministic (ties break by id).

## 5. Reduced motion + mobile fallback

- **Reduced motion** collapses ambient sway to each family's tiny
  `reducedMotionAmplitude` and drops gust impulses + secondary flutter — but keeps
  the interaction cue (§3).
- **Mobile fallback** per family (`billboard` / `static` / `reduced`) is the
  cheap representation distant or over-budget instances use; instancing/batching
  stays available because tiering is pure data over instance refs.

## 6. Verification

- **Gate:** `tests/unit/flora-motion.test.ts` — family completeness +
  distinctness, wind range/gusts/modulation, anti-lockstep sway, reduced-motion
  amplitude, water-source independence, interaction bend, tier thresholds, and the
  active-deformation ceiling.
- **In game:** `?scene=FloraLab` animates ~200 instances across all nine families;
  `tests/e2e/flora-lab.spec.ts` (both projects) asserts coherent gusting sway with
  no lockstep, tier downgrade + the ceiling, reduced-motion stills ambient while
  the interaction cue survives, and that sway never alters a sample crop's growth.

## 7. What this layer does **not** do

- Fog density / ambient-fauna particle FX tuning — environment-wide effects, not
  per-instance bend families (the renderer owns the fog volume + tide foam alpha).
- Live FarmScene / region flora migration onto this layer — Prompt 053.
- Final flora art / animation libraries — graybox proxies only (§0.9).
