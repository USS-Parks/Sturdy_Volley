# Dimensioned Blockouts — Breakpoint Farm + Ballast Bay District

Last revised: 2026-06-20 (Prompt 039 / WEF-06c)

The dimensioned top-down + elevation blockouts for the first two
production-foundation regions, derived from the metric kit (Prompt 037) and the
atlas sheets (038). They are **machine-readable** `MapDocument`s — the
authoritative source the Prompt 046 (farm) + 047 (town) graybox builds read
from. Every anchor, camera volume, route, collision/navigation reference,
elevation band, and transition is fixed here and validated against the map
schema in the gate + the live Dev data report.

Source of truth in code:

- `src/world/blockouts/breakpoint-farm.ts` — `BREAKPOINT_FARM_BLOCKOUT`.
- `src/world/blockouts/ballast-bay-district.ts` — `BALLAST_BAY_DISTRICT_BLOCKOUT`.
- Registered in `AUTHORED_MAPS` (`src/world/sample-map.ts`) → validated by
  `getWorldMapReport()` (Title "Dev · Validate data") + `tests/unit/blockouts.test.ts`.

Traceability: route widths are the literal `METRIC_KIT` values, so every route
provably clears its required bodies (`routeWidthOk`); the schema rejects any that
don't. Grounded in `sv_map_012_breakpoint_farm_layout.png` +
`sv_env_041_breakpoint_morning.png` (farm) and `sv_map_013_ballast_bay_town_layout.png`
+ `sv_map_026`/`sv_map_027` (town).

---

## 1. Breakpoint Farm (`breakpoint-farm`)

- **Footprint:** 128 × 128 m → a 4 × 4 grid of 32 m chunks (16 cells).
- **Elevation bands:** `tide-fed lowland` (0–0.5 m) → `farmyard` (0.5–2.0 m) →
  `orchard bluff` (2.0–6.0 m).
- **Top-down anchors:** farmhouse / shed / greenhouse doorways, the farm well,
  pasture gate, crop-field centre, pond edge, the tide-gated **creek ford**, the
  orchard-bluff overlook, and three region-edge gates (→ town, → river, → marsh).
- **Camera volumes:** `vol-farmyard` (`farm:standard`, fallback `exterior:standard`)
  over the working yard; `vol-orchard-bluff` (`exterior:standard`, higher
  priority) on the cliff overlook. Both carry a 0.6 m blend boundary so the
  yard↔bluff edge doesn't oscillate.
- **Routes:** yard road + town road (3.0 m, clear the large animal), garden path
  (1.6 m), creek desire-line (1.2 m, capsule + small animal), creek footbridge
  (1.8 m).
- **Collision/nav references:** building boxes, orchard-cliff + pasture-fence
  proxies; yard + pasture nav patches; a creek-bridge nav link.
- **Variants:** the creek ford hides at high tide; the crop field takes a winter
  appearance. (No central court/net — §1.4 sports purge.)
- **Transitions:** to the farmhouse / shed / greenhouse interiors (smallInterior)
  and out to Ballast Bay Town (farm camera), the Klam-ity River, and Belltide
  Marsh (exterior).

---

## 2. Ballast Bay district (`ballast-bay-town`)

- **Footprint:** 160 × 128 m → a 5 × 4 grid of 32 m chunks (20 cells) — the
  representative district (market lane + harbor approach + an elevation change).
- **Elevation bands:** `harborfront` (0–0.5 m) → `market lane` (0.5–3.0 m) →
  `upper terraces` (3.0–6.0 m). The harbor→terrace climb is the required ≥1
  elevation change, bridged by a stair **elevation-link** (`terrace-stair-base`
  → `terrace-stair-top`).
- **Top-down anchors:** community-hall / bakery / fishmonger / general-store
  doorways, the market well, the harbor dock, beach access, the terrace stair
  pair, and three region-edge gates (→ farm, → point, → beach).
- **Camera volumes:** `vol-market-lane` (`exterior:standard`) over the lane;
  `vol-harborfront` (`exterior:near`, tighter) on the docks — proving a
  per-district framing change without a profile snap (0.6 m blend boundary).
- **Routes:** the market road (3.0 m) running beach→lane→point, the harbor dock
  (2.0 m), a store path + a beach path (1.6 m).
- **Collision/nav references:** shop boxes, terrace-wall + harbor-edge proxies;
  lane + harbor nav patches; the terrace-stair nav link.
- **Variants:** the market well takes a winter appearance; the harbor dock
  appears once restoration reaches stage 1 (storm repair).
- **Transitions:** to the community hall (largeInterior) + shop interiors
  (smallInterior), and out to Breakpoint Farm (farm camera), Netlight Point
  (exterior), and Driftwood Beach (water camera).

---

## 3. How they're verified

- **Schema + semantics:** `validateMapDocument` (Prompt 037) checks coordinate
  frame, uniform chunk grid, **non-overlapping elevation bands**, anchor id
  uniqueness, per-kind route clearance, camera-context resolution, outgoing
  transition region match, and dangling references.
- **Gate:** `tests/unit/blockouts.test.ts` asserts both validate clean, own the
  right region + chunk count, stack ordered elevation bands, and trace every
  route width to the metric kit.
- **In game:** both appear in the Title "Dev · Validate data" report beside the
  content + atlas validation — a broken blockout shows red.

These blockouts are the contract the Prompt 046/047 graybox builds implement;
they may be refined there only by recording the change back here.
