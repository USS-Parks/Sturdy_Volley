# Map Metric Kit — Sturdy Volley

Last revised: 2026-06-20 (Prompt 037 / WEF-06a)

The locked **spatial grammar** for the world: final dimensions, tolerances,
rationale, and camera compatibility for every kit element, plus the
machine-readable **map schema** every authored map validates against. The atlas
(Prompt 038), the dimensioned blockouts (039), and the graybox maps (046–049)
read from this kit — it is the single source so nothing drifts.

Code source of truth:

- `src/world/metric-kit.ts` — `METRIC_KIT`, `BODY`, route/slope/medium helpers.
- `src/world/map-schema.ts` — Zod map schema + `validateMapDocument`.
- `src/world/sample-map.ts` — the reference sample + `getWorldMapReport` (wired
  into the Title "Dev · Validate data" report).

All dimensions in metres. Reconciled with three already-locked sources so a
route the kit calls walkable actually is: the **motor** (`DEFAULT_MOTOR_CONFIG`:
capsule Ø0.8, slope limit 50°, step 0.4, swim depth 1.3), the **interior kit**
(`INTERIOR_METRICS`, Prompt 036), and the **art scale guide**
(`sv_style_007_camera_scale_guide.png`: 1.7–1.8 m human, 1 m farm cells,
cottage/door proportions).

---

## 1. Body footprints (`BODY`)

| Body | Diameter | Source |
|---|---:|---|
| Player / NPC capsule | 0.8 m | 2 × motor radius 0.4 |
| Small animal (pet / chicken / forager) | 0.5 m | shape-language panel 8 |
| Large animal (cow / horse) | 1.2 m | the widest navigator (mount system, Prompt 044) |

Routes add a **0.2 m comfort margin** on top of the raw body width
(`routeSupports`).

---

## 2. The kit (`METRIC_KIT`)

Every element carries `value`, `tolerance`, optional `cameraClearance` (overhead
/ lateral space the camera needs), and optional `secondary` (a second dimension).

### 2.1 Routes & open space

| Element | Dim | Tol | Camera | Bodies it must clear |
|---|---:|---:|---:|---|
| `path` | 1.6 | ±0.2 | 3 | capsule + small animal |
| `road` | 3.0 | ±0.3 | 4 | + large animal (mount/cart) |
| `desireLine` | 1.2 | ±0.2 | — | capsule + small animal |
| `plaza` (min span) | 8.0 | ±1.0 | 6 | gathering / common |

### 2.2 Farm

| Element | Dim | Tol | Note |
|---|---:|---:|---|
| `farmCell` | 1.0 | 0 | logical cell (SCALE doc §1) |
| `cropRowClearance` | 0.5 | ±0.1 | tend without trampling |
| `paddockGate` | 1.4 | ±0.1 | animal + player |
| `fence` | 1.1 h | ±0.1 | post spacing 2.0 (`secondary`) |

### 2.3 Interior (reconciled to `INTERIOR_METRICS`)

| Element | Dim | Tol | Note |
|---|---:|---:|---|
| `doorway` | 1.2 w | ±0.1 | height 2.0 (`secondary`) |
| `room` (min span) | 4.0 | ±0.5 | camera clearance = wall height 3.2 |
| `bed` | 2.0 | ±0.2 | width 1.2 (`secondary`) |
| `counter` | 0.7 d | ±0.1 | height 1.0 (`secondary`) |
| `navCorridor` | 1.4 | ±0.1 | min open corridor |

### 2.4 Structures

| Element | Dim | Tol | Note |
|---|---:|---:|---|
| `building` | 3.0–4.0 wall | 0 | roof peak ~1.4; camera clearance 4 |
| `dock` | 2.0 | ±0.2 | pier walk over water |
| `bridge` | 1.8 | ±0.2 | footbridge clear walk |

### 2.5 Vegetation

| Element | Dim | Tol | Note |
|---|---:|---:|---|
| `tree` | 0.6 trunk | ±0.2 | canopy clearance 2.2 (`secondary`) |
| `cropClearance` | 0.8 | ±0.1 | interaction space around a plant |

### 2.6 Terrain

| Element | Dim | Tol | Reconciled to |
|---|---:|---:|---|
| `slopeMaxDeg` | 50° | ±2 | motor slope limit |
| `stepMax` | 0.4 | ±0.02 | motor step offset |
| `stair` | 0.28 run | ±0.02 | rise 0.18 (`secondary`); interior kit |
| `cliffMinHeight` | 2.0 | ±0.2 | impassable edge |
| `shorelineBand` | 3.0 | ±0.5 | wading band along the edge |
| `wadeDepthMax` | 1.3 | 0 | motor swim depth (deeper = swim) |
| `caveCorridor` | 2.0 | ±0.2 | headroom 2.6 (`secondary`) |
| `encounterRoom` (min span) | 8.0 | ±1.0 | nav + a small fight |

### 2.7 Transitions & camera

| Element | Dim | Tol | Note |
|---|---:|---:|---|
| `transitionThreshold` | 1.4 w | ±0.1 | depth 1.0 (`secondary`) |
| `landmarkSightline` | 40 m | ±5 | a region landmark stays legible from ≥ this range |

---

## 3. Route support rule (§4.2 "every route supports … the relevant body")

`routeWidthOk(kind, width)`:

- **Every** route must clear the player/NPC capsule **and** a small animal.
- **Mount/cart routes** (`road`, `dock`, `bridge`) must additionally clear the
  **large-animal** body (the horse — Prompt 044's traversal showcase rides
  road/bridge/ford routes).
- Footpaths and desire-lines (`path`, `desire-line`, `corridor`) need only the
  capsule + small animal, so a 1.2 m desire-line is valid even though it cannot
  fit a horse.

`slopeWalkable(deg)` and `mediumForDepth(depth)` answer the terrain questions
against the motor's locked thresholds.

---

## 4. Machine-readable map schema

`src/world/map-schema.ts`. A `MapDocument` (`.strict()`, kebab-case ids) carries
the **separate concerns** (§3.1) as data — no geometry:

- `coordinateFrame` — region id + world-space local origin + `forwardAxis '+z'` +
  `units 'meters'` (the floating origin per region, `docs/WORLD_TOPOLOGY_AND_STREAMING.md`).
- `chunks` — uniform-size chunk grid.
- `anchors` — stable interaction/doorway/spawn anchors (`id`, `kind`, `at`, `facing?`).
- `cameraVolumes` — the full WEF-05 volume contract (profile, fallback, target
  offset, yaw bounds, obstruction mode, blend boundary, priority).
- `collision` / `navigation` — **references** (box/mesh/proxy; patch/link + width),
  optionally tied to anchors.
- `routes` — typed routes with width + polyline.
- `variants` — tide/season/restoration rules keyed by anchor id.
- `transitions` — outgoing cross-region transitions (anchor + facing + camera context).

`validateMapDocument(doc)` runs the schema **and** the semantic cross-checks:
duplicate anchor ids, routes too narrow for their required bodies, camera
contexts that don't resolve to a real `CAMERA_CONTEXTS` entry, transitions whose
`fromRegion` isn't this map, dangling collision/nav/variant anchor references,
and mixed chunk sizes. Every issue carries a stable `code`.

### 4.1 Where it runs

- **Gate:** `tests/unit/map-schema.test.ts` validates the reference sample +
  every failure mode.
- **In game:** `getWorldMapReport()` validates every authored map and is appended
  to the Title **Dev · Validate data** report, so a malformed map (Prompts
  038/039/046–049) shows up red next to the content-validation rows.

The reference template is `BREAKPOINT_FARM_SAMPLE` (`src/world/sample-map.ts`) —
the shape the atlas + blockouts fill in.

---

## 5. What this layer does **not** do

- Implement region geometry (Prompts 038/039 author the real maps; 046–049
  graybox them).
- Bake navmeshes or collision (Prompts 040–041; the schema only *references* nav
  and collision entries).
- Replace `docs/SCALE_AND_PERFORMANCE.md` (per-scene render budgets) or the
  motor/interior docs — it reconciles to them.
