# Animal & Fauna Physics — Sturdy Volley

Last revised: 2026-06-20 (Prompt 044 — rideable mount)

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

## 5. Wild families (WEF-08b, Prompt 043)

Four wild families extend the framework, each with **behaviours** assembled from
`src/engine/fauna-behavior.ts` (pure steering: flee, flock, patrol, forage). None
requires a dynamic rigid body — they integrate a steering velocity and stay in
their domain.

| Family | Scale | Water | Behaviours | Domain |
|---|---|---|---|---|
| `bird` | 0.20 | no | flock + flee | air over the shore |
| `shoreline-crawler` | 0.18 | yes | forage + flee (to water) | tideflat |
| `swimming-fauna` | 0.22 | yes | flock (school) + swim + flee | the sea |
| `cave-creature` | 0.40 | no | patrol + flee | the cave |

- **Behaviours** — `flee` (away from the player within a radius), `flock` (boids:
  separation + alignment + cohesion), `patrol` (looping waypoints), `forage`
  (wander a domain). `familyHasBehavior(family, behavior)` queries them.
- **Domain respect** — fish stay in the sea, cave creatures in the cave, birds
  over the shore (never the open sea); crabs may dip into water (water-capable).
  A non-water family never ends up in the sea (`familyCanEnterWater`).
- **Sim tiers + ceiling** — distant fauna downgrade through `assignTiers`
  deterministically; an **active-skinned-body ceiling** (`MAX_ACTIVE_SKINNED`)
  caps how many fauna render a live mesh at once (mobile throttle) — measured +
  enforced (`activeSkinnedCount` ≤ `maxActiveSkinned`).

Proving ground: `?scene=WildLab` (8 birds, 6 crabs, 8 fish, 3 cave creatures);
`tests/e2e/wild-lab.spec.ts` asserts flocking cohesion, flee response, domain
respect, and the skinned-body ceiling. Unit: `tests/unit/fauna-behavior.test.ts`.

---

## 6. Rideable mount — the horse (Prompt 044)

The horse is the largest animal: a **`rideable-mount`** family (the *body*) plus a
dedicated *ridden* layer in `src/engine/mount.ts`. Horseback is the early-game
faster-transport option between Willa Crick and Ballast Bay (§1.3). Silhouette +
economy follow the OoT-era low-poly horse (`sv_theme_03_004_shape_language.png`
panel 11), withers ≈ 1.6 m against the 1.7–1.8 m human in
`sv_style_007_camera_scale_guide.png`.

**Body family (`rideable-mount`).** Scale 1.0 · proxy r 0.70 / h 1.70 (largest
body) · **free / riderless** gaits graze 0 · amble 1.0 · trot 3.0 · turn 2.2 rad/s
· slope 40° · **water-capable (fords shallow water)** · interaction (mount reach)
2.0 m · save authority **full (location + tame/ownership)** · a **mount-anchor
socket** at local (0, 1.5, 0) for the rider seat. `isRideableFamily` /
`rideableFamilies` query it.

**Ridden layer (`mount.ts`, pure + deterministic).**

- **Ridden motor profile** — `RIDDEN_MOTOR_CONFIG`: a **distinct, faster** profile
  vs. the on-foot player (`DEFAULT_MOTOR_CONFIG`). Capsule 2.6 m × 0.70 m (horse +
  seated rider); turn 6 rad/s (a **wider arc** than the on-foot 12 — a horse can't
  pivot); `stepOffset` 0.45 (onto bridge decks); `swimDepth` 1.3 (fords/**wades**
  shallow water, swims only deeper).
- **Ridden gait bands** — `RIDDEN_GAITS` halt 0 · walk 2.0 · trot 5.0 · canter 8.0
  · **gallop 11.0** (far above the player run, so horseback is a real upgrade),
  with a **momentum ramp** (`rampSpeed`, accel 6 / brake 9 m/s²) for the "accel"
  half of the profile.
- **Mount/dismount state machine** — `free → mounting → ridden → dismounting →
  free`, a contextual **one-button** `toggleMount` (mount when free + owned + in
  reach, dismount when ridden) blended over `MOUNT_DURATION` (0.45 s). Dismount
  returns a **valid grounded pose beside the horse** (`dismountPose`, never inside
  the body).
- **Mounted-camera handoff** — `shouldUseMountedCamera` is true for `mounting` +
  `ridden`; the scene swaps the real `CameraRig` to the Prompt 030 **`mounted`**
  baseline and blends back to `exterior` on dismount with **no discontinuity**
  (the rig eases beta/FOV/distance). The engine layer returns a boolean so it
  stays decoupled from the camera catalogue.
- **Save/restore** — `serializeMount`/`restoreMount` persist the stable phase
  (`free`/`ridden`; a mid-transition save snaps to its endpoint) + horse pose +
  ownership.

**Proving ground:** `?scene=MountLab` — a graybox horse on a course with a
shallow **ford**, a **slope** hump, a **bridge** deck, the **Willa Crick ↔ Ballast
Bay seam** arch, and a solid **obstruction**. Mounting hands the camera to the
mounted baseline; the ride wades the ford, crosses the bridge + seam, and stops at
the obstruction without tunnelling; a riderless horse wanders the paddock and
recovers. `tests/e2e/mount-lab.spec.ts` (both projects) + `tests/unit/mount.test.ts`
(ridden motor + state machine) + `tests/unit/animal-families.test.ts` (the family).

---

## 7. What this layer does **not** do

- The live FarmScene animal migration onto the framework — Prompt 053.
- The river-corridor map that exercises the mount end-to-end — Prompt 048.
- Final animal art / animation libraries — graybox proxies only (§0.9).
