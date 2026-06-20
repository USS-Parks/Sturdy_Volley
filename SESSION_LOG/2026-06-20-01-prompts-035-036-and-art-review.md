# 2026-06-20 · Prompts 035 (WEF-04 streaming) + 036 (WEF-05 interior kit) + full art-direction review

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
- **Shipped Prompt 036 — Interior construction kit + authored camera volumes
  (WEF-05)** — commit `42468fd`, pushed (after the user said "STS from here").
  New pure metric kit `src/world/interior-kit.ts` (`INTERIOR_METRICS` + `RoomSpec`
  + `validateRoomSpec` + `wallSpans`), graybox builder
  `src/render/interior-builder.ts` (closed-shell rooms + volume + anchors),
  proving ground `src/scenes/InteriorLabScene.ts` (`?scene=InteriorLab`, five
  archetypes), doc `docs/INTERIOR_KIT_AND_CAMERA_VOLUMES.md`; extended the camera
  volume model (`src/camera/volumes.ts`: `pickVolumeSticky` + obstruction/blend/
  fallback fields) and rig (`src/camera/rig.ts`: target-offset, per-volume
  obstruction override, effective `activeProfile`, `activeVolumeId`); two unit
  specs + one e2e spec. See the [DEVLOG Prompt 036 entry](../DEVLOG.md). Caught +
  fixed a shared-rig `getState` regression (seed `activeProfile` in `setProfile`).
- Wrote forward batons `HANDOFF-035` (035) and `HANDOFF-036` (036, next =
  Prompt 037 map metric kit + schemas).

## Verify gate

035 on `2c7c8a6`: Vitest **433 passed**, Playwright **167 + 1 skipped**, both
tsc/lint/validate/build 0, GitDoctor 100/100. 036 on `42468fd`: `tsc` node+web 0
· `eslint .` 0 · Vitest **452 passed** (+19) · Playwright **181 passed + 1
skipped** (desktop-only aspect sweep) on `desktop-chromium` + `mobile-chromium`
(+18 interior-lab) · `validate:assets` 0 · `build` 0 · GitDoctor **100/100**.

## Outcome

`handed off` — two prompts (035 + 036) shipped this session; stopped at the
036 prompt boundary per §0.12 (the full 96-image art review + two heavy
foundation prompts + multiple full-suite runs consumed enough context that
starting Prompt 037 risked crossing the two-thirds ceiling mid-prompt). Successor
session resumes STS at **Prompt 037 — Map metric kit + map schemas (WEF-06a)**.

## Open items

- Resume STS at Prompt 037 (see HANDOFF-036 §2 for the reuse map — Zod schemas,
  likely no new scene; lighter than 035/036).
- **§0.11 watch:** `PLANNING/WORLD_EMBODIMENT_FOUNDATION_PSPR.md` has an unstaged
  pre-existing user edit (banner reverted "SUPERSEDED" → "DRAFT — NOT APPROVED"),
  preserved untouched across 035 + 036. In tension with `MASTER_ROSTER.md`
  treating that file as superseded; confirm with the user before acting if it
  matters.

## Decisions

- Cut at the 036 boundary (not mid-037) per §0.12: the user's "STS from here"
  waives permission-pauses, not the budget protocol, which mandates cutting at a
  prompt boundary when the next prompt can't safely finish in remaining headroom.
- Streaming (035): chunk size 32 m derivation; look-ahead as a forward chunk
  field; `setRegion` clears records; floating origin per region.
- Interior kit (036): doorway/corridor/furniture thresholds kept distinct
  (1.0 / 1.4 / 0.8 m); closed shell IS the backing treatment (ray-tested, not
  assumed); sticky volume selection uses exit-hysteresis; rig reports the
  effective active profile. Full decision records in the DEVLOG.
