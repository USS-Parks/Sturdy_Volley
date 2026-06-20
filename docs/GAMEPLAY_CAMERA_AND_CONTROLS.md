# Gameplay Camera and Controls — Sturdy Volley

Last revised: 2026-06-19 (Prompt 030, WEF-01c).
Normative for the camera. Supersedes the placeholder camera notes in
`docs/SCALE_AND_PERFORMANCE.md` §1 (those rows describe the legacy fixed
three-quarter camera of Prompts 001–027; the foundation camera is below).

This document **locks the camera gate** (master Prompts 028–030). No production
map metric is finalised before this gate; the metric kit (Prompt 037) and all
graybox maps build on these numbers.

## 1. System overview

The camera is data-driven (`src/camera/`):

- `profiles.ts` — `CameraProfile` data + the profile catalogue (3 variants per
  context) + the **locked baselines** (`CAMERA_BASELINES`).
- `orbit.ts` — pure, deterministic per-frame math (orbit clamp, recenter grace,
  look-ahead, exponential follow smoothing, obstruction resolution).
- `input.ts` — mouse/touch drag, controller right-stick, recenter trigger.
- `volumes.ts` — authored regions that override the active profile.
- `rig.ts` — `CameraRig`, the Babylon binding that drives an `ArcRotateCamera`
  from a profile using only the pure functions. It holds **no tuning of its
  own**, so retuning is a data edit.

Angle convention: profiles store the **downward view** in degrees (how far below
horizontal the camera looks down at the target). Babylon's `ArcRotateCamera.beta`
is the polar angle from +Y, so `beta = 90° − pitch` (`betaFromPitchDeg`). FOV is
vertical.

## 2. Locked baselines (the camera gate)

One baseline variant is locked per §2-table context — the mid-range `standard`
variant in every case (centre of each band; keeps the full player visible with
HUD-safe framing across the tested aspect ratios; reads as the slightly-elevated
3/4 adventure framing of `sv_style_007_camera_scale_guide.png`). `near` / `far`
remain in the catalogue for retuning and per-moment overrides.

| Context | Downward view | Beta (rad) | Follow dist (m) | Vertical FOV | FOV (rad) | Orbit limit | Recenter (delay s / speed rad·s⁻¹) | Look-ahead (gain / max m) | Follow lag (s) | Obstruction (probe / min / pull / fade) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Exterior exploration | 31° | 1.030 | 9.5 | 47° | 0.820 | ±180° | 2.4 / 1.8 | 0.40 / 3.5 | 0.16 | 0.3 / 1.6 / 24 / 0.5 |
| Farm / precision | 42° | 0.838 | 9.0 | 45° | 0.785 | ±60° | 1.4 / 2.8 | 0.22 / 2.2 | 0.18 | 0.3 / 1.6 / 24 / 0.5 |
| Small interior | 40° | 0.873 | 6.0 | 51° | 0.890 | ±35° | 0.9 / 3.6 | 0.14 / 1.6 | 0.12 | 0.3 / 1.2 / 36 / 0.6 |
| Large public interior | 35° | 0.960 | 8.0 | 48° | 0.838 | ±60° | 1.3 / 3.0 | 0.20 / 2.2 | 0.14 | 0.3 / 1.2 / 36 / 0.6 |
| Cave exploration / combat | 24° | 1.152 | 7.0 | 51° | 0.890 | ±45° | 0.9 / 3.8 | 0.18 / 2.0 | 0.11 | 0.3 / 1.2 / 36 / 0.6 |
| Contextual swim / wade | 29° | 1.065 | 9.0 | 49° | 0.855 | ±70° | 1.6 / 2.6 | 0.34 / 2.8 | 0.16 | 0.3 / 1.6 / 24 / 0.5 |
| Mounted / horseback | 29° | 1.065 | 10.5 | 49° | 0.855 | ±90° | 1.6 / 2.4 | 0.60 / 6.0 | 0.18 | 0.3 / 1.2 / 36 / 0.6 |

Obstruction tuple = `probeRadius(m) / minDistance(m) / pullSpeed(m·s⁻¹) /
fadeThreshold(0..1)`. Source of truth: `CAMERA_PROFILES` in
`src/camera/profiles.ts`; this table mirrors the `standard` rows.

The **mounted / horseback** baseline is locked here against a proving-ground
stand-in (the reference player driven in the `mounted` context): wider, higher
follow with the largest look-ahead gain so the rider can see ahead at gait
speed, and the tighter obstruction recovery for fast travel. Ridden integration
with the real horse body lands in Prompt 044; the corridor showcase is 048.

## 3. Input mapping

| Action | Keyboard / mouse | Controller | Touch |
|---|---|---|---|
| Move (camera-relative) | WASD / arrows | left stick (gameplay) | virtual stick (gameplay) |
| Orbit camera | drag (any mouse button) | right stick | one-finger drag |
| Recenter to rest | `R` | right-stick click / B | recenter button (HUD) |

Orbit is **bounded** per profile (`yawLimitDeg`); after `recenterDelay` seconds
without manual input the offset decays to rest at `recenterSpeed`. Movement is
always camera-relative (§1.1 doctrine). There is no free pitch beyond a small
±0.32 rad manual tilt that also auto-levels on recenter.

## 4. Reduced motion (accessibility — locked policy)

`CameraRig.setReducedMotion(true)` (lab: `M` key; `window.sturdyVolleyLab.
setReducedMotion`) **removes the look-ahead lead and recenter impulses** and uses
conservative blend timing (follow lag floored at 0.28 s, profile transitions at
0.4 s instead of 0.18 s). No camera shake is introduced by the rig. This is the
foundation behaviour; the full accessibility pass (Prompt 070) builds on it.

## 5. Obstruction: fade vs cutaway

When a mesh blocks the camera→target line, the rig pulls the camera in toward the
target (never below `minDistance`) and, inside the `fadeThreshold` band, applies
an occluder treatment:

- **Chosen rule: `fade`.** The blocker's `visibility` ramps `1 → 0` with the
  fade factor. Smoothest in the N64-era register; no hard pop; reads correctly
  for thin walls and railings. This is the locked baseline.
- **Fallback: `cutaway`.** The blocker is hidden outright (`isVisible = false`)
  once it occludes ≥ 50 %. Recorded as the fallback for fully opaque interior
  shells where a half-faded wall would still hide the player. Selectable via
  `CameraRig.setObstructionMode` (lab: `C` key) and authored per camera volume
  in the interior kit (Prompt 036).

Neither mode is allowed to expose a void without a deliberate backing treatment —
enforced when the authored interior volumes land in Prompt 036.

## 6. Telemetry + reproducible routes

- `CameraRig.getState()` reports profile id / context / variant, effective
  downward view, FOV, follow distance, manual yaw offset, occluder fade,
  recentering flag, reduced-motion flag, and obstruction mode.
- Proving ground: `?scene=CameraLab` (production-preview safe) or Title →
  "Dev · Camera Lab". `window.sturdyVolleyLab` exposes the full rig surface
  (`cameraState`, `setContext`, `cycleVariant`, `nudgeYaw`, `recenter`,
  `setReducedMotion`, `setObstructionMode`, `playerScreen`, …).
- `tests/e2e/camera-lab.spec.ts` is the reproducible screenshot route; the
  aspect-ratio framing pass (desktop / tablet / Pixel 5 / ultrawide / tall
  phone) attaches one capture per profile and asserts the full player stays
  inside the HUD-safe frame.

## 7. Decision record — rejected alternatives

- **Babylon `attachControl` orbit** — rejected: cannot enforce the per-profile
  yaw limit or the recenter grace; the rig must own alpha/beta/radius.
- **Per-context bespoke camera classes** — rejected in favour of one data-driven
  rig; the §2 requirement is "tunable purely from profile data".
- **Facing-driven look-ahead** — deferred: the player has no motor/facing until
  Prompt 031, so look-ahead is velocity-driven for now. Revisit when the motor
  lands (the data field stays the same).
- **`near` / `far` as the baseline** — rejected: `standard` sits in the centre of
  every §2 band and framed the full player within HUD-safe margins at all five
  tested aspect ratios; `near` cropped the player on tall-phone, `far` pushed the
  player small on ultrawide.

## 8. Art reference (§1.4)

The locked camera mood matches `sv_style_006_lighting_board.png` and
`sv_style_007_camera_scale_guide.png`: a slightly-elevated 3/4 adventure framing,
atmospheric fog, warm practical light, and a strong foreground player
silhouette. Interior/exterior transitions follow the **OoT-era feel** (§1.1) —
authored doorway/seam handoffs with a deliberate camera handoff — realised when
the interior kit (036) and maps (046+) land.
