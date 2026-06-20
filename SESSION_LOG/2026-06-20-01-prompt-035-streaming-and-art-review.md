# 2026-06-20 · Prompt 035 (WEF-04 streaming) + full art-direction review

## Operator

Claude Opus 4.8 (`claude-opus-4-8`), Claude Code harness.

## Working folder

`C:\Users\17076\Documents\Codex\Sturdy Volley Mobile Game` (repo root).

## Branch

`main` (origin `https://github.com/USS-Parks/Sturdy_Volley.git`).

## Goal

User directive: *"Proceed to STS this P-SPR, continuing at Prompt 35 … But FIRST,
before Proceeding with STS from Prompt 35, assess ALL current art direction files
in its entirety: art-production/current-direction"*. So: review the entire
current art-direction library first, then resume Stem-to-Stern execution of
`PLANNING/MASTER_ROSTER.md` at Prompt 035.

## Actions

- **Reviewed all 96 reference images** in `art-production/current-direction`
  (A global style bible · B world maps · C farm variants · D biome key art ·
  E player customization · F NPC references · work-in-progress drafts). Confirmed
  the locked direction: faceted N64/OoT-era low-poly + hand-painted low-res
  texture readability; Town Market Lane (`sv_env_043/044`) north-star; the
  `work-in-progress/*painterly-drift*` variants are the cautionary over-render;
  `sv_map_020-draft` still carries a (superseded) volleyball court.
- **Shipped Prompt 035 — Exterior topology, chunks, streaming, coordinate frames
  (WEF-04)** — commit `2c7c8a6`, pushed. New pure modules `src/world/topology.ts`,
  `src/world/streaming.ts`, `src/world/variants.ts`; integration scene
  `src/scenes/StreamingLabScene.ts` (`?scene=StreamingLab`); `?debug=streaming`
  overlay `src/render/streaming-overlay.ts`; doc
  `docs/WORLD_TOPOLOGY_AND_STREAMING.md`; three unit specs + one e2e spec; dev
  wiring in `registry.ts` / `dev-route.ts` / `TitleScene.ts` / `styles.css`. See
  the [DEVLOG Prompt 035 entry](../DEVLOG.md) for the full breakdown + decision
  record.
- Wrote `PLANNING/handoffs/HANDOFF-035-2026-06-20.md` (forward baton; next =
  Prompt 036, interior kit + camera volumes).

## Verify gate

All green on `2c7c8a6`: `tsc -p tsconfig.json` 0 · `tsc -p tsconfig.node.json` 0
· `eslint .` 0 · Vitest **433 passed** (+32) · Playwright **167 passed + 1
skipped** (desktop-only aspect sweep) on `desktop-chromium` + `mobile-chromium`
(+18) · `validate:assets` 0 · `build` 0 · GitDoctor **100/100**.

## Outcome

`handed off` — one prompt (035) shipped; stopped at the prompt boundary per
§0.12 (the full art review consumed substantial context). Successor session
resumes STS at **Prompt 036 — Interior construction kit + authored camera
volumes (WEF-05)**.

## Open items

- Resume STS at Prompt 036 (see HANDOFF-035 §2 for the reuse map + art refs).
- **§0.11 watch:** `PLANNING/WORLD_EMBODIMENT_FOUNDATION_PSPR.md` has an unstaged
  pre-existing user edit (banner reverted "SUPERSEDED" → "DRAFT — NOT APPROVED"),
  preserved untouched. It's in tension with `MASTER_ROSTER.md` treating that file
  as superseded; confirm with the user before acting if it matters.

## Decisions

- Stopped after one prompt rather than packing 036, because the full 96-image art
  assessment plus the 035 implementation + two full test-suite runs consumed
  enough context that starting another full foundation prompt risked crossing the
  §0.12 two-thirds ceiling mid-prompt (forbidden — cut at boundaries only).
- Streaming design calls captured in the DEVLOG decision record (chunk size 32 m
  derivation; look-ahead as a forward chunk field; `setRegion` clears records;
  floating origin per region).
