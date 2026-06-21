# 2026-06-21 — Prompt 056: Festivals phase one

## Operator

Claude Opus 4.8 (`claude-opus-4-8`), Claude Code harness.

## Working folder

`C:\Users\17076\Documents\Codex\Sturdy Volley Mobile Game` (repo root).

## Branch

`main` (origin = the Sturdy Volley repo).

## Goal

Execute **Prompt 056 — Festivals phase one (legacy 030)** from
[`PLANNING/MASTER_ROSTER.md`](../PLANNING/MASTER_ROSTER.md) §6.2 under the live STS
run. The user's directive: *"Commence Prompt 56 please"* (with the master roster +
[HANDOFF-053](../PLANNING/handoffs/HANDOFF-053-2026-06-21.md)). Build the seasonal
festival framework + the three phase-one festivals (Spring Seed Blessing, Summer
Glowtide Night, Fall Harvest Fair) so festival days alter schedules/shops/map
setup/music, each festival has a non-sport minigame + special shop + relationship
opportunity, and multiplayer hooks are considered.

## Actions

- Upgraded `festivalSchema` (`src/data/schemas.ts`) from a 5-field stub to a rich,
  backward-compatible model (window/music/venue + nullable minigame/stall/
  relationship), relocated below `questRewardSchema` so it reuses it.
- Enriched `src/data/content/festivals.json` (the phase-one trio) and added festival
  reference validation to `content.ts` `checkReferences`.
- New pure engine `src/engine/festival.ts` (detection, deterministic seed-driven
  minigame state machine, once-per-year reward gating) + runtime glue
  `src/engine/festival-tracking.ts`; extracted shared reward summaries to
  `src/engine/rewards.ts`. Added a defaulted `festivals` record to
  `src/engine/saveModel.ts` (no `SAVE_VERSION` bump).
- New overlay panels `showFestivalPanel` + `showFestivalMinigame`
  (`src/ui/overlay.ts`) + styles; `playFestivalChime` in `src/audio/cues.ts`.
- `src/scenes/TownScene.ts` festival hosting: dressing meshes, `scheduleContext`
  festivalId wiring, festival-day shop closure, festival-stage interaction target,
  festival cue/attendance on enter, debug API. `byFestival` schedule layers added to
  `schedules.json`; `main.ts` schedule-overlay festivalId wired.
- Tests: new `tests/unit/festival.test.ts` + `tests/e2e/festival.spec.ts`; festival
  cases added to `overlay.test.ts` / `content.test.ts`; fixed a `Festival` literal
  in `dayResolution.test.ts` to parse through the schema.
- DEVLOG entry, MASTER_ROSTER §7 checkbox, this session log + HANDOFF-056.
- Commit `Prompt 056: festivals phase one (legacy 030)` (subject), pushed to `main`.

## Verify gate

`tsc -p tsconfig.json` 0 · `tsc -p tsconfig.node.json` 0 · `eslint .` 0 · Vitest
**679 passed** (+23) · `validate:assets` 0 · `build` 0 · Playwright: the festival
suite passes **10/10** on `desktop-chromium` + `mobile-chromium`. The full serial
suite (318 tests, 1 worker, ~14 min) exhibits **load-induced flakiness** — a
rotating ~5–6% subset (nav-lab / klamity / npc / inventory / interior / animals,
none festival-related) intermittently times out; **all pass deterministically when
re-run per-file** (the 19 that flaked in one run passed 46/46 on isolated re-run).
GitDoctor **100/100**.

## Outcome

`completed` — Prompt 056 shipped, all acceptance criteria met, committed + pushed.

## Open items

- Prompt 057 (Festivals phase two) enriches Frostlight + adds Lantern Tide / Marsh
  Chorus / the restoration-gated Founders Harvest Fair + year-two variants — see
  [HANDOFF-056](../PLANNING/handoffs/HANDOFF-056-2026-06-21.md) §2 for the exact
  extension points (flag-gating + per-year override don't exist yet).
- Festivals are hosted in the legacy `TownScene` only; `BallastBayTownScene` does
  not host them yet.
- Festival "music" is a single cue; the music manager is Prompt 061.

## Decisions

- **Whole-day festival, window as flavor** — festival-day behaviors key off the
  date, not the clock window, keeping the e2e clock-independent. (Window drives the
  "happening now" HUD note only.)
- **Multiplayer hook = a pure, seed-driven, serializable minigame** seeded from the
  festival id + absolute day, so a future networked layer can replay/share a run
  unchanged. Documented in `festival.ts`, not bolted on.
- **Treated the full-suite e2e flakiness as load-induced, not a regression**, after
  every flaked spec passed green on isolated re-run (46/46) and the flaked specs
  have no festival code paths.
