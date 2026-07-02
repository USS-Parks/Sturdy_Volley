# Gray Model Catalog and Proof Contract

Companion to `GRAY_MODEL_ART_LIBRARY.md`. GML-00, 2026-07-02.

## Per-model proof contract

Every production model ships as a reviewable four-file bundle:

- `<asset>.blend` — editable Blender source;
- `<asset>.glb` — Babylon runtime export;
- `<asset>_preview.png` — standardized 3/4 proof render;
- `<asset>.asset.json` — source-board references, dimensions, budgets, variants, and
  validation results.

The proof uses a consistent orthographic 3/4 camera, neutral studio lighting/background,
readable ground shadow, and no atmospheric treatment that could conceal weak geometry.
State, upgrade, growth, or body variants receive separate previews whenever their geometry
changes materially. A model cannot pass its asset gate without its proof image.

## Canonical family taxonomy

Dimensions are bounding targets, not permission to violate existing blockout anchors. Every
row expands into item-level manifest records during AL-2, including all objects visible on
its cited boards.

| Priority | Family / representative gray ids | Approximate scale | Art sources | First scene | Policy | Future asset family |
|---|---|---:|---|---|---|---|
| P0 | `terrain-world-vista`, region terraces, coast islets | 4–32 m modules | P-230; B-011; O-213/214 | World Poster Library | Visual; scene terrain stays foundation | `terrain/world-*` |
| P0 | grass, dirt, cobble, boardwalk, snow ground tiles | 1 × 1 × ≤0.15 m | C-040; O-213/214; K-168 | Library / Farm | Visual on existing walk surface | `terrain/ground-*` |
| P0 | straight, corner, and junction paths | 1 m grid; 1.6 m path | C-040; B-012/013 | Breakpoint Farm | Visual; nav route stays foundation | `kit/path-*` |
| P0 | wood, rope, stone, and shell fence modules | 1–2 m long; 0.8–1.2 m high | C-031–040 | Breakpoint Farm | Hybrid only where gameplay blocks | `kit/fence-*` |
| P0 | farmhouse, barn, coop, greenhouse shells | walls 3–4 m; doors ≥1 × 1.8 m | B-012/023/024; J-146/150; P-230 | Breakpoint Farm | Hybrid; blockouts authoritative | `building/farm-*` |
| P0 | raised beds, crates, baskets, well, lantern rock | 0.35–2.4 m | P-230; I-121–126; J-140; N | Breakpoint Farm | Visual except interaction proxy | `prop/farm-*` |
| P0 | redwood, fir, willow, fruit-tree families | 5–14 m tall | P-230; I-127; D | Library / Farm | Visual plus deliberate trunk proxy | `flora/tree-*` |
| P0 | rocks, bushes, flowers, mushrooms, reeds | 0.1–2.5 m | I-128/129; D | Farm / Marsh | Visual | `flora/*` |
| P0 | all crop growth and quality families | within 1 m cell; ≤1.4 m | I-121–126/135 | Breakpoint Farm | Visual; farm cell owns targeting | `crop/<id>-<stage>` |
| P0 | village houses and shop shells | 5–12 m footprint; 3–7 m tall | B-013/022/026/028/029; D; P-230 | Ballast Bay Town | Hybrid; blockouts authoritative | `building/town-*` |
| P0 | stalls, tables, benches, planters, well, crates, barrels | 0.5–3.5 m | B-026/028; K; N; P-230 | Ballast Bay Town | Visual except interaction proxy | `prop/town-*` |
| P0 | common fire and lantern gathering clusters | 1–5 m clusters | D; K; P-230 | Ballast Bay Town | Visual plus fire trigger | `prop/common-*` |
| P0 | docks, mooring posts, pier clutter | 2 m modules; width ≥1.6 m | B-013/027; D; P-230 | Town Harbor | Hybrid; traversal proxy stays | `kit/dock-*`, `prop/harbor-*` |
| P0 | working skiffs and rowboats | 2.5–6 m long | B-027; D; P-230 | Harbor / Beach | Visual in GML | `vehicle/boat-*` |
| P0 | lighthouse and lighthouse cliff | tower 12–20 m; cliff 8–24 m | B-015; D; P-230 | Library / Netlight | Hybrid; simple cliff proxy | `building/lighthouse`, `terrain/lighthouse-cliff` |
| P0 | marsh boardwalk, lanterns, reeds | 1–2 m boards; width ≥1.6 m | B-017; D; P-230 | Library / Marsh | Hybrid; traversal independent | `kit/marsh-*` |
| P0 | quarry terraces, gantry, ore nodes | terraces 4–16 m; gantry 6–12 m | B-018; D; P-230 | Library / Mine | Hybrid; simple proxies | `terrain/quarry-*`, `building/quarry-*` |
| P0 | ridge cliffs, watchtower, ridge pines | cliffs 6–24 m; tower 6–10 m | B-020; D; P-230 | Library / Ridge | Hybrid | `terrain/ridge-*`, `building/watchtower` |
| P0 | player and NPC silhouette proxies | 1.65–1.9 m tall | A-007/008; E/F/G; P-229/230 | World Poster | Visual; motor owns collision | `character/*` |
| P0 | dog, chicken, goat proxies | 0.35–1.2 m tall | H; P-230 | Farm / Library | Visual child of simulation | `animal/*` |
| P1 | driftwood, dune grass, sea rocks, reef/islets | 0.2–5 m | B-014/016/021; D; P-230 | Driftwood Beach | Visual; water proxies unchanged | `terrain/coast-*`, `flora/coast-*` |
| P1 | broken marsh planks and water edges | 1 m modules | B-017; D | Belltide Marsh | Visual; never render collision | `kit/marsh-*`, `terrain/marsh-*` |
| P1 | rail lift, quarry cart, ore clusters | 1–12 m | B-018/020; D | Quarry / Ridge | Hybrid | `building/rail-lift`, `prop/quarry-*` |
| P1 | hand tools and four material tiers | 0.4–1.4 m | J-136/137; O | Farm / Hero | Visual; action owns hit logic | `tool/*` |
| P1 | five machines and three runtime states | 0.8–2.2 m | J-141–145 | Farm / Interiors | Visual around interaction proxy | `machine/*` |
| P1 | furniture and interior prop catalog | 0.4–2.4 m | N-203–212; B-022/023 | Farmhouse Interior | Hybrid with placement bounds | `furniture/*` |
| P1 | remaining domestic and wild animal families | 0.1–1.5 m | H-105–120 | Library / live scenes | Visual child of simulation | `animal/*` |
| P2 | small clutter, craft displays, festival decor | 0.1–2 m | J-140; K; M; N | Relevant scenes | Visual | `prop/*` |
| P2 | seasonal, upgrade, restoration, state, quality, palette variants | base bounds | C; I; J; K; M | All regions | Same as base | descriptor variant |

## Required item-level dispositions

AL-2's manifest expansion must enumerate rather than imply:

- the customizable hero, 24 named NPC identities, and crowd groupings;
- all 16 domestic/wild animal families and every shown material, palette, and body variant;
- every crop, seed, five-stage growth sequence, quality tier, food, forage, tree, flower,
  mushroom, seaweed, shell, fish, insect, and small wildlife form;
- every tool and tier, inventory object, machine and state, furniture/decor item, building
  and upgrade/restoration tier, vehicle, dock/boardwalk/path/fence/ground module, and
  environment landmark;
- all distinct physical props shown on maps, interiors, story/festival scenes, covers, UI
  mockups, model sheets, and production-reference boards, even when absent from a prop sheet;
- material, lighting, weather, VFX, camera, UI, portrait, animation, and layout references
  as non-mesh records so their contribution remains traceable.

## Zone composition checklist

- **Farm foreground:** path, fence, beds/crops, farmhouse, well, crates, tools, lantern,
  player, dog, chicken, and goat.
- **Village/common:** timber houses, market stalls, benches, planters, well, common fire and
  lantern gathering, and modest townsfolk clusters.
- **Harbor/coast:** docks, working boats, mooring clutter, beach rocks/driftwood, reef/islet
  markers, and lighthouse.
- **Marsh:** boardwalk, broken boards, reeds, shallow-water edges, and lantern posts.
- **Quarry/ridge:** terraces, ore, gantry/rail-lift silhouette, ridge pines, watchtower, and
  cliff-path markers.
- **Outer horizon:** low islets, sea rocks, forested ridge, fog layers, and lighthouse beam.
  Atmosphere is a scene concern, not baked gray geometry.

## Collision-foundation matrix

| Foundation owner | Gray/final render relationship |
|---|---|
| Player, NPC, and animal motors | Render follows only; motor capsule remains authoritative. |
| Buildings and doorways | Existing blockout boxes and doorway triggers remain; shell fits them. |
| Roads, paths, docks, boardwalks | Existing walk/nav surface remains; visible pieces sit on it. |
| Cliffs, quarry terraces, lighthouse rock | Named low-complexity proxies stay separate from facets. |
| Farm cells and crops | Logical 1 m cell owns targeting; crop mesh is visual state. |
| Machines, furniture, tools, pickups | Placement/interaction bounds own behavior. |
| Trees, rocks, fences, props | Visual by default; primitive proxy only for deliberate blockage. |
| Water, shore, reef, marsh pools | Existing medium/wade/water volumes remain authoritative. |

