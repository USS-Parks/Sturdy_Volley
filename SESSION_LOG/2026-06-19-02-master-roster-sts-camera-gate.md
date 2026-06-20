# 2026-06-19-02 — Master Roster STS: camera gate + motor core (Prompts 028–031)

> Spans the 2026-06-19 → 2026-06-20 date rollover; one conversation. The entry
> was first written at the 030 handoff point, then the user directed the session
> to continue (governance fix + Prompt 031). Updated to cover the full session.

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
- Batons: `PLANNING/handoffs/HANDOFF-030-2026-06-19.md` (camera gate) +
  `PLANNING/handoffs/HANDOFF-031-2026-06-20.md` (this close-out).

## Verify gate
Run per prompt; last commit (`ddc79c3`, Prompt 031): `tsc -p tsconfig.json` 0 ·
`tsc -p tsconfig.node.json` 0 · `eslint .` 0 · Vitest **373 passed** · Playwright
**131 passed + 1 skipped** (desktop-only aspect sweep) on desktop-chromium +
mobile-chromium · `validate:assets` 0 · `build` 0 · GitDoctor **100/100**
(`--fail-on high` exit 0). No waivers. (Camera gate 030 commit `39cd4d0`: vitest
364 / playwright 127+1.)

## Outcome
`handed off` — successor session resumes STS at **Prompt 032 (Motor terrain
handling + recovery, WEF-02b)**: slope limit, sliding, step offset, stairs,
low-ceiling, pushing, penetration + out-of-bounds recovery, built on the 031
motor + Havok port.

## Open items
- **Push policy: RESOLVED.** STS = push every prompt is now locked in
  MASTER_ROSTER §0.5 + the memory. All work pushed to `main` through `ddc79c3`.
- Prompt 032 adds the Havok shape-sweep collide-and-slide + per-obstacle
  colliders (031 grounds on the flat plane only); slope/stairs/step stations in
  the proving ground are ready to exercise it.
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
