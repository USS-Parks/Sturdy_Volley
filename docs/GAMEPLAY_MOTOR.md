# Gameplay Motor and Physics — Sturdy Volley

Last revised: 2026-06-20 (Prompt 032, WEF-02b).
Normative for the player kinematic-capsule motor. Units: **metres and seconds**.

## 1. Architecture

The motor is split so the behaviour is pure + testable and the physics engine is
swappable behind a narrow port:

- `src/engine/motor.ts` — the **pure kinematic capsule motor core**
  (`stepMotor`). No Babylon, no physics-engine import. Owns gravity, grounding,
  ground-snap, slope limit/slide, step-up, wall collide-and-slide, ceiling
  clamp, moving-platform carry, penetration recovery, out-of-bounds recovery,
  and facing turn. Deterministic given the same inputs + `dt`. It consumes a
  `MotorEnvironment` (ground + wall + step-ground + ceiling probes).
- `src/engine/controller.ts` — the existing locomotion controller (unchanged):
  turns input into a speed with acceleration/braking, a gait, and stamina. The
  motor consumes its `speed`, so **stamina + gait stay authoritative** through
  the motor.
- `src/physics/motor-physics.ts` — the narrow `MotorPhysics` port. It exposes a
  general `raycast` (and a `groundProbe` convenience); the scene assembles the
  ground/wall/step/ceiling probes into the `MotorEnvironment`. Two backends:
  - `HavokMotorPhysics` — rays through the Havok physics world (static colliders
    on the ground + standable/obstacle meshes). **Primary** when Havok loaded.
  - `RaypickMotorPhysics` — `scene.pickWithRay` fallback (no physics engine).
- `src/physics/havok.ts` — loads Havok (`@babylonjs/havok` 1.3.12) and builds the
  `HavokPlugin`; returns `null` on failure so the caller falls back to ray-pick.

Verified against the pinned packages **@babylonjs/core 7.54.3** +
**@babylonjs/havok 1.3.12**. Havok confirmed loading + initialising in the
headless production-preview build (the Playwright environment), so the primary
backend is exercised, not only the fallback.

The moving-platform contact contract is detected geometrically by the scene
(`GroundHit.platformVel`), so it is backend-independent (no Havok kinematic body
needed). Water + authored traversal links (vault/climb/swim) are **Prompt 033**.

## 2. Locked tuning

### Capsule
| Property | Value |
|---|---|
| Height | **1.8 m** |
| Radius | **0.4 m** |
| Skin / contact offset | **0.08 m** |
| Centre→feet | 0.9 m (height / 2) |

### Vertical
| Property | Value |
|---|---|
| Gravity | **−22 m/s²** (snappier than real 9.81 for game feel) |
| Terminal fall speed | **−45 m/s** |
| Ground-snap distance | **0.35 m** (feet snap down to small steps without leaving the ground) |
| World gravity (Havok) | (0, −22, 0) m/s² — matches the motor |

### Terrain (WEF-02b)
| Property | Value |
|---|---|
| Slope limit | **50°** — steeper ground is not standable; the player slides down it |
| Slide speed | **6 m/s** (scaled by steepness above the limit) |
| Step offset | **0.4 m** — max ledge the capsule climbs without jumping |
| Out-of-bounds floor | **−25 m** — below this the player recovers to the last safe grounded pose |

### Horizontal (from `controller.ts`, consumed by the motor)
| Property | Value |
|---|---|
| Jog speed | **4 m/s** |
| Sprint speed | **7.5 m/s** |
| Exhausted speed | **2.4 m/s** |
| Acceleration | **30 m/s²** |
| Braking (deceleration) | **40 m/s²** |
| Max stamina | 100 |
| Sprint drain | 26 /s |
| Stamina recovery | 16 /s |

### Facing
| Property | Value |
|---|---|
| Turn rate | **12 rad/s** toward the move direction (shortest arc) |

Source of truth: `DEFAULT_MOTOR_CONFIG` (`src/engine/motor.ts`) +
`DEFAULT_CONTROLLER_CONFIG` (`src/engine/controller.ts`).

## 3. Grounding rule

Each step the adapter casts down from the capsule centre (`groundProbe`,
range = capsule height + 1 m). The motor then:

1. If a ground hit exists, vertical velocity ≤ 0, and the feet are within
   `groundSnapDistance + skinOffset` of it → **snap to ground**, zero vertical
   velocity, `grounded = true`.
2. Otherwise integrate gravity (clamped to terminal fall), move, and if the feet
   crossed the ground while descending → land (snap + ground).
3. Horizontal displacement = `moveDir × controllerSpeed × dt`. While braking the
   capsule glides along the last heading until the controller speed reaches 0.

This produces stable rest on flat ground (no sink, no hover), free-fall + landing
at the capsule rest height, small-step snap-down, and a fall-off on drops beyond
the snap band — all covered by `tests/unit/motor.test.ts`.

## 3b. Terrain handling (WEF-02b)

The scene assembles a `MotorEnvironment` each step from `MotorPhysics.raycast`:

- **Ground** (down from the centre) — as above, plus the moving-platform override.
- **Wall** (in the move direction, cast *above* the step height so low steps are
  not seen as walls) — its gap-to-surface drives collide-and-slide.
- **Step-ground** (down, just beyond the wall) — a standable surface ≤ `stepOffset`
  above the feet triggers a **step-up**; otherwise the move **slides** along the
  wall plane (no tunnel, no trap).
- **Ceiling** (up from the head) — clamps upward motion and blocks a step-up that
  has no headroom.

On top of grounding: ground steeper than **`slopeLimit`** makes the player
**slide** downhill (`slideSpeed`, scaled by steepness); a moving platform's
velocity is **carried** while grounded on it; a wall reporting negative gap
(penetration) **pushes the capsule out** along its normal; and falling below
**`recoverMinY`** **recovers** the player to the last stably-grounded pose. Each
case has deterministic unit coverage in `tests/unit/motor.test.ts`.

## 4. Proving ground + debug

`CameraLabScene` drives the motor with camera-relative WASD/arrows (Shift =
sprint), grounded through the active backend, against the kit's slope / stairs /
walls / cliff / cave / doorway stations (static Havok box colliders) and a demo
moving platform. `window.sturdyVolleyLab` exposes `motor()` (position / grounded
/ sliding / velocityY / facing), `controller()` (stamina / gait / speed),
`physicsBackend()`, `dropPlayer(x,y,z)`, `setPlayer(x,z)`, `sink()`, and
`platform()`. `tests/e2e/camera-lab.spec.ts` asserts gravity + landing, grounded
keyboard movement + sprint stamina, stair climbing, wall no-tunnel, out-of-bounds
recovery, and platform carry — on both Playwright projects.
