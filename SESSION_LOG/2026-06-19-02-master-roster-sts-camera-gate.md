# 2026-06-19-02 — Master Roster STS: camera + motor + interaction (Prompts 028–034)

> Spans the 2026-06-19 → 2026-06-20 date rollover; one long conversation. Written
> at the 030 handoff point, then the user repeatedly directed the session onward
> (governance fix, Prompt 031, then "keep going for ≥3 more" → 032–034, with a
> full art-direction review interleaved). Updated to cover the whole session.

## Operator
Claude Opus 4.8 (`claude-opus-4-8`), via Claude Code.

## Working folder
`C:\Users\17076\Documents\Codex\Sturdy Volley Mobile Game` (repo root).

## Branch
`main` (origin = the Sturdy Volley repo). Not a repurposed worktree.

## Goal
First STS execution session of the approved
[MASTER_ROSTER.md](../PLANNING/MASTER_ROSTER.md). The user's directive: *"Begin
execution of …PLANNING\MASTER_ROSTER.md"*. Per §0.12 new-session bootstrap, this
session started clean at Prompt 028 (no prior handoff) and ran the World
Embodiment Foundation block prompt-by-prompt with the full §0.2 verify gate per
prompt.

## Actions
- **Bootstrap (§0.12):** confirmed no prior handoff, read the roster + top
  DEVLOG + `git log`, confirmed the §0.11 protected files (`CLAUDE.md`,
  `STURDY_VOLLEY_IMAGE_PROMPT_ROSTER.md`, `STURDY_VOLLEY_PSPR.md`, untracked
  `PLANNING/`) and preserved them unstaged throughout.
- **Pre-step `9bb1200`** — cleared a pre-existing HIGH GitDoctor finding
  (ORI-001: two `tests/unit` descriptions named a franchise) that was blocking
  *every* commit's verify gate.
- **Prompt 028 `455ab7a`** — split `tsconfig.json` into a strict base + game +
  Node/tooling configs (typecheck runs both); stood up `CameraLabScene` with the
  full meter-scale camera/motor test-geometry kit, reachable via Title dev menu +
  `?scene=CameraLab`, with a reproducible screenshot e2e route. GitDoctor PKG-002
  taught to follow `extends`.
- **Prompt 029 `38fbdce`** — added `src/camera/` (data-driven profiles with 3
  variants/context, pure orbit/recenter/look-ahead/obstruction math, input paths,
  volumes, Babylon `CameraRig`); wired into the proving ground with a
  camera-relative movable reference player + live context/variant switching.
- **Prompt 030 `39cd4d0`** — locked one baseline profile per §2 context, wrote
  `docs/GAMEPLAY_CAMERA_AND_CONTROLS.md` (decision record), finalised the
  reduced-motion + fade/cutaway obstruction policy, added telemetry +
  `playerScreen()`, proved HUD-safe framing across 5 aspect ratios. **Closes the
  camera gate (WEF-01).**
- **Governance `752e04e`** — after the user clarified that **STS = push every
  prompt** ("I say STS? That means send it stem to stern"), rewrote
  MASTER_ROSTER §0.5 (STS authorization IS push authorization), updated the
  `feedback_sts_push_every_prompt` memory's reconciliation note, started tracking
  `PLANNING/`, committed the pending plan-activation edits (CLAUDE.md pointer,
  PSPR banner, image-prompt roster) + this session log, and **pushed the whole
  backlog** (`caf8bd1..752e04e`).
- **Prompt 031 `ddc79c3`** — integrated **Havok inside Babylon.js**
  (`@babylonjs/havok` 1.3.12 vs core 7.54.3) behind a narrow `MotorPhysics` port
  with a ray-pick fallback; pure kinematic capsule motor core
  (`src/engine/motor.ts`); replaced the proving-ground proxy driver with the real
  motor (stamina/gait from the existing controller). Havok confirmed loading in
  the headless preview. Fixed a `Vector3`-spread NaN bug. Pushed
  (`752e04e..ddc79c3`).
- **Prompt 032 `a9d8398`** — motor terrain handling (slope limit + slide,
  step-up/stairs, wall collide-and-slide, low-ceiling clamp, moving-platform
  carry, penetration + out-of-bounds recovery); `stepMotor` now consumes a
  `MotorEnvironment`; Havok box colliders on the kit terrain. Pushed.
- **Art-direction review** — assessed all **79** images in
  `art-production/current-direction` (A style bible → F NPCs + WIP) at the user's
  instruction. User locked **Market Lane `sv_env_043`/`044`** as the town-gameplay
  north-star (memory `project_town_marketlane_northstar`).
- **Prompt 033 `343a6f7`** — water (wade/swim, depth-driven), authored traversal
  links (no free jump, cancellable, camera-continuous), `groundedPoseAt`
  save/region recovery; stamina/gait feed the motor through every medium. Pushed.
- **Prompt 034 `c531180`** — shared interaction resolver
  (`src/engine/interaction-targeting.ts`): scoring (priority/facing/distance/reach
  /tool/obstruction/hysteresis) + facing alignment + anticipation→impact→recovery
  action lifecycle; proving-ground focus ring + one-button commit; input-agnostic.
  Pushed.
- Batons: `HANDOFF-030`, `HANDOFF-031`, `HANDOFF-034-2026-06-20.md` (this
  close-out → Prompt 035).

## Verify gate
Run per prompt; last commit (`c531180`, Prompt 034): `tsc -p tsconfig.json` 0 ·
`tsc -p tsconfig.node.json` 0 · `eslint .` 0 · Vitest **401 passed** · Playwright
**149 passed + 1 skipped** (desktop-only aspect sweep) on desktop-chromium +
mobile-chromium · `validate:assets` 0 · `build` 0 · GitDoctor **100/100**
(`--fail-on high` exit 0). No waivers. (Prior gates: 031 vitest 373 / pw 131+1;
032 vitest 381 / pw 139+1; 033 vitest 388 / pw 145+1.)

## Outcome
`handed off` — successor session resumes STS at **Prompt 035 (Exterior topology,
chunks, streaming, coordinate frames, WEF-04)**: the exterior world container +
`docs/WORLD_TOPOLOGY_AND_STREAMING.md`, accounting for horse-speed traversal + the
Willa Crick ↔ Ballast Bay river transition. WEF-01 (camera), WEF-02 (motor), and
WEF-03 (interaction) are complete.

## Open items
- **Push policy: RESOLVED.** STS = push every prompt; all work pushed through
  `c531180`.
- Market Lane (`sv_env_043`/`044`) is the locked town north-star — load-bearing
  for Prompt 047 + festivals + shops; don't drift.
- `npm run build` emits a Babylon chunk-size > 4000 kB warning (now larger with
  the Havok WASM asset); not a gate failure — relevant to the mobile/PWA prompt
  (068).

## Decisions
- Baseline = `standard` variant per context; `fade` chosen / `cutaway` fallback
  for occluders; rig holds no tuning. (`docs/GAMEPLAY_CAMERA_AND_CONTROLS.md`.)
- **Havok runs inside Babylon.js** as its physics plugin (user-confirmed); it's
  the primary backend, ray-pick is a safety-net fallback.
  (`docs/GAMEPLAY_MOTOR.md`.)
- Motor core stays pure (`{x,y,z}`), physics isolated behind the `MotorPhysics`
  port — so the core unit-tests in jsdom and Havok/ray-pick are swappable.
