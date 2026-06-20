# 2026-06-19-02 — Master Roster STS: camera gate (Prompts 028–030)

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
- Wrote the forward baton `PLANNING/handoffs/HANDOFF-030-2026-06-19.md`.

## Verify gate
Run per prompt; last commit (`39cd4d0`): `tsc -p tsconfig.json` 0 ·
`tsc -p tsconfig.node.json` 0 · `eslint .` 0 · Vitest **364 passed** · Playwright
**127 passed + 1 skipped** (desktop-only aspect sweep) on desktop-chromium +
mobile-chromium · `validate:assets` 0 · `build` 0 · GitDoctor **100/100**
(`--fail-on high` exit 0). No waivers.

## Outcome
`handed off` — successor session resumes STS at **Prompt 031 (Havok adapter +
kinematic capsule motor core, WEF-02a)**, a §0.12 session-heavy prompt that
starts fresh.

## Open items
- **Push policy needs a user word.** Recalled memory `feedback_sts_push_every_prompt`
  (push every prompt) conflicts with MASTER_ROSTER §0.5 (push only when asked;
  never volunteer). Followed §0.5 — **nothing pushed.** Four commits sit local on
  `main`. If push-per-prompt is still wanted, say so and the stale memory should
  be updated.
- Prompt 031 must verify Babylon/Havok APIs against the pinned package and add
  `@babylonjs/havok`; it replaces the lab's proxy planar player driver with the
  real motor (keep `playerVel`/`FollowTarget` wired for camera look-ahead).
- This session log + the handoff file are written but **uncommitted** (per
  SESSION_LOG/README: committing is the user's call or on explicit instruction).

## Decisions
- Baseline = `standard` variant per context; `fade` chosen / `cutaway` fallback
  for occluders; rig holds no tuning (retune via profile data). Full rationale in
  `docs/GAMEPLAY_CAMERA_AND_CONTROLS.md` and the Prompt 030 DEVLOG entry.
