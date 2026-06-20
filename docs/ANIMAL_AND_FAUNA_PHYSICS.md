# Animal & Fauna Physics — Sturdy Volley

Last revised: 2026-06-20 (Prompt 042 / WEF-08a)

Normative for animal movement/physics. Defines movement **families** (not one
generic mover): each family declares scale, body proxy, gait bands, turning,
slope/water capability, obstacle policy, interaction distance, animation needs,
LOD/throttle, and save authority. The existing pets + farm animals are mapped to
a family and driven by the shared foundation — navigation (Prompts 040–041) +
the kinematic motor (031–033) + local avoidance + sim tiers — parameterised by
these values. Their **husbandry data** (affection / feeding / produce, in
`pets.ts` + `animals.ts`) is untouched by the migration.

Source of truth: `src/engine/animal-families.ts` (`ANIMAL_FAMILIES`, mappers,
capability helpers). Proving ground: `src/scenes/FaunaLabScene.ts`
(`?scene=FaunaLab`). Body proxies + scale follow the friendly-animal base meshes
(`sv_theme_03_004_shape_language.png` panel 8) + the chicken/goat scale in
`sv_style_007_camera_scale_guide.png`.

---

## 1. Families

| Field | small-quadruped-pet | grazing-livestock | poultry |
|---|---|---|---|
| Examples | Tide Cat, Bay Dog | Bluff Goat | Mooncalf Hen |
| Scale (×1.8 m ref) | 0.45 | 0.55 | 0.30 |
| Body proxy radius / height (m) | 0.30 / 0.50 | 0.50 / 0.90 | 0.25 / 0.40 |
| Gait bands (m/s) | idle 0 · walk 0.7 · trot 2.4 · run 3.5 | idle 0 · graze 0.4 · walk 1.2 · trot 2.0 | idle 0 · peck 0.3 · walk 0.8 |
| Turn rate (rad/s) | 6 | 3 | 8 |
| Slope limit (°) | 45 | 50 | 30 |
| Water capable | no | no | no |
| Obstacle policy | avoid | avoid | avoid |
| Interaction distance (m) | 1.2 | 1.5 | 1.0 |
| Animation clips | idle, walk, trot, sit | idle, graze, walk | idle, peck, walk |
| LOD tiers (m) | 12, 24 | 16, 32 | 10, 20 |
| Activation radius (m) | 24 | 28 | 20 |
| Save authority | full (pose + affection + collar) | position-anchor | position-anchor |

Kind → family: `bluff-goat` → grazing-livestock; `mooncalf-hen` → poultry;
`tide-cat`/`bay-dog` → small-quadruped-pet (`familyForAnimalKind`/`familyForPetKind`).

Helpers: `gaitSpeed(family, name)` (falls back to the fastest gait),
`familyCanEnterWater`, `familyCanWalkSlope(family, deg)`.

---

## 2. Migration: behaviour vs. locomotion

The migration splits **where** an animal goes (preserved game logic) from **how**
it moves (the shared foundation):

- **Pet** — `pets.ts` `tickPetFollow` still chooses the follow/idle target and
  evicts the pet from doorways (unchanged). The family framework then navigates +
  motors the pet to that target at the pet gait, with avoidance. Affection,
  collar, perks (`petPet`, `unlockedPetPerk`) are untouched.
- **Livestock** — graze by wandering to fresh points inside their fenced home
  patch, navigated + motored at the graze/walk gait. `animals.ts` affection,
  feeding, produce, weather, and schedule (`feedAnimal`, `petAnimal`,
  `tickAnimalDay`, `shouldBeOutside`) are untouched.

Locomotion is `engine/motor.stepMotor`; steering is `nav-avoidance.steerAvoid`
sized by the family body proxy; throttling is `npc-sim.assignTiers` by the
family activation radius.

---

## 3. Boundaries the framework respects

- **Fences / pasture** — the fenced home is a navmesh patch; graze targets stay
  inside it, and an animal that drifts off the navmesh is snapped back
  (recovery bounds).
- **Gates / doors** — nav off-mesh links; an animal paths through them like any
  NPC (the pet follows the player across the gate; hens through the coop door).
- **Cliffs** — a patch edge with a drop beyond; animals are clamped to the patch
  and never walk off.
- **Water** — the pond is a hazard patch kept off the animal navmesh, and
  `familyCanEnterWater` (false for every domestic family) snaps any animal that
  reaches it back to dry ground.
- **Soft contacts** — `steerAvoid` keeps player/animal + animal/animal centre
  gaps above the body proxy (no stacking, no shoving the player).

---

## 4. Verification

- **Gate:** `tests/unit/animal-families.test.ts` (family completeness +
  distinctness + capability helpers).
- **In game:** `?scene=FaunaLab` drives a Bay Dog (follows the player), two Bluff
  Goats (graze the pasture), and two Mooncalf Hens (peck the yard);
  `tests/e2e/fauna-lab.spec.ts` asserts distinct families, the pet follows, the
  grazers respect the fence/cliff/pond, contacts stay soft, and petting still
  raises affection through the migration.

---

## 5. What this layer does **not** do

- Wild fauna families (bird / shoreline crawler / swimming / cave creature) —
  Prompt 043 (WEF-08b).
- The rideable horse — Prompt 044 (extends grazing-livestock with ridden gaits).
- The live FarmScene animal migration onto the framework — Prompt 053.
- Final animal art / animation libraries — graybox proxies only (§0.9).
