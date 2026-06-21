# 2026-06-21 — Prompts 057–059 + CI e2e stability

## Operator

Claude Opus 4.8 (`claude-opus-4-8`), Claude Code harness.

## Working folder

`C:\Users\17076\Documents\Codex\Sturdy Volley Mobile Game` (repo root / trunk).

## Branch

`main` (origin = the Sturdy Volley repo). Every prompt + fix pushed.

## Goal

Continue the gameplay-continuation STS run. The user's directive: *"Commence
Prompt 56"*, then after the parallel session committed 056 mid-flight, *"STS
Prompt 57 onward."* Execute the master roster in order from Prompt 057, verifying /
logging / committing / pushing each prompt. Later the user surfaced a red CI e2e
run twice and asked to stabilize it.

## Actions

- **Prompt 056 (Festivals phase one)** — implemented in full, but committed
  mid-flight by a **parallel agent sharing the trunk checkout** (`6a55ae1` +
  session docs `d4ba66a` + the new CLAUDE.md "one checkout, one agent" rule
  `4150a49`). Verified the committed surface here; did not re-commit.
- **Prompt 057 — Festivals phase two** (`825e771`): Frostlight enriched + Marsh
  Chorus / Lantern Tide / restoration-gated Founders Harvest Fair + year-two
  variants. Availability gating + pure `effectiveFestival`. See DEVLOG.
- **Prompt 058 — Mail, news & world reactivity** (`25b853e`): farm mailbox
  (items/recipes/quests/story) + reactive town notice board. New `mail.ts` /
  `news.ts` engines. The full-suite run caught a real regression (mailbox prop
  hijacked a planting press in `slice-gate`) — fixed by relocating the prop.
- **Prompt 059 — Cooking and buffs** (`0d6c5eb`): food-buff layer + farmhouse
  kitchen; 26 recipes; NPC meal preferences. New `buffs.ts` engine.
- **CI e2e stability** — the suite (~340 tests, ~20-min serial run) went red on
  the desktop-CI SwiftShader runner. First attempt `1a10cfb` (retries 1→2 + 45s
  timeout, the user's choice) did **not** fix it. Diagnosed the real cause:
  Playwright click-**actionability** failures under full-screen canvas load (not a
  regression — green locally + on mobile-CI). Fix `73b2ceb`: drove 5 panel-action
  e2e steps through debug hooks (+ new `swapPetKind` / `dismissDaySummary`),
  keeping the canonical UI-click test.
- Governance: DEVLOG entries per prompt; MASTER_ROSTER §7 + status header; this
  session log + HANDOFF-059; refreshed the "resumes at 054 → 060" pointers in
  CLAUDE.md + MASTER_ROSTER.

## Verify gate

Each prompt passed the full gate before commit: `tsc` (both configs) 0 · `eslint`
0 · Vitest (ending **726 passed** after 059) · `validate:assets` 0 · `build` 0 ·
full Playwright suite (`--retries=2`, exit 0 — desktop + mobile) · GitDoctor
**100/100**. The two CI fixes are config/test-only (tsc · lint · GitDoctor each
green). **Known gap:** the GitHub Actions CI run was red on the heavy panel-click
tests; `73b2ceb` removes that failure mode (24/24 affected specs green locally at
retries:0) but the CI run was **not confirmed green from this machine** — verify
next session.

## Outcome

`handed off` — Prompts 057–059 shipped + pushed; CI fix shipped. Successor goal:
**Prompt 060 (Home, decor & customization)**, and confirm the CI run came back
green. See [HANDOFF-059](../PLANNING/handoffs/HANDOFF-059-2026-06-21.md).

## Open items

- Confirm the GitHub Actions e2e run is green after `73b2ceb`.
- Prompt 060 next (home/decor/customization) — build on the existing
  `placeCrafted` placement + InteriorScene; see HANDOFF-059 §2.
- The skill/fishing/mining/foraging/combat food buffs are aggregated + displayed
  but not yet consumed in their hot paths (movement + stamina are) — a low-risk
  follow-up.
- Festivals/mail/cooking are hosted in the legacy Town/Farm/Interior scenes only;
  the WEF production scenes don't host them yet (parity work).

## Decisions

- **Treated the slice-gate failure as a real regression** (it was — mailbox prop
  in the plot radius) and fixed it; treated the desktop-CI panel-click failures as
  **environment actionability** (verified: panels DOM-stable, green locally +
  mobile-CI) and fixed via debug-driven test steps.
- **Owned a misstep:** initially mis-framed the CI failures as generic flakiness
  and recommended retries+timeout (the user's pick), which couldn't work because
  the click never becomes *actionable*. Corrected the diagnosis on the second red
  run and fixed the root cause.

## Parallel-session notes

A second agent shared this trunk checkout during Prompt 056 (committed `6a55ae1` +
added the CLAUDE.md "one checkout, one agent — parallel work in its own worktree"
hard rule, `4150a49`). After 056, no collision signals appeared — every diff this
session was only files this session authored; staged by explicit path throughout.
