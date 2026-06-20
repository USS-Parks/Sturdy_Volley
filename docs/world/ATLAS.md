# World Atlas — Sturdy Volley

Last revised: 2026-06-20 (Prompt 038 / WEF-06b)

Global adjacency + progression across the twelve §4.2 core regions, plus an
authoritative spatial sheet per region. The atlas is the map of the map: it fixes
each region's role, neighbours, landmark, traversal vocabulary, and production
order **before** any region is dimensioned (Prompt 039) or graybox'd (046–049).

Machine-readable source of truth: `src/world/atlas.ts` (`ATLAS`, `WORLD_SPINE`,
`STARTING_FARMS`, `validateAtlas`). The structural invariants below are enforced
in code + the gate (`tests/unit/atlas.test.ts`) and surfaced live in the Title
**Dev · Validate data** report (`getAtlasReport`). Originality (§0.7): every
region's topology + landmark is original to Ballast Bay, grounded in its
top-down board (overworld `sv_map_011`, per-region `sv_map_012`–`021`).

---

## 1. The world spine + two communities

Two connected communities anchor the world (master roster §1.3):

```
Willa Crick  ──  The Klam-ity River  ──  Ballast Bay
 (inland)            (corridor)            (coastal)
```

- **Willa Crick** — inland redwood community (creek homesteads, mill, ridge gateway).
- **Ballast Bay** — coastal community (town, harbor, farm, beaches, reefs, point).
- **The Klam-ity River** — the corridor joining them; the showcase route for
  **mounted (horseback) traversal** (Prompt 044 + the 048 corridor map). It is
  horse-traversable end to end (bank paths, fords, the twin-span bridge) and
  carries the community-to-community transition without seam pop.

`WORLD_SPINE = [willa-crick, klam-ity-river, ballast-bay-town]` is validated as a
connected chain. **Starting farms** attach to both communities — coastal:
Open Meadow, Tideplot, Marshlight, Pasturewell; inland: Grovewall, Quarryline,
Fourwinds, Stormbreak.

---

## 2. Global adjacency graph

```
willa-crick ── klam-ity-river ── breakpoint-farm
     │               │                  │
splitwind-ridge      └──── ballast-bay-town ──── netlight-point
     │                       │     │    │              │
ironroot-quarry ── belltide-marsh  │    └── driftwood-beach ── kelpglass-reefs ── outer-islets
     │                             │
rainhall-caverns                   (market lane / harbor hub)
```

| Region | Adjacent to |
|---|---|
| willa-crick | klam-ity-river, splitwind-ridge |
| klam-ity-river | willa-crick, breakpoint-farm, ballast-bay-town |
| breakpoint-farm | ballast-bay-town, klam-ity-river, belltide-marsh |
| ballast-bay-town | breakpoint-farm, klam-ity-river, netlight-point, driftwood-beach, belltide-marsh |
| netlight-point | ballast-bay-town, driftwood-beach |
| driftwood-beach | ballast-bay-town, netlight-point, kelpglass-reefs |
| kelpglass-reefs | driftwood-beach, outer-islets |
| belltide-marsh | ballast-bay-town, breakpoint-farm, ironroot-quarry |
| ironroot-quarry | belltide-marsh, rainhall-caverns, splitwind-ridge |
| rainhall-caverns | ironroot-quarry |
| splitwind-ridge | willa-crick, ironroot-quarry |
| outer-islets | kelpglass-reefs |

Validated: adjacencies are **symmetric**, all references resolve, and the graph
is **connected** (every region reachable). Ballast Bay Town is the hub; Outer
Islets is the late-game leaf (ferry-gated).

---

## 3. Progression / production order

The build sequence (`productionOrder`) and rough unlock progression:

| # | Region | Note |
|---:|---|---|
| 1 | breakpoint-farm | the starter homestead (graybox map Prompt 046) |
| 2 | ballast-bay-town | the hub (047) |
| 3 | driftwood-beach | early beach loop |
| 4 | rainhall-caverns | the cavern slice (049) |
| 5 | belltide-marsh | wetland forage |
| 6 | netlight-point | the lighthouse beacon line |
| 7 | kelpglass-reefs | reef + snorkeling |
| 8 | ironroot-quarry | mining + descent |
| 9 | klam-ity-river | the corridor + mounted traversal (048) — *provisional metrics* |
| 10 | willa-crick | inland community — *provisional metrics* |
| 11 | splitwind-ridge | high mountain |
| 12 | outer-islets | late-game ferry isles |

The **Klam-ity River** and **Willa Crick** sheets are marked *provisional*:
their role + adjacency are fixed, but their dimensioned metrics await the inland
art board (master roster §1.4) — only those two carry the flag.

---

## 4. Region sheets

Each sheet carries: purpose · footprint (m) · elevation bands · adjacencies ·
sightline landmark · traversal vocabulary · activity density · streaming cells
(32 m chunks) · variant axes · required interiors · camera context + risks ·
navigation risks · production order. The authoritative values live in
`src/world/atlas.ts`; the highlights:

### Willa Crick *(provisional)* — inland community
Creekside homesteads + mill + ridge gateway. 192×160 m. Landmark: **the Old Crick
Mill wheel**. Traversal: walk / path / road / bridge / ford / stairs / doorway /
mount. Interiors: crick-mill, homestead. Camera: exterior — redwood trunks occlude
the chase camera. Nav: creek crossings force fords/bridges.

### The Klam-ity River *(provisional)* — corridor
River corridor + mounted-traversal showcase. 288×96 m. Landmark: **the twin-span
Klam-ity Bridge**. Traversal: walk / path / road / bridge / ford / wade / cliff /
mount. Camera: cliff walls pinch the bank orbit. Nav: ford depth vs swim boundary;
horse-speed seam preload at the community transition.

### Breakpoint Farm — the homestead
Soil plots, paddocks, kitchen garden, orchard bluff, greenhouse ruin. 128×128 m.
Landmark: **the leaning greenhouse ruin**. Camera: farm. Interiors: farmhouse,
shed, greenhouse. Nav: irrigation channels split the plots. (No central court/net
— §1.4 sports purge.)

### Ballast Bay Town — the hub
Market lane, harbor approach, community hall, shops, beach access. 192×160 m, high
density. Landmark: **the Old Netlight beacon on the point**. Interiors:
community-hall, bakery, fishmonger, general-store, clinic, library. Camera:
terraced rooflines occlude the market lane. Nav: crowded NPCs + stair seams.

### Netlight Point — the lighthouse
Beacon room, observatory deck, storm-cellar archive, signal puzzles. 96×96 m.
Landmark: **the Old Netlight tower**. Camera: exposed cliff, 4 m+ drop on three
sides. Interiors: beacon-room, storm-cellar-archive.

### Driftwood Beach — the tidal beach
Shells, tidepools, crab pots, picnic dates, turtle nesting. 160×96 m. Landmark:
**the great bleached driftwood arch**. Camera: water — keep shore + horizon legible
while wading. Variants: tide reshapes the walkable sand twice a day.

### Kelpglass Reefs — the reef
Low-tide reef + snorkeling, seaweed farming, coral restoration. 128×128 m. Landmark:
**the glassy kelp-curtain shoal**. Camera: water (underwater framing). Tide gates
which reef cells are reachable.

### Belltide Marsh — the wetland
Forage, herbs, frogs, reeds, boardwalk repairs, fog navigation. 160×160 m. Landmark:
**the lantern-hung belltide boardwalk gate**. Camera: fog draw distance vs sightline.
Nav: broken boardwalk segments force detours.

### Ironroot Quarry — the open pit
Ore + crystal nodes, rail lifts, hazards, machine ruins. 128×128 m. Landmark:
**the rusted rail-lift gantry**. Camera: cave. Traversal: ladder / lift /
elevation-link. Interiors: quarry-office, cavern-mouth.

### The Rainhall Caverns — the cave slice
Echo creatures, mineral springs, flooded halls, tide doors, rhythm puzzles.
160×128 m. Landmark: **the luminous mineral-spring pool**. Camera: cave (tight→open
framing swings). Nav: tide-door flooding changes reachable halls. Interior:
boss-chamber.

### Splitwind Ridge — the high mountain
Windmills, glider shortcuts, snow forage, goats, high crops, storm quests.
160×160 m. Landmark: **the three ridgeline windmills**. Traversal: climb / bridge /
elevation-link / mount. Nav: switchbacks near the motor slope limit. Interiors:
windmill, ridge-shelter.

### Outer Islets — the late-game isles
Unusual crops, migratory animals, traveling merchants, map fragments,
eco-restoration. 192×160 m, ferry-gated. Landmark: **the weathered ferry-dock
totem**. Traversal: ferry + inter-islet wading. Interior: merchant-hut.

---

## 5. Invariants (enforced by `validateAtlas`)

- region ids unique; adjacencies symmetric + resolvable;
- the region graph is connected;
- the world spine is a connected chain in order;
- production order is unique;
- every region's `cameraContext` is a real `CAMERA_CONTEXTS` entry;
- every starting farm attaches to a community present in the atlas.

A break in any of these shows red in the Dev data report and fails the gate.

---

## 6. What this layer does **not** do

- Dimension the regions (Prompt 039 blockouts give Breakpoint Farm + the Ballast
  Bay district real metrics; the rest follow).
- Author the maps (046–049 graybox the production-foundation set).
- Design narrative / quests / achievements for the two communities — a separate
  future planning session (master roster §1.3 scope boundary).
