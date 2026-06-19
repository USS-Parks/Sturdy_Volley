# Sturdy Volley — Claude Code Instructions

## What This Is
**Sturdy Volley** is an original, browser-first **cozy life sim** set in **Ballast Bay** on the Sturdy Coast — farm, fish, craft, mine, forage, cook, befriend a living town, and rebuild a storm-worn harbor. Original work; only genre-level ideas are borrowed from the cozy life-sim space. Visual direction is **Theme 3 — original N64-era low-poly 3D adventure**.

The canonical plan is [`STURDY_VOLLEY_PSPR.md`](./STURDY_VOLLEY_PSPR.md). Read its **§0 (Execution Rules)** before any change, and **§8** (the prompt roster) when working on a specific prompt. Build progress is recorded prompt-by-prompt in [`DEVLOG.md`](./DEVLOG.md).

## Tech Stack
Babylon.js 7 · TypeScript · Vite 6 · Vitest 3 (jsdom) · Playwright · ESLint 9 (flat config) · Zod · Node ≥24. See [`README.md`](./README.md) for the user-facing summary and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) + [`docs/SCALE_AND_PERFORMANCE.md`](./docs/SCALE_AND_PERFORMANCE.md) for implementation conventions.

## Build & Run
```bash
npm install
npx playwright install chromium   # one-time, for e2e

npm run dev                       # http://localhost:5173
npm run typecheck                 # tsc --noEmit
npm run lint                      # ESLint
npm test                          # Vitest (unit)
npm run test:e2e                  # Playwright (desktop + mobile)
npm run validate:assets           # validates runtime .glb assets
npm run build                     # tsc --noEmit then vite build → dist/
npm run preview                   # preview the production build
```

## Execution rules (load-bearing)
All execution-time rules — the per-prompt verify gate, the `DEVLOG.md` entry format, commit discipline, push policy, originality, Theme 3 visual rules, vertical-slice-first integration, representative graybox responsibility — are defined in [`STURDY_VOLLEY_PSPR.md`](./STURDY_VOLLEY_PSPR.md) §0 and binding for every session. Highlights:

- **Verify gate (§0.2)** — `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run validate:assets`, `npm run build`, plus `npm run test:e2e` for any prompt touching covered behavior. All must exit 0 before the prompt is marked complete and committed. Never bypass with `--no-verify` or sandbox-disable shortcuts.
- **DEVLOG entry (§0.3)** — every completed prompt gets a new `## Prompt NNN — <title> (YYYY-MM-DD)` section at the top of [`DEVLOG.md`](./DEVLOG.md) with what shipped, files touched, acceptance criteria, and verify-gate result.
- **Commit discipline (§0.4)** — one commit per prompt. Subject `Prompt NNN: …` (or `VS-AX:` / `RF-NN:` / `Theme 3 Prompt AXX:`). Body cites the verify-gate result. Never amend pushed commits. Never skip hooks. Stage by path; avoid `git add -A`.
- **Push policy (§0.5)** — push only when the user explicitly asks ("push", "ship it", "to the repo"). One ask covers the work in scope at that moment. Never force-push to `main` without explicit instruction.
- **Plan before non-trivial work (§0.6)** — for changes that span multiple prompts, multiple subsystems, or new architecture, draft a tightened plan and wait for explicit user approval before writing code.
- **Originality (§0.7)** — no copying of other games' code, sprites, audio, dialogue, maps, names, or layouts. Theme 3 visuals must evoke N64-era constraints without copying any franchise. All names are original to Ballast Bay.
- **Vertical slice first; integrate every prompt (§0.8 + §0.9)** — a prompt is not complete until its behavior is visible in the running game and verified by Playwright (or by an explicit named manual check). Pure modules require the same-commit scene wiring that exercises them.

## Session log (load-bearing)

Every session writes one entry in [`SESSION_LOG/`](./SESSION_LOG/) at session end (or at the user's explicit "log this session" cue). The format spec and required sections live in [`SESSION_LOG/README.md`](./SESSION_LOG/README.md).

The session log exists for audit — if a future session, the user, or a reviewer needs to know what happened in a prior conversation, what was shipped, what was attempted but abandoned, or what's still open, the answer is there. It's one level up from `DEVLOG.md`: one entry per **conversation**, regardless of how many (or how few) prompts were touched.

Treat it as you would any DEVLOG.md entry — no skipping, no batching across sessions. Filename convention: `YYYY-MM-DD-NN-short-title.md`. Required sections are spec'd in the README.

## Parallel sessions

This project is sometimes worked in parallel from a sibling worktree under `.claude/worktrees/`. The worktree's filesystem may or may not be a Sturdy Volley git checkout — the user occasionally repurposes worktree paths from other projects as Sturdy Volley working folders. Don't assume the worktree's `git remote` matches the trunk; always verify.

Common merge-hotspot files (rebase often, fence edits, prefer additive changes near these):
- `DEVLOG.md`
- `STURDY_VOLLEY_PSPR.md`
- `STURDY_VOLLEY_IMAGE_PROMPT_ROSTER.md`
- root `*.md` rosters and this `CLAUDE.md`
- `src/main.ts`, `src/scenes/SceneManager.ts`

When in doubt, read the most recent `DEVLOG.md` entries and run `git log --oneline -20` on `main` before starting a prompt, to see what the other session has already landed.
