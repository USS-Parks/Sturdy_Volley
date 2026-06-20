# Interior Construction Kit & Authored Camera Volumes — Sturdy Volley

Last revised: 2026-06-20 (Prompt 036 / WEF-05)

Normative for interior space. Defines the **metric kit** every interior is built
from (farmhouse rooms, shops, homes, public halls, cavern-like enclosures), the
**graybox builder** that turns a room spec into a closed-shell room, and the
**authored camera-volume** contract that frames interiors. The farmhouse
*reference implementation* is Prompt 046; this layer is the reusable kit.

Source of truth in code:

- `src/world/interior-kit.ts` — pure metrics, room spec model, validation, wall segmentation.
- `src/render/interior-builder.ts` — Babylon graybox builder (closed-shell rooms + volume + anchors).
- `src/camera/volumes.ts` — camera-volume model + sticky (anti-oscillation) selection.
- `src/camera/rig.ts` — binds volume override / target offset / obstruction mode / fallback.
- `src/scenes/InteriorLabScene.ts` — the proving ground (`?scene=InteriorLab`).

---

## 1. Metric kit (`INTERIOR_METRICS`)

All metres; reconciled with `docs/SCALE_AND_PERFORMANCE.md` §1 and the art scale
guide (`sv_style_007_camera_scale_guide.png`).

| Element | Dimension | Note |
|---|---|---|
| Wall thickness | 0.3 m | visible shell + collision proxy |
| Wall height | 3.2 m | mid-band of the 3.0–4.0 m convention |
| Floor / ceiling slab | 0.2 / 0.3 m | backing surfaces (§3) |
| Doorway | 1.2 m × 2.0 m | ≥ 1.0 m × 1.8 m — the capsule passes |
| Window | 1.0 m wide × 1.1 m, sill 0.9 m | apron below + lintel above keep the shell closed |
| Stair | rise 0.18 m, run 0.28 m, width 1.4 m | rise ≤ the motor step offset → smooth traversal |
| Counter | height 1.0 m, depth 0.7 m | shop/kitchen |
| Furniture clearance | 0.8 m | min walkable gap a feature must leave to an edge |
| Interaction reach | 1.5 m | one-button reach inside |
| Nav corridor width | 1.4 m | min open corridor width (capsule + comfort) |

### 1.1 Room spec + validation

A `RoomSpec` is a footprint (`width`×`depth`, optional `height`), `doorways`,
`windows`, and `features` (counter / stair / furniture / interaction).
`validateRoomSpec` returns every issue (empty = conformant), enforcing the
load-bearing playability rules:

- **doorway-clearance** — a doorway is a pinch point; it must clear the ≥ 1.0 m
  doorway minimum (not the wider open-corridor nav width) and ≥ 2.0 m tall.
- **doorway-side-overflow** — an opening must fit within its wall span.
- **ceiling-height** — the clear height must exceed the doorway height.
- **feature-clearance** — a feature must leave ≥ 0.8 m walkable gap to a room
  edge along X or Z.

`wallSpans(spec, side)` returns the solid wall segments after subtracting that
side's doorway/window openings — the builder turns each into a wall box and the
gaps into openings.

### 1.2 Bigger on the inside

Interiors may break the exterior footprint illusion when playability requires it.
When a room's interior footprint exceeds its building shell, the expansion is
recorded on the spec (`footprintExpansion`, m²) so the seam is an explicit,
auditable decision — not an accident.

---

## 2. Graybox builder (`buildRoom`)

`buildRoom(scene, spec, opts)` returns a `BuiltRoom`: a parented `TransformNode`,
the meshes (classified `wallMeshes` vs `backingMeshes`), the authored
`CameraVolume`, doorway anchors (world threshold + facing-into-room), and
interaction anchors. Primitives + `flatMaterial` only — a future `.glb` swap
replaces the visible meshes without touching the volume / anchors / collision.

Each room is a **closed shell**: floor + ceiling + four walls segmented around
doorways and windows. Windows get an apron (below sill) + lintel (above head) so
an opening is a window, not a doorway-height void.

---

## 3. Backing treatment — no void on fade/cutaway

The acceptance rule: *wall fade/cutaway never exposes a void without a deliberate
backing treatment.* The closed shell **is** that treatment — fading or cutting
away the near wall always reveals room interior (far wall / floor / ceiling),
never the skybox. The proving ground verifies this per archetype: hide the wall
nearest the camera, cast a camera→room-centre ray, and confirm it still hits a
room mesh (`seesBackingThroughNearWall`). The builder classifies floor, ceiling,
far walls, and features as `backingMeshes` precisely so this guarantee is
explicit.

---

## 4. Authored camera volumes (`CameraVolume`)

A volume overrides the camera while the framed target is inside it. Prompt 036
completes the contract:

| Field | Effect |
|---|---|
| `profileId` | profile (`context:variant`) to activate inside |
| `fallbackProfileId` | **safe fallback** profile if `profileId` fails to resolve |
| `targetOffset` | framed-target offset (e.g. lift the camera target in a tall hall) |
| `yawLimitDeg` | manual-orbit limit override |
| `obstructionMode` | per-volume occluder rule (`fade` / `cutaway`) overriding the global |
| `blendBoundary` | exit-hysteresis margin (m) — anti-oscillation (§4.1) |
| `priority` | higher priority wins on overlap |

The rig (`src/camera/rig.ts`) applies all of these each frame and reports the
**effective** active profile, obstruction mode, and selected volume id in
`getState()` (so a volume's profile — not just the base — is observable).

### 4.1 Blend boundary — adjacent volumes don't oscillate

`pickVolumeSticky(point, volumes, currentId)` retains the previously-selected
volume while the target is still inside it **expanded by its `blendBoundary`**,
unless a strictly-higher-priority volume now strictly contains the target. So a
player loitering on the shared edge of two adjacent rooms doesn't flip-flop the
camera profile (the cause of interior↔interior judder). Enter is immediate; exit
requires crossing the margin, by which point the target is solidly in the next
volume. With `blendBoundary` 0/undefined the behaviour reduces to the prior
stateless selection (no regression for existing volumes).

---

## 5. Exterior ↔ interior handoff

The handoff must preserve the **destination anchor, facing, camera intent, time,
NPC state, and return path**. Modelled as a handoff record: entering a room
snapshots the return path (the exterior pose + facing) and the preserved state
(clock minutes, NPC token), then recovers the player onto the room's doorway
anchor facing into the room with the room's camera context. Exiting restores the
exact return-path pose + facing. The transition never mutates the clock or NPC
state. The proving ground exercises this end to end; the live FarmScene↔Farmhouse
wiring lands with the reference implementation (Prompt 046) and the migration
(Prompt 053).

---

## 6. The five archetypes (proving ground)

`?scene=InteriorLab` builds: **small-room** (5×4, fade), **corridor** (2×10, nav
width), **stair-room** (6×6 with a stair feature), **crowded-shop** (7×6, counter
+ furniture + NPC clutter — primary-interaction readability), **large-hall**
(12×9, `cutaway` obstruction override + east windows). `window.sturdyVolleyInterior`
is the introspection API (room conformance, camera state, the void test, the
handoff, interaction focus). Each archetype keeps the player + primary
interaction HUD-safe on Pixel 5.

---

## 7. What this layer does **not** do

- Live FarmScene↔Farmhouse wiring (Prompt 046 / 053).
- Navigation meshes inside interiors (Prompts 040–041 build on the kit's nav
  dimensions).
- Final interior art / lighting / props — graybox only (§0.9).
