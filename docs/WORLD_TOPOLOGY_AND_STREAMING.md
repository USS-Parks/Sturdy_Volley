# World Topology & Streaming — Sturdy Volley

Last revised: 2026-06-20 (Prompt 035 / WEF-04)

Normative for the exterior world container. This is the layer **beneath** any
region layout: it defines how exterior space is partitioned into chunks, how
chunk coordinates stay numerically stable across the whole planned world, how
the streaming controller decides what to load/unload, and how the eight
per-chunk concerns stay separate. Region *content* (Breakpoint Farm, the Ballast
Bay district, the Klam-ity River corridor, …) is authored on top of this in
Prompts 037–049.

Source of truth in code:

- `src/world/topology.ts` — coordinate frames, chunk grid, stable ids, transitions.
- `src/world/streaming.ts` — the streaming controller (hysteresis, look-ahead, budgets, recovery).
- `src/world/variants.ts` — tide/season/weather/restoration content resolution (anchor-invariant).
- `src/scenes/StreamingLabScene.ts` — the proving ground (`?scene=StreamingLab`).
- `src/render/streaming-overlay.ts` — the `?debug=streaming` overlay.

---

## 1. Coordinate frames

Runtime convention (carried from `docs/SCALE_AND_PERFORMANCE.md` §1 and the
master roster §3.1): **Y-up, metres, +Z forward, 1 unit = 1 m.** Streaming
operates purely in the **XZ ground plane** (`Vec2 = {x, z}`); height never
affects which chunks load.

### 1.1 Regions and floating origins

The exterior is partitioned per **region**. A region owns:

- a **stable string id** (`willa-crick`, `ballast-bay`, …) — the save identity,
- a **world-space local origin** (its `(0,0)` corner),
- a label for debug surfaces.

Chunk coordinates are computed in **region-local** space (`world − origin`), so
they stay small integers near the region no matter how far the region sits from
world `(0,0)`. This is the **floating-origin-per-region** strategy: it keeps
float precision stable across the whole planned world spine
(Willa Crick ↔ Klam-ity River ↔ Ballast Bay) instead of accumulating error in
large absolute coordinates. `worldToLocal` / `localToWorld` round-trip exactly.

### 1.2 Chunks

The world is a grid of square chunks. A chunk is addressed by integer
`{cx, cz}` in its region's local frame.

- `worldToChunk(region, world, size)` — floors a world point into its chunk.
- `chunkOrigin` / `chunkCenter` / `chunkBounds` — world-space geometry of a chunk.

**Chunk size = 32 m** (`DEFAULT_CHUNK_SIZE`). Derivation:

- The locked exterior camera baseline (Prompt 030: follow 9.5 m, 31° downward,
  47° FOV) over EXP2 fog at density ~0.012–0.014 leaves content readable to
  roughly **60 m** before the fog closes (`exp(-(d·density)²) ≈ 0.5` at
  `d ≈ 59 m` for density 0.014).
- `activeRadius = 2` therefore keeps a **5×5 = 25-chunk** window (±80 m)
  resident — everything inside the fog horizon is loaded, so nothing visible is
  ever missing.
- 32 m is large enough that a chunk's mesh/body cost is a fraction of the mobile
  budget (`docs/SCALE_AND_PERFORMANCE.md` §2) yet small enough that the load
  granularity is fine. Powers-of-two-friendly edge keeps the grid arithmetic
  clean.

### 1.3 Stable persistence ids

A chunk's persistence id is **`${regionId}#cx,cz`** (`chunkId`), derived from the
region + integer coordinate — **never** from a render-mesh name (§3.1). It is:

- invariant across tide/season/weather/restoration content variants,
- invariant across reload and region re-entry,
- `parseChunkId` round-trips it back to `{regionId, coord}` (region ids may
  contain hyphens; the split is on the last `#`).

Saves and cross-region transitions reference these ids and the per-chunk
**anchor ids** (§4), so persisted state survives art swaps and content variants.

---

## 2. Streaming contract

`StreamingController` (`src/world/streaming.ts`) holds one active region and a
map of `ChunkRecord`s. Each `update(focus, velocity, dtMs)` returns a
`{ toLoad, toUnload, toActivate, toDeactivate }` diff and mutates the records;
the scene applies the diff (building/disposing per-chunk content) and reports
each chunk's cost back via `markLoaded(id, cost)` / `markFailed(id)`.

### 2.1 States

`unloaded → preloading → loaded → active` (+ `failed`).

- **preloading** — desired, content build requested, not yet built.
- **loaded** — built and resident in the hysteresis band; simulation throttled
  (the sim-tier downgrade lands with real fauna in Prompts 042–043).
- **active** — built and within `activeRadius`; all eight layers live.
- **failed** — content build failed; retried after `failureRetryMs`.

### 2.2 Hysteresis

Two radii prevent thrash at chunk seams:

- `activeRadius = 2` — the fully-active ring.
- `keepRadius = 3` — the keep band. A chunk is **unloaded only once it falls
  beyond `keepRadius`**, never merely for leaving the active ring. Crossing a
  single seam therefore loads the new leading ring without unloading anything,
  and a chunk demotes `active → loaded` (not straight to unloaded) as it drifts
  out of the active ring.

### 2.3 Directional look-ahead (horse-speed preload)

Above walking pace (`lookAheadMinSpeed = 3.5 m/s`), the controller projects a
**lead** of `ceil(speed · preloadSeconds / chunkSize)` chunks (clamped to
`maxAheadRadius = 2`) along the dominant travel direction and adds a
keep-radius forward field around that lead point. Because the field is centred
*ahead* of the focus, it extends the resident region **past** the symmetric keep
band in the travel direction:

- **Foot pace** adds nothing — the symmetric band is already ample (the player
  reaches the keep edge in ~30 s at 3.2 m/s).
- **Horse gallop** (`HORSE_SPEED = 11 m/s`) pulls the leading chunk column(s)
  resident before the rider arrives; a **faster** gallop projects a larger
  `lead` and reaches farther still. This is the "chunk + preload sizing accounts
  for horse-speed traversal" contract — a mounted player covers ground faster,
  so the loader leads farther ahead.

### 2.4 Budgets

Explicit ceilings, surfaced in the `?debug=streaming` overlay:

- `maxLoadedChunks = 64` — hard cap on simultaneously non-unloaded chunks
  (memory proxy). When desired chunks would exceed it, the controller admits
  nearest-first and drops the farthest; the **focus chunk and the active ring
  are always admitted** regardless of pressure.
- `maxMeshes = 1200`, `maxBodies = 400` — aggregate advisory ceilings reported
  per frame so a content build that overruns is visible immediately.

These are streaming-container budgets; per-scene render budgets remain governed
by `docs/SCALE_AND_PERFORMANCE.md` §2 and the Prompt 052 foundation gate.

### 2.5 Failure & slow-load recovery

- A chunk whose build fails enters `failed` and is retried after
  `failureRetryMs = 750`; the retry re-emits it in `toLoad` so the scene
  rebuilds it (its content was never constructed).
- `safeChunkId()` always returns a chunk with valid ground: the focus chunk when
  it is resident, else the **nearest resident neighbour**. So a failed or
  still-preloading focus chunk never strands the player — recovery snaps them to
  a loaded neighbour.

---

## 3. The eight separated concerns

Render meshes, collision proxies, navigation surfaces, interaction anchors,
spawn sets, camera volumes, audio zones, and persistence ids are **separate
concerns** (§3.1). The controller speaks only in persistence-id'd chunks and
abstract states; it never references a render mesh. The scene maps state → layers:

| State | render | collision | navigation | interaction | spawn | camera vol. | audio | persistence |
|---|---|---|---|---|---|---|---|---|
| `active` | on | on | on | on | on | on | on | id retained |
| `loaded` | on (throttled sim) | on | on | resolved | on | on | on | id retained |
| `unloaded` | released | released | released | released | released | released | released | id stable, content re-derivable |

In the proving ground each loaded chunk groups its layers under one disposable
`TransformNode` keyed by the chunk's persistence id, so unloading is a single
dispose and **identity never drifts** (a chunk id is never resident twice —
`duplicateGroupIds()` is empty by construction).

---

## 4. Content variants (tide / season / weather / restoration)

`src/world/variants.ts`. A chunk declares a set of **stable anchors**
(`ContentAnchor`), each with a stable `id`, a `kind`, a world position, and
optional variant rules:

- `hideOnTide` — hidden at a tide (a tide-pool crab present only at low tide).
- `restorationMinStage` — present only once the community rebuild reaches a stage.
- `seasonAppearance` / `weatherAppearance` — an appearance key per season/weather
  (weather overrides season).

**Load-bearing invariant:** the set of `anchorId`s a chunk declares is **constant
across every variant state**; only each anchor's `present` flag and `appearance`
key change. A low-tide reef and a high-tide reef are the *same* persisted chunk
with the *same* anchors — the tide just hides the crab and submerges the piling.
`resolveChunkContent` returns exactly one entry per declared anchor, in
declaration order, under every variant. This is what lets saves and transitions
reference anchor ids safely (§3.1).

---

## 5. Cross-region transitions (community-to-community)

A `RegionTransition` carries source anchor, destination region + anchor, restored
facing, and the camera context to hand off to (the OoT-era authored handoff,
§1.1). Swapping the active region (`StreamingController.setRegion`) drops the
previous region's chunks wholesale and rebuilds the ring around the destination —
so the handoff is clean rather than a coordinate collision between two regions
that happen to share local chunk indices.

The **Willa Crick ↔ Ballast Bay** crossing along the Klam-ity River corridor is
the canonical example: crossing the corridor boundary swaps the active region,
recovers the player onto the destination anchor, and primes the destination ring
in the same step so there is no empty frame — no seam pop, on foot or mounted.
The proving ground wires this on the `x = 200` boundary (and via
`crossToBallastBay()`); the real corridor map is Prompt 048.

---

## 6. Debug surfaces

- **`?scene=StreamingLab`** — the proving ground. Two communities, walkable
  internal seams, the community transition, variant switching, budget display.
  `window.sturdyVolleyStream` is the introspection API (chunk states, budget,
  anchors, transitions, deterministic `tick()` stepper).
- **`?debug=streaming`** — the overlay (`src/render/streaming-overlay.ts`):
  active region + origin, focus chunk, per-state counts (A/L/P/F), and live
  budget usage (chunks / meshes / bodies, red when over).

Both are dev-only and never appear in ordinary play (the same allow-listed
direct-boot pattern as the camera proving ground).

---

## 7. What this layer does **not** do

- Region content/layout (Prompts 037–049), interiors (Prompt 036), navigation
  meshes (Prompts 040–041), fauna (042–043), flora (045) — all build on top.
- Terrain physics: the proving ground is flat; the kinematic motor
  (`docs/GAMEPLAY_MOTOR.md`) owns grounding/slopes/steps within a chunk.
- Final per-scene render budgets — those stay in
  `docs/SCALE_AND_PERFORMANCE.md` and the Prompt 052 gate.
