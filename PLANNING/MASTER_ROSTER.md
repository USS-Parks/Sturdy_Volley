# Sturdy Volley — Master Roster (Unified P-SPR)

Prepared: 2026-06-19
Status: **APPROVED 2026-06-19 — this is the active P-SPR. STS in progress.** The **WEF foundation block
(Prompts 028–053) is COMPLETE** (closed 2026-06-21, WEF-13); gameplay continuation resumes at **Prompt
054**. Per-prompt commit SHAs + verify gates are in `DEVLOG.md`.
Supersedes (now active): the standalone `PLANNING/WORLD_EMBODIMENT_FOUNDATION_PSPR.md` draft and the
roster halves of `STURDY_VOLLEY_PSPR.md`. Both remain valid **historical + product** references.
Target: browser-first, mobile-ready, controller-friendly low-poly 3D cozy life sim (Theme 3).

## What this file is

This is the single, continuously numbered path to project completion. It folds the **World
Embodiment Foundation (WEF)** re-platforming phase — split into bite-size prompts — into the same
roster as the remaining legacy gameplay/content prompts, so there is one source of truth for "what
is next" all the way to a release candidate.

- **Prompts 001–027** are already shipped (the legacy vertical slice + gameplay foundation).
- **Prompts 028–053** are the WEF foundation block: camera, kinematic motor, interaction, streaming,
  interiors, the metric kit + atlas, navigation, fauna, **horseback/mount system**, flora, five
  production-foundation graybox maps, the asset/rig pipeline, the performance/accessibility gate, and
  migration.
- **Prompts 054–076** are the legacy gameplay continuation (old Prompts 028–050), renumbered to run
  on top of the new foundation, with reconciliation notes where WEF changes what they must build.

Project completes at **Prompt 076**. Total: **76 prompts**, **27 done**, **49 remaining**.

The **§1.4 artistic direction is load-bearing**: the N64 / Ocarina-of-Time-era stylization captured in
`art-production/` is a hard constraint on every graybox proportion, material, camera mood, and asset
budget — honored from the first primitive, not deferred to an art pass.

---

## 0. Execution rules (strict, load-bearing)

These govern every prompt below. Where they conflict with any other document, these win and the other
document is updated to match. They are carried forward from `STURDY_VOLLEY_PSPR.md` §0 and
`WORLD_EMBODIMENT_FOUNDATION_PSPR.md` §0, harmonized, plus the new §0.12 session protocol.

### 0.1 Canonical shorthand

- **P-SPR = Plan - Sequential Prompt Roster.** This file is the active P-SPR once approved.
- **STS = Stem to Stern.** After explicit user approval, execute the roster in order from the first
  incomplete prompt through phase wrap — verifying, logging, committing, and (when asked) pushing each
  prompt as specified. Do not skip prompts, batch their commits, push early, or reopen a decision that
  has passed its named gate unless implementation reveals a genuinely new blocking fact. A plan's own
  "STS authorization" wording is not approval by itself.
- **Acceptance criteria** are the bulleted checks under each prompt. They are that prompt's contract.

### 0.2 Verify gate (per prompt)

Every prompt must pass all applicable checks before it is marked complete and committed:

1. **Both** strict TypeScript configurations exit 0. Prompt 028 establishes the game vs. Node/tooling
   split and a single command running both without weakening existing strictness; from 028 onward the
   gate runs both.
2. `npm run lint` exits 0.
3. `npm test` (Vitest) passes — every test, no new skips beyond the pre-existing skip-list.
4. `npm run validate:assets` exits 0.
5. `npm run build` exits 0 and produces `dist/`.
6. Relevant Playwright coverage passes on **both** `desktop-chromium` and `mobile-chromium`. Prompts
   touching shared navigation or scene lifecycle run the full E2E suite.
7. `python tools/local_gitdoctor_scan.py --fail-on high` exits 0. HIGH/CRITICAL block the commit;
   MEDIUM/LOW are advisory. False positives are closed with evidence in the DEVLOG/commit body, never
   silently ignored.
8. Visual prompts capture reproducible desktop and Pixel 5 evidence for their named profiles. Evidence
   shows the player, the relevant obstruction/interaction, the HUD safe area, and the active debug
   profile.
9. No prompt relaxes an existing performance budget, test assertion, type rule, or accessibility
   requirement merely to pass.

When physics/behavior cannot be asserted reliably through pixels, add **deterministic debug telemetry**
and test that contract. Manual-only checks are permitted only when automation is genuinely impractical;
the DEVLOG must then name the check, device, result, and why automation was not used.

A failed gate keeps the prompt open. Diagnose the root cause; never bypass with `--no-verify`, skip
flags, or sandbox-disable shortcuts.

### 0.3 DEVLOG discipline (per prompt)

Each completed prompt adds a new section at the **top** of `DEVLOG.md`:

`## Prompt NNN — <title> (<WEF-tag if applicable>) (YYYY-MM-DD)`

Each entry contains:

- one short shipped-result paragraph;
- the exact modules, scenes, data, documents, and tests touched (paths + key APIs);
- an **Acceptance criteria** subsection with one `- [x]`/`- [ ]` line per criterion (partial criteria
  enumerate the remainder under "Remaining for a later pass");
- a **Decision record** subsection for locked measurements and rejected alternatives (foundation
  prompts especially);
- a **Verify gate** line: both TypeScript checks · lint · Vitest count · Playwright count/projects ·
  asset validation · build · GitDoctor result;
- visual/manual evidence notes where required;
- any approved budget waiver, with owner and recovery prompt.

DEVLOG history is append-only except for typo/broken-link corrections.

### 0.4 Commit discipline

- **One commit per prompt**, after its green gate (§0.2) and DEVLOG entry (§0.3).
- Commit subject: `Prompt NNN: <short summary>`. Body cites the verify-gate result and, for foundation
  prompts, the originating WEF tag.
- Mid-prompt safety commits are allowed on a working branch and squashed before the final commit lands
  on `main`.
- Stage files explicitly by path. **Never** `git add -A` / `git add .`.
- Never amend an already-pushed commit. Never skip hooks (`--no-verify`) or bypass signing.

### 0.5 Push policy

- **STS authorization is push authorization.** Once the user says STS (or "begin execution of this
  roster", or any equivalent run-it directive), every prompt's commit is followed by
  `git push origin main` — push-per-prompt, not just at session end. The STS directive itself is the
  standing review-and-push approval for the whole run; do **not** pause to re-ask before each push, and
  do **not** treat the absence of the literal word "push" as a reason to hold. Locked by the user
  2026-06-20; matches the `feedback_sts_push_every_prompt` memory.
- Outside an STS run (one-off edits, exploratory work), push only when the user explicitly asks.
- Never `git push --force` to `main` without an explicit force-push instruction. If a push fails for
  infrastructure reasons, surface it and stop — do not retry blindly or force.

### 0.6 Plan before non-trivial work

For any change spanning multiple prompts, multiple subsystems, or new architecture: draft a tightened
plan (inline or as a new `PLANNING/*.md`) and wait for explicit approval before writing code. Trivial
one-offs (single edits, questions, memory saves, explicit single-command asks) are exempt.

### 0.7 Originality

No copying of any other game's code, sprites, audio, dialogue, maps, names, symbols, layouts, camera
scripts, or visual identity. Theme 3 evokes N64-era constraints without copying any franchise. All
names are original to Ballast Bay. The game may learn from the *physical presence* of older 3D
adventures but never their content.

**Ocarina of Time — feel, not source (hard rule).** Mirroring OoT-era *feel* (§1.1) never licenses
copying OoT. The community decompilation **`zeldaret/oot`** and PC ports built on it (e.g. Ship of
Harkinian / **`HarbourMasters/Shipwright`**) are **not** copy sources: the decompiled C is Nintendo's
reverse-engineered IP (there is no official open-source release), it is legally contested, and its
assets are unambiguously copyrighted. We mirror only the **observable feel** — camera framing, transition
cadence, control mapping, mount feel — derived from playing the game and public design analysis, and we
express it in our own original code and data. **Do not read, import, transcribe, or paraphrase
decomp/port source into this project.** Engine implementation (camera, motor, navigation, mount) is built
from neutral first-party sources (Babylon.js / Havok docs, general game-dev technique). Any personal
study of the decomp stays firewalled from implementation (clean-room discipline).

### 0.8 Integration is mandatory (every prompt is visible)

A prompt is not complete until its behavior is **visible in the running game** and verified by
Playwright (or by an explicit, named in-game manual check the DEVLOG records).

- A pure module is acceptable only when paired in the same commit with the scene wiring + interaction
  surface that exercises it. "(core) — renderer wave pending" is not an acceptable state.
- A prompt introducing a new entity ships its representative graybox mesh + an interaction surface in
  the same commit (§0.9).
- A prompt shipping a new system ships at least one visible in-game consumer of it in the same commit.

### 0.9 Representative graybox geometry is Claude's responsibility

Claude owns representative graybox geometry for every entity introduced.

- Babylon primitives (`MeshBuilder.Create*`) + the existing `flatMaterial`/`PALETTE` helpers. No
  imported assets at the graybox stage.
- Honor `docs/SCALE_AND_PERFORMANCE.md` scale conventions (1 unit = 1 m; player capsule 1.8 m; farm
  cell 1 m²; walls 3–4 m; doorways ≥ 1 m × 1.8 m).
- Group primitive-construction in one scene helper per entity class so a future `.glb` swap is a
  one-line edit. **Graybox built in WEF is a production spatial foundation, not a disposable mockup**
  (§1.3): finished art replaces visible meshes without changing approved metrics, anchors, collision,
  navigation, or camera intent.
- Graybox proportions, silhouettes, and material call-outs follow the **§1.4 artistic direction** and
  the shape-language + camera-scale boards in `art-production/` from the first primitive. The OoT-era
  reference is honored at graybox time, not deferred to a later art pass.

### 0.10 Production art follows feature demand

Real `.glb` assets are created only when a working, graybox-integrated, Playwright-verifiable feature
needs them. A commission (a) names the graybox mesh it replaces, (b) lists the scale/perf constraints
it must respect, and (c) is reversible — the graybox stays as a fallback until the new asset ships.

### 0.11 Worktree and existing-change safety

- The planning inspection found pre-existing uncommitted user changes (currently
  `STURDY_VOLLEY_IMAGE_PROMPT_ROSTER.md`, and any others present at session start). They belong to the
  user and are out of scope. Every prompt preserves them, stages explicit paths only, and stops for the
  user if an unavoidable overlap appears. Do not stash, revert, reformat, or commit them.
- This plan is sequential by default and does **not** authorize parallel implementation. If parallel
  tracks are later authorized, each track uses its own Git worktree (per the project's worktree rule).

### 0.12 Session & context-budget protocol (NEW)

The available session context is large (~1M tokens), but **no session fills past two-thirds (~666K
tokens) before handing off.** This keeps reasoning sharp and leaves headroom for the verify gate.

**Cadence — pack until 2/3, then hand off.**

- Run consecutive prompts in one session until context approaches the ~666K ceiling, then cut at the
  **next prompt boundary** (never mid-prompt) and hand off.
- Watch the budget actively. If the next prompt plausibly cannot finish (implementation + full verify
  gate + DEVLOG + commit) inside the remaining headroom, stop now and hand off instead of starting it.
- The heaviest foundation prompts — **031** (motor core), **038** (atlas + all region sheets), and
  **046 / 047 / 048 / 049** (the production-foundation maps) — will typically consume a whole session
  each. That is expected; do not pack them. **044** (mount system) and **052** (foundation gate) are
  also session-heavy.

**Handoff file (written at every session end, before the session log).**

Path: `PLANNING/handoffs/HANDOFF-<lastDoneNNN>-<YYYY-MM-DD>.md`. Contents:

1. Last completed prompt number + title + its commit SHA.
2. The exact next prompt to start, and any setup it expects.
3. Locked decisions made this session (measurements, rejected alternatives) — so the next session does
   not reopen them.
4. Open threads, risks, and any deviation from a prompt's stated scope.
5. Verify-gate state of the last commit (all green / any waiver).
6. Protected-file guard status: confirm the §0.11 pre-existing user changes are still intact and
   unstaged.

**Session log (written at every session end).**

One entry per conversation in `SESSION_LOG/` per `SESSION_LOG/README.md`, filename
`YYYY-MM-DD-NN-short-title.md`. The handoff file is the **forward-looking baton**; the session log is
the **backward-looking audit record**. Both are written, even for a one-prompt session.

**Session-log archiving.** When `SESSION_LOG/` accumulates beyond a quarter's worth of entries, move
older entries into `SESSION_LOG/archive/<YYYY-Q#>/` (the README stays at the root). Archiving is a move
only — never edit archived entries.

**New-session bootstrap (first actions, in order).**

1. Read the latest `PLANNING/handoffs/HANDOFF-*.md`.
2. Read the top DEVLOG entries and run `git log --oneline -20` on `main`.
3. Confirm the §0.11 protected files are present and unstaged.
4. Resume STS at the prompt the handoff names. Do not re-derive locked decisions.

---

## 1. Locked creative and technical doctrine

Approved inputs. Prompt 028–030 *measure and record* their exact parameters; they do not reopen the
underlying direction.

### 1.1 Camera family

- A **hybrid third-person adventure camera**; the full player stays visible in ordinary play.
- Outdoors: elevated chase camera, constrained orbit, automatic recentering, collision avoidance,
  stable horizon. Interiors: closer authored camera volumes with selective obstruction fade or cutaway.
- Farming/precision raises and stabilizes the view subtly; caves/combat lower and tighten it without
  becoming an over-the-shoulder aiming game.
- Movement is **camera-relative**. Tools, conversations, pickups, doors, animals use deliberate facing
  and alignment rules.
- **No unrestricted jump.** Traversal is contextual: vault, climb, wade, swim, mount/dismount, doorway,
  elevation-link.
- **Horseback is a first-class early-game traversal mode** (see §1.3). A dedicated **mounted camera
  context** applies — wider, higher follow with gait-scaled look-ahead and fast obstruction recovery at
  speed (see the §2 table).
- **OoT-era control + transition feel is the target.** Camera angle, interior/exterior transitions, and
  movement/interaction controls mirror the Ocarina-of-Time era: authored doorway/loading-seam
  transitions with a deliberate camera handoff, context-sensitive action button, and camera-relative
  movement — not a modern free-cam shooter feel. We mirror the **observable feel only**, never the
  decompiled source or any port — see the hard rule in §0.7.

### 1.2 Physical-simulation doctrine

"True physics" = believable, stable, consistent behavior at gameplay scale — **not** making every
visible object a dynamic rigid body.

- Player/NPCs: kinematic capsule motor with gravity, grounding, slopes, stairs, stable collision,
  pushing, recovery.
- Animals/fauna: inherit the foundation with species-appropriate bodies, locomotion, navigation.
- Flora: authored wind/bend/impact/growth/harvest/seasonal responses; simulation only for close
  interactions that visibly benefit.
- Loose props: pooled rigid bodies with sleep, bounds recovery, deterministic save rules.
- Terrain/buildings: simple invisible collision proxies — never render-mesh collision as the
  production default.
- Farming: deterministic 1 m logical cells beneath freely authored 3D terrain and soil geometry.

### 1.3 World and asset doctrine

- One world unit = one meter.
- **Two connected communities anchor the world.** **Willa Crick** is the inland redwood community;
  **Ballast Bay** is the coastal community. They are joined by **The Klam-ity River** corridor (the
  in-world analog of the way Willow Creek and Klamath, California are linked by a river). At new game the
  player chooses a **starting farm** in either register — inland *or* coastal (the eight farm variants in
  `art-production/current-direction/C-farm-variants/` cover both).
- **Horse-riding is an early-game traversal option** for faster transport between the two communities.
  The Klam-ity River corridor is built to be horse-traversable (rideable along the banks, with fords
  and/or bridges) and is the showcase route for mounted traversal + a community-to-community transition.
- Graybox maps built here are production spatial foundations. Finished art replaces visible meshes
  without changing approved metrics, anchors, collision, navigation, or camera intent.
- Regions are modular and streamable; exterior seams/transitions feel intentional.
- Render meshes, collision proxies, navigation surfaces, interaction anchors, camera volumes, spawn
  points, audio zones, and streaming bounds remain **separate concerns**.
- **Scope boundary for this roster:** WEF locks the *sticks and bricks* — world structure, camera, motor,
  traversal (including horseback), interiors/transitions, navigation, and maps. The narratives, main/side
  quests, and achievement systems layered on the two communities are a **separate future planning
  session**, not designed here.

### 1.4 Artistic direction — load-bearing (N64 / Ocarina-of-Time-era stylization is a MUST)

The visual source of truth is `art-production/`. It is not optional flavor; it is a hard constraint on
every graybox proportion, material call, camera mood, and asset budget in this roster. Any visual prompt
reads it first, and the reference is never allowed to drift. The user holds this direction strongly.

**Stylization (the must).** Original late-1990s N64-era low-poly 3D adventure in the craft spirit of the
Ocarina-of-Time era — **without copying any franchise's** characters, symbols, costumes, locations,
props, UI, or compositions (§0.7). From `style-themes/theme-03-n64-low-poly-adventure/` and
`current-direction/A-global-style-visual-bible/`:

- Faceted, economical silhouettes; chunky low-poly geometry; strong readable silhouettes.
- Hand-painted low-resolution textures on shared atlases; restrained materials; vertex-color accents;
  baked ambient shading.
- Atmospheric distance fog; jewel-toned environmental lighting; warm practical light sources (lanterns,
  windows, fireplaces); restrained post-processing.
- Expressive posture over facial detail; personality through stance and timing.

**Fidelity guardrail — no painterly drift.** The target is **faceted N64 low-poly geometry + hand-painted
low-res texture readability**, not high-fidelity concept-painting realism. The
`current-direction/work-in-progress/` "painterly-drift" variants of `sv_map_026` / `sv_map_027` are an
explicit cautionary example of over-rendering that left the N64 register; they are quarantined, not the
goal. Graybox and final art alike stay on the faceted, readable side of that line.
- **Distinction (do not conflate):** the `D-environments-biome-key-art/` paintings (`sv_env_041`–`044`,
  with more in production) are *intentionally* painterly **concept** art conveying mood, content,
  lighting, and composition — e.g. Market Lane's stall vocabulary in `sv_env_043` (sunny: canvas-canopy
  produce stalls, fishmonger, pressed-flower/quilt exhibits) and `sv_env_044` (winter: festival bunting,
  central well, brazier, snow). They are *translated into* the faceted in-engine look, not reproduced at
  their own fidelity. The drift guardrail governs map / in-engine / graybox references, not D key art.

**Diegetic UI.** UI uses hand-painted rope-bound wood + parchment frames per
`sv_style_009_ui_mood_board.png` and the 40-icon set in `sv_style_010_icon_language.png` (carved-wood
slots, rope borders, shell/heart relationship marks, biome map-pin cameos). Mood/color range across the
day/weather/biome spread is set by the 12-panel `sv_style_003_color_script.png`; seasonal parity is held
by the four-season visual bible (`sv_style_002_*`).

**Model economy (locked targets from `sv_theme_03_004_shape_language.png` panel 11; refined to measured
budgets in Prompt 052).** Low poly counts (representative NPC ~120–180 tris at base LOD); shared
textures + atlases (~4K per area); simple joints (shoulders, hips, neck, +); vertex lighting + baked
shadows; billboards / impostors for distant plants and FX. These shape graybox proportions **now** and
become the Prompt 050 asset-contract floor.

**Material + shape identity (`sv_theme_03_005_materials_board.png` + `sv_theme_03_004_shape_language.png`).**
Materials: weathered cedar, sea-smoothed stone, rope netting, salt-stained canvas, aged copper hardware,
wet sand, translucent tide glass, mossy boardwalk, warm lantern wax, polished shells, greenhouse glass,
hand-painted ceramic tile — plus the inland register of redwood bark, fern, moss, and creek stone. Shape
families: rounded farm buildings, sturdy nautical structures, angular quarry rocks, flowing reef plants
(crossed cards + fronds), wind-shaped ridge trees, diverse/expressive NPC base meshes, friendly animal
base meshes, diegetic UI frames.

**Canonical protagonist + character originality.** The locked player design is
`sv_style_008_sprite_readability.png`: a young farmer in a **red knit beanie, olive work-shirt, rust
X-back suspenders, blue work-pants, and brown boots**, with front/side/back turnaround at three scales
and tool/carry/kneel poses. This is the authority for graybox proportion + the eventual hero rig. The
OoT-era *craft and atmosphere* are the must, but the character is **original**: do not drift toward a
green-tunic / pointed-cap Link analog (the green-tunic figure that appears in some in-engine mood shots,
e.g. `sv_map_026`, is a placeholder, not the design). Costumes, crests, and silhouettes stay original to
Ballast Bay per §0.7.

**Setting (`current-direction/`).** Two connected communities (§1.3): the inland redwood **Willa Crick**
and the coastal **Ballast Bay**, joined by **The Klam-ity River**. The register spans a remote
Pacific-Northwest / northwestern-California feel — redwood + fir forest, creek/river corridors, fog,
rain, moss, weathered timber homesteads — *and* the coast (harbor, lighthouse, tide flats, reefs). The
region layouts in `current-direction/B-world-maps-region-layouts/` (overworld `sv_map_011`, plus
per-region `sv_map_012`–`030`) and the eight farm variants in `current-direction/C-farm-variants/` are
the **authoritative top-down references** for the atlas, blockouts, and graybox maps. The inland Willa
Crick township does not yet have its own dimensioned layout board (only inland homestead key art such as
`sv_style_001_core_key_art_inland-v1.png`); its atlas entry stays provisional until that art lands. Title
is provisional; render no title, logo, wordmark, or initials into anything.

**Hard purge — sports remnants are superseded.** Per `CURRENT_ART_DIRECTION.md` the game has **zero**
volleyball/sport content. The theme-03 core key art's central court/net, the "packed clay court lines"
material, and shape-language panel 6 "volleyball equipment" are **superseded** and must never be
reproduced in a graybox, map, prop, or UI. Apply the sports→cozy substitution table in
`CURRENT_ART_DIRECTION.md` (court → village common / garden / creekside clearing; gear → farm / forestry
/ river / craft props; tournament → county fair / harvest gathering; score UI → calendar / task / weather
/ relationship / skill / restoration UI; banners/trophies → quilts / ribbons / craft exhibits). Treat
`art-production/archive/` as superseded; never use it as integration reference.

> **Setting — RESOLVED (user, 2026-06-19):** not coastal-vs-inland but **both**. **Willa Crick** (inland
> redwood) and **Ballast Bay** (coastal) are two connected communities joined by **The Klam-ity River**,
> each offering selectable starting farms; horse-riding links them early-game. **OoT-era stylization +
> control/transition feel** is locked. The project title remains provisional and is the only open naming
> item; it does not block foundation work.

---

## 2. Camera hypotheses to test, not silently assume

Prompts 028–030 test at least three parameter variants per context and lock one baseline each. Babylon
arc angles are documented both as engine values and as human-readable degrees of downward view.

| Context | Downward view | Follow distance | Vertical FOV | Behavioral hypothesis |
|---|---:|---:|---:|---|
| Exterior exploration | 28–35° | 8–11 m | 45–50° | bounded manual orbit; delayed auto-recenter |
| Farm/precision | 38–46° | 8–10 m | 43–48° | damped yaw; stable cell visibility |
| Small interior | 35–45° | 5–7 m | 48–55° | authored volume; wall fade/cutaway |
| Large public interior | 30–40° | 7–9 m | 45–52° | authored target offsets and room transitions |
| Cave exploration/combat | 20–29° | 6–8 m | 48–55° | tighter framing; faster obstruction response |
| Contextual swim/wade | 25–34° | 8–10 m | 46–52° | horizon and shore remain legible |
| Mounted / horseback | 26–32° | 9–12 m | 46–52° | wider, higher follow; gait-scaled look-ahead; fast obstruction recovery at speed |

Required decisions (not predetermined answers): orbit yaw limits and whether bounds follow heading or
authored world heading; recenter delay/speed/accel/grace; look-ahead by gait; character screen anchor
and mobile safe-area limits; clip bands, obstruction probe shape, fade threshold, recovery speed;
behavior at corners, roofs, doorways, slopes, cliffs, water, large animals, conversations, tool charge,
cutscenes, scene transitions; right-stick / mouse-drag / touch-drag / recenter-button / reduced-motion.

**No production map metric is finalized before the camera gate (028–030) is complete.**

---

## 3. Cross-cutting engineering contracts

### 3.1 Coordinate frames and persistence

- Runtime convention: Y-up, meters, one documented forward axis. Every region owns a stable local
  origin + identifier.
- Saves store semantic anchors or stable entity identifiers, not brittle render-mesh names.
- Cross-region transitions carry source anchor, destination anchor, facing, camera handoff, and
  fallback recovery. Dynamic bodies save only gameplay-relevant state; decorative motion may reset.

### 3.2 Determinism boundary

- Schedules, spawn selection, harvest state, fauna intent, and saved prop outcomes are deterministic
  from explicit state and seeds. Visual wind/secondary motion/particles/idle variation may be
  nondeterministic. Physics is never the sole authority for economy, inventory, quest, crop, or
  relationship outcomes.

### 3.3 Simulation tiers

- **Tier 0 abstract** (offscreen schedules, distant fauna, seasonal growth) · **Tier 1 visual**
  (non-colliding wind/idle/ambient) · **Tier 2 kinematic** (characters, animals, doors, authored
  traversal) · **Tier 3 dynamic** (nearby loose props, explicitly physical objects) · **Tier 4 hero
  event** (short budgeted authored set pieces).
- Every entity family declares its tier, activation radius/condition, sleep/throttle behavior, save
  authority, and mobile fallback.

### 3.4 Shared debug surfaces (dev-only, off by default in production)

By phase end the game exposes overlays for: camera profile/yaw/pitch/FOV/distance/obstruction/active
volume; grounding/slope/step/velocity/capsule/traversal-link; interaction candidates/score/chosen
target/facing/reach; streaming cell/region origin/transition anchors/collision proxies/bounds;
navmesh/path/avoidance intent/recovery; simulation tier/active+throttled counts/physics
bodies/performance.

---

## 4. World-map deliverables and scope boundary

### 4.1 Production-foundation maps delivered in the WEF block

1. Breakpoint Farm exterior · 2. A representative Ballast Bay town district (market lane, harbor
approach, ≥1 elevation change) · 3. Farmhouse interior · 4. A **Klam-ity River corridor slice** linking
the two communities (riverbank path + shoreline + shallow-water ford + cliff + bridge + **horse
traversal** + a community-to-community transition) · 5. A cavern slice (tight passage + open room +
slope/stair + ledge link + combat/navigation space). All playable with the final camera, motor, metrics,
collision proxies, navigation surfaces, camera volumes, interaction anchors, and transition format — and
the river corridor additionally proves mounted (horseback) traversal end to end.

### 4.2 Authoritative atlas specifications delivered in the WEF block

Cover every named core region — **Willa Crick (inland community)**, Breakpoint Farm, **The Klam-ity River
corridor**, Ballast Bay Town, Netlight Point, Driftwood Beach, Kelpglass Reefs, Belltide Marsh, Ironroot
Quarry, Rainhall Caverns, Splitwind Ridge, Outer Islets — each with purpose, footprint, elevation bands,
entrances/exits, adjacencies, sightline landmark,
traversal vocabulary, activity density, streaming cells, time/tide/season variants, required interiors,
camera risks, navigation risks, and production order. Spec ≠ implementing all finished-art regions.

### 4.3 Explicit non-goals (WEF block)

Final character/animal/flora/building/prop art; final textures/animation libraries/audio/VFX/lighting
polish; full finished-art implementation of every region; ragdoll locomotion / unrestricted jumping
/ free climbing / fully simulated vegetation fields; networked multiplayer physics; rebalancing economy
/ relationships / quests / calendar / narrative except where migration must preserve current behavior;
**narrative, main/side-quest, and achievement design for the two communities (a separate future planning
session)**.

---

## 5. Integration model and numbering

**Unified, continuously numbered roster.** WEF foundation prompts are renumbered into the main count
(028–053) and the legacy gameplay continuation follows (054–076). The originating WEF tag is kept in
each foundation prompt's title for traceability; commit subjects and DEVLOG headers use the master
`Prompt NNN` number.

**The seam.** The WEF block ends at Prompt 053 (migration + reconciliation), which closes the
foundation, updates the architecture/scale/legacy docs, and confirms gameplay resumes at Prompt 054.
WEF prompts take precedence over conflicting camera/controller/collision/navigation/world-scale/
map/asset-swap assumptions in the legacy text; already-shipped systems are *migrated*, not discarded.

**Overlap reconciliation (legacy prompts that WEF moves the ground under):**

| Legacy prompt (now) | WEF foundation it builds on | Net effect |
|---|---|---|
| 062/063 Visual polish ×2 | 050/051 asset & rig pipeline + validator | Polish passes become validator-gated `.glb` swaps; no pipeline re-invention. |
| 068 Mobile optimization | 052 perf/accessibility gate (budgets + camera comfort) | 068 shrinks to dynamic-res / shadow tiers / PWA / battery polish on an existing budget floor. |
| 069 Controller & console feel | 028–030 input paths (controller + touch + camera) | 069 narrows to menus / radial / focus-ring / rumble; core controller play already shipped. |
| 070 Accessibility complete | 052 foundational accessibility (remap, reduced motion, recenter, sensitivity) | 070 finishes flashing / timing / contrast / font / color / audio-cue coverage. |
| 071 Automated test suite | per-prompt Playwright + 052 foundation-gate suite | 071 consolidates and fills gaps (canvas-pixel checks across all environments). |

On approval, add a one-line banner to `WORLD_EMBODIMENT_FOUNDATION_PSPR.md` and the roster header of
`STURDY_VOLLEY_PSPR.md` pointing here, and update `CLAUDE.md`'s "canonical plan" pointer to this file.

---

## 6. The unified roster

### 6.0 Completed — Prompts 001–027 (historical; do not re-execute)

Shipped: vertical slice (player movement, camera, collision, interaction, scale, scene transitions,
mobile budgets, the gather→plant/water→harvest→inventory/save loop, one live NPC), the RF retrofit
pass, and gameplay through skill professions & mastery. Detailed entries live in `DEVLOG.md` and the
legacy `STURDY_VOLLEY_PSPR.md` §8. Recent shipped highlights: 021 fishing/crab pots · 022 low-tide reef
& snorkeling · 023 mining & caves · 024 defensive tools & NPC daily life · 025 mine depth/elevator/boss
· 026 combat-light creatures & AI · 027 skill professions & mastery.

> **Note on the foundation rebuild:** Prompts 028–053 re-platform camera, motor, collision, navigation,
> streaming, and world-scale. Systems shipped in 001–027 are migrated to the shared foundation in
> 040–043 (nav/fauna) and 053 (scene migration), not reimplemented without cause.

---

### 6.1 Foundation block — Prompts 028–053 (WEF, split)

#### Prompt 028 — TypeScript config split + camera proving-ground shell (WEF-01a)

Split the combined `tsconfig.json` into strict game and Node/tooling configurations with a single
command running both (no weakened strictness). Stand up `src/scenes/CameraLabScene.ts` as a proving
ground with the test geometry kit (open ground, farm grid, narrow lane, small room, large room, roof,
tree canopy, wall corner, slope, stairs, cliff, shallow water, doorway, NPC capsule, animal body,
interaction prop, cave corridor) and wire it into the scene registry / debug navigation.

Acceptance criteria:

- Two strict TS configs run in the verify gate; every prior strictness rule preserved.
- The proving-ground scene is reachable via debug nav and renders the full geometry kit at scale.
- A reproducible screenshot route exists for the proving ground on desktop and Pixel 5.

#### Prompt 029 — Data-driven camera profiles, rig, obstruction, and input (WEF-01b)

Add `src/camera/` modules: data-driven camera **profiles**, the **rig**, camera **volumes**,
**obstruction** probing, and **input** paths (keyboard/mouse, controller right-stick, touch-drag).
Provide runtime switching among at least three variants per relevant §2 context.

Acceptance criteria:

- The §1.1 hybrid doctrine is visible and playable with keyboard/mouse, controller, and touch.
- Constrained orbit, recenter grace, look-ahead, and collision/occlusion response are deterministic and
  tunable purely from profile data.
- At least three variants per context are switchable at runtime in the proving ground.

#### Prompt 030 — Lock camera baselines, reduced motion, telemetry, decision record (WEF-01c)

Tune and lock one baseline profile per §2 context. Record exact values (degrees **and** Babylon arc
representations). Add reduced-motion mode, camera telemetry, and reproducible screenshot routes; write
`docs/GAMEPLAY_CAMERA_AND_CONTROLS.md` with the decision record.

Acceptance criteria:

- Exact selected values recorded for every §2 context (downward view, distance, FOV, orbit limits,
  recenter, look-ahead, obstruction).
- Full character visibility + HUD-safe framing pass at desktop, tablet, Pixel 5, ultrawide, and
  tall-phone aspect ratios.
- Interior obstruction demonstrates both selective fade and cutaway candidates; chosen rule + fallback
  recorded. Reduced-motion removes impulses and uses conservative blend timing.
- Camera telemetry + screenshot routes exist; the decision record explains rejected alternatives and
  locks the baseline. **This completes the camera gate; no production map metric is finalized before
  it.**
- The **mounted/horseback** context (§2) is locked here (tested against a proving-ground stand-in body),
  and the interior/exterior-transition camera handoff follows the **OoT-era feel** (§1.1). Ridden
  integration with the real horse lands in Prompt 044.
- **Art reference (§1.4):** the locked camera mood matches `sv_style_006_lighting_board.png` and
  `sv_style_007_camera_scale_guide.png` — slightly-elevated 3/4 adventure framing, atmospheric fog,
  warm practical light, strong foreground player silhouette.

#### Prompt 031 — Havok adapter + kinematic capsule motor core (WEF-02a)

Verify the current official Babylon/Havok APIs against the pinned package, then integrate Havok behind
a narrow adapter. Build one reusable kinematic-capsule player motor: grounding, gravity, acceleration,
braking, turning, and ground snapping. Replace scene-local planar movement with this motor in the
proving ground.

Acceptance criteria:

- One motor produces the same core behavior in the proving ground on desktop and mobile frame bands.
- Capsule dimensions, skin/contact offset, speeds, acceleration, braking, turn rates, and gravity are
  documented in meters and seconds.
- Motor core logic has deterministic unit coverage; integration has desktop + mobile Playwright
  coverage. Existing stamina/gait behavior remains functional through the adapter.

#### Prompt 032 — Motor terrain handling and recovery (WEF-02b)

Extend the motor with slope limit, sliding, step offset, stairs, low-ceiling handling, stable pushing,
moving-platform contact contract, penetration recovery, and out-of-bounds recovery.

Acceptance criteria:

- Slopes, stairs, corners, low ceilings, moving contact, and pushing do not jitter, tunnel, hover, or
  trap the player.
- Step height, slope limit, and recovery thresholds documented in meters/seconds.
- Deterministic unit coverage for each case + proving-ground Playwright on both projects.

#### Prompt 033 — Water, contextual traversal links, and save recovery (WEF-02c)

Add wading, swimming entry/exit, and authored traversal links (vault/climb/elevation transitions — no
unrestricted jump). Ensure save/load and region entry recover to a valid grounded pose and stable
anchor. Migrate the existing gait/stamina consumers onto the new motor end-to-end. (The mount/dismount
traversal link + ridden-locomotion motor are delivered as a dedicated subsystem in Prompt 044.)

Acceptance criteria:

- Shore entry, water exit, and traversal links are contextual, cancellable where safe, and restore
  control without camera discontinuity.
- Save/load and region entry recover to a valid grounded pose and stable anchor.
- Buoyancy/recovery thresholds documented; existing stamina and gait behavior remain functional.

#### Prompt 034 — Interaction, facing, and tool-targeting model (WEF-03)

Shared 3D interaction resolver separating candidate discovery, scoring, selection, facing alignment,
action commitment, and effect execution. One-button contextual philosophy with a visually predictable
chosen target. Supports farm cells, crops, soil, forage, props, doors, NPCs, animals, machines, ore,
water, fishing, loose bodies, and traversal links; farming stays deterministic on the 1 m logical grid.

Acceptance criteria:

- Scoring includes distance, view/facing relevance, action priority, reachability, obstruction, held
  tool, and sticky-target hysteresis; a visible focus treatment + optional ground preview shows the
  exact target before commitment.
- Facing, turn-in-place threshold, hand/tool alignment, anticipation, impact, recovery, and cancel
  window are documented.
- Touch tap, virtual stick + action, keyboard, and controller choose the same target for equivalent
  situations; crowded NPC/animal/door and crop/forage/tool cases have regression tests.
- Current inventory, tool hardness, stamina, dialogue, animal, machine, and forage outcomes intact.

#### Prompt 035 — Exterior topology, chunks, streaming, coordinate frames (WEF-04)

Implement the exterior world container before laying out full regions. Choose chunk dimensions from
measured camera visibility + mobile budgets. Separate render chunks, collision proxies, navigation
data, interaction anchors, spawn sets, camera volumes, audio zones, and persistence identifiers.

Acceptance criteria:

- `docs/WORLD_TOPOLOGY_AND_STREAMING.md` records region/chunk/local-origin/seam/preload/unload/
  persistence/transition contracts.
- A multi-chunk exterior test crosses seams without visible pop, collision gaps, camera snaps, NPC
  discontinuity, duplicate entities, or save-identity changes.
- Streaming uses hysteresis + explicit memory/mesh/body budgets; origin strategy stays numerically
  stable across the planned world; failure/slow-load keeps the player on valid ground with recovery.
- Chunk + preload sizing accounts for **horse-speed traversal** (a mounted player covers ground faster
  than on foot), and the contract supports the **community-to-community transition** along the Klam-ity
  River (Willa Crick ↔ Ballast Bay) without seam pop while mounted.
- Tide/season/weather/restoration variants change chunk content without changing stable anchors. Debug
  overlay exposes chunk bounds, states, region origin, and active budgets.

#### Prompt 036 — Interior construction kit + authored camera volumes (WEF-05)

Reusable interior kit for farmhouse rooms, shops, homes, public halls, and cavern-like enclosed spaces.
Metric modules; interiors may break the exterior footprint illusion when playability requires it (and
the expansion is recorded).

Acceptance criteria:

- Modules define wall/floor/ceiling/doorway/window/stair/counter/furniture-clearance/interaction/
  navigation dimensions. Camera volumes support profile override, target offset, yaw bounds,
  obstruction mode, blend boundary, priority, and safe fallback; adjacent volumes blend without
  oscillation.
- Wall fade/cutaway never exposes a void without a deliberate backing treatment.
- Small-room, corridor, stair, crowded-shop, and large-hall tests keep character + primary interaction
  readable on Pixel 5; exterior/interior handoff preserves destination anchor, facing, camera intent,
  time, NPC state, and return path. (Reference implementation for the farmhouse in Prompt 046.)

#### Prompt 037 — Map metric kit + map schemas (WEF-06a)

Lock the spatial grammar now that camera, motor, topology, and interior findings are known. Author
`docs/world/METRIC_KIT.md` (paths, desire lines, plazas, farm cells, beds, counters, doorways, rooms,
buildings, docks, bridges, fences, paddocks, trees, crop clearances, cliffs, slopes, stairs,
shorelines, wading bands, swim boundaries, cave corridors, encounter rooms, transition thresholds,
camera/navigation clearance, landmark sightlines) and machine-readable map schemas.

Acceptance criteria:

- `docs/world/METRIC_KIT.md` gives final dimensions, tolerances, rationale, and camera compatibility
  for every kit element.
- Machine-readable map schemas validate coordinate frames, chunks, anchors, volumes, collision/
  navigation references, variants, and transitions.
- Every route supports player capsule, NPC, relevant animal body, camera clearance, and mobile
  legibility.
- **Art reference (§1.4):** kit dimensions are reconciled against `sv_style_007_camera_scale_guide.png`
  (human 1.7–1.8 m, 1 m farm cells, cottage/door proportions) and the material/shape identity in the
  theme-03 boards, so the metric kit and the OoT-era silhouette stay consistent.

#### Prompt 038 — World atlas: adjacency + region sheets (WEF-06b)

Author `docs/world/ATLAS.md` (global adjacency + progression among all core regions per §4.2) and one
authoritative spatial sheet per region with the §4.2 fields. The atlas must establish the spine
**Willa Crick ↔ The Klam-ity River ↔ Ballast Bay** and which starting farms attach to each community.

Acceptance criteria:

- `docs/world/ATLAS.md` defines global adjacency + progression across the §4.2 regions, with the
  two-community + river spine explicit and horse-traversal routes noted.
- Each region has an authoritative spatial sheet (purpose, footprint, elevation bands, entrances/exits,
  adjacencies, sightline landmark, traversal vocabulary, activity density, streaming cells, variants,
  required interiors, camera/navigation risks, production order). The inland **Willa Crick** township and
  the **Klam-ity River** sheets may be marked *provisional* where dimensioned art does not yet exist
  (§1.4), but their adjacency and role are fixed.
- No region layout copies the topology or landmark arrangement of another game.
- **Art reference (§1.4):** each region sheet is grounded in its authoritative top-down board —
  overworld `sv_map_011_ballast_bay_overworld.png` plus the per-region layouts `sv_map_012`–`sv_map_021`
  (Farm, Town, Driftwood Beach, Netlight Point, Kelpglass Reef, Belltide Marsh, Ironroot Quarry,
  Rainhall Caverns, Splitwind Ridge, Outer Islets) — capturing the redwood-meets-coast setting, not
  reinventing geography.

#### Prompt 039 — Dimensioned blockouts: Breakpoint Farm + Ballast Bay district (WEF-06c)

Derive dimensioned top-down and elevation/blockout diagrams for Breakpoint Farm and the Ballast Bay
district from the final metric kit.

Acceptance criteria:

- Both receive dimensioned top-down and elevation/blockout diagrams traceable to the Prompt 037 kit.
- Routes shown support capsule, NPC, relevant animal body, camera clearance, and phone legibility.
- Diagrams are the authoritative source for the Prompt 046/047 graybox builds.
- **Art reference (§1.4):** blockouts are derived from `sv_map_012_breakpoint_farm_layout.png` and
  `sv_map_013_ballast_bay_town_layout.png` (farmhouse + barn + fenced pasture + quadrant crop field with
  irrigation + pond/waterfall + creek footbridge + cliff-to-ocean for the farm; harbor docks + lighthouse
  point + river-through-town + terraced market lane + beach + stair/elevation changes for the town).

#### Prompt 040 — NPC navigation service core (WEF-07a)

Replace direct waypoint interpolation with a navigation service consuming baked/generated navmesh,
authored off-mesh links, and doors, driving at least four existing NPCs on the shared motor across
exterior, doorway, interior, and stair/slope cases.

Acceptance criteria:

- ≥4 existing NPCs traverse exterior/doorway/interior/stair-slope using the shared motor/navigation
  contract.
- Conversation alignment and basic schedule transitions remain correct through the new service.
- Navigation debug view shows mesh, path, and next link.

#### Prompt 041 — Avoidance, schedules, offscreen sim, recovery, performance (WEF-07b)

Add local avoidance, dynamic-obstacle handling, deterministic recovery, schedule authority, and
abstract offscreen simulation outside active neighborhoods.

Acceptance criteria:

- NPCs avoid the player and each other without deadlock, doorway dancing, or pushing the player into
  invalid space; door queues, blockages, missed schedule time, navmesh loss, and stuck recovery have
  explicit policies.
- Offscreen simulation consumes no active character physics body and rejoins at a valid semantic
  anchor; schedule pause/resume correct.
- Navigation debug adds desired velocity, avoidance, active/abstract state, and recovery reason;
  performance tests cover representative town population and mobile throttling.

#### Prompt 042 — Animal family framework + domestic-animal migration (WEF-08a)

Define body/motor/navigation/behavior/simulation-tier **families** (not one generic mover). Author
`docs/ANIMAL_AND_FAUNA_PHYSICS.md` and migrate existing pets + farm animals (small quadruped pet +
grazing livestock families) onto the shared foundation.

Acceptance criteria:

- The doc defines scale, body proxy, gait bands, turning, slope/water capability, obstacle policy,
  interaction distance, animation needs, LOD/throttle, and save authority **per family**.
- Existing pets and farm animals migrate without losing affection, feeding, produce, weather, or
  schedule behavior; player/animal and animal/animal contacts feel soft and stable.
- Animals respect fences, gates, cliffs, doors, navigation links, and recovery bounds.
- **Art reference (§1.4):** body proxies and scale follow the friendly-animal base meshes
  (`sv_theme_03_004_shape_language.png` panel 8) and the chicken/goat scale in
  `sv_style_007_camera_scale_guide.png`.

#### Prompt 043 — Wild-fauna movement families (WEF-08b)

Implement the wild families: bird, shoreline crawler, swimming fauna, and cave creature, with
patrol/forage/flee/flock-or-group/swim (or species-appropriate equivalents).

Acceptance criteria:

- Representative wild fauna demonstrate their behaviors without requiring every animal to be dynamic;
  they respect water eligibility, cliffs, and navigation links.
- Offscreen and distant fauna downgrade through declared tiers deterministically.
- Mobile population and active-skinned-body ceilings are measured and enforced.

#### Prompt 044 — Mount system: rideable horse + mount/dismount + ridden motor (early-game traversal)

Deliver horseback as a cohesive vertical slice — the early-game option for faster transport between
Willa Crick and Ballast Bay (§1.3). Build the **rideable horse body** (extending the Prompt 042 animal
families), the **mount/dismount** contextual action, the **ridden-locomotion motor** (a distinct
speed/turn/accel profile over the Prompt 031–033 motor), and the **mounted-camera integration** that
consumes the Prompt 030 mounted baseline. Proven in the proving ground + a representative outdoor stretch
before the river-corridor map (Prompt 048) exercises it for real.

Acceptance criteria:

- The rideable horse body extends `docs/ANIMAL_AND_FAUNA_PHYSICS.md` with a larger body proxy, ridden vs.
  free gait bands, ford/shallow-water capability, navigation + recovery bounds when riderless, and a
  mount-anchor socket; it saves location + tame/ownership state.
- **Mount and dismount** are contextual one-button actions; ridden locomotion uses a documented faster
  speed/turn/accel profile and hands the camera to the mounted context; dismount returns the player to a
  valid grounded pose with no camera discontinuity.
- Mounted traversal is stable across slopes, fords, bridges, doorways/seam transitions, and obstruction;
  it never tunnels, traps, or strands horse or rider; save/load restores the mounted/dismounted state.
- Works with keyboard/mouse, controller, and touch; reduced-motion honored.
- Deterministic unit coverage for the ridden motor + mount state machine; proving-ground Playwright on
  both projects.
- **Art reference (§1.4):** the horse stays within the OoT-era low-poly silhouette + the panel-11 model
  economy (`sv_theme_03_004_shape_language.png`); mounted framing matches the §2 mounted row.

#### Prompt 045 — Flora and environmental-motion tiers (WEF-09)

Shared flora/environment motion for grass, crops, shrubs, flowers, trees, reeds, kelp, hanging nets,
flags, shoreline foam, fog, and lightweight ambient fauna effects. Authored deformation + tiering;
physical bodies reserved for gameplay-relevant close interaction.

Acceptance criteria:

- `docs/FLORA_AND_ENVIRONMENT_MOTION.md` defines motion source, bend points, phase variation,
  interaction response, season/weather inputs, distance tiers, reduced-motion behavior, and mobile
  fallback per family.
- Wind has coherent direction + gust timing while repeated plants avoid lockstep; player/tool/animal/
  weather/harvest/regrowth responses have clear ownership and do not alter deterministic crop/forage
  outcomes.
- Trees/canopies, reeds/grass, crops, and shoreline vegetation show distinct believable responses;
  instancing/batching stays available; reduced-motion/low-quality preserve gameplay cues; performance
  tests enforce active-deformation and draw-call ceilings.
- **Art reference (§1.4):** flora silhouettes follow the shape-language families — flowing reef plants
  as crossed cards + fronds, wind-shaped ridge trees (`sv_theme_03_004_shape_language.png` panels 4–5) —
  and distant plants/FX use billboards/impostors per the panel-11 model economy.

#### Prompt 046 — Production-foundation maps I: Farm exterior + Farmhouse interior (WEF-10a)

Build Breakpoint Farm exterior and the Farmhouse interior from the approved metric kit — gray visible
geometry over production collision, navigation, anchor, camera-volume, streaming, and transition data.
(Farmhouse is the Prompt 036 interior-kit reference implementation.)

Acceptance criteria:

- Both reachable through ordinary gameplay transitions using the shared camera/motor/interaction stack;
  the exterior/interior handoff preserves anchor/facing/camera/time/NPC state.
- Each demonstrates its required activities, elevation, traversal, camera, NPC/fauna, flora, and
  environmental-motion cases; boundaries read as geography/architecture, not arbitrary walls.
- Collision proxies, nav surfaces, interaction anchors, camera volumes, and render meshes each toggle
  in debug view; farm save identities and shipped loops survive migration; automated tours cover every
  transition + representative interaction on both Playwright projects; map stays inside Prompt 052
  budgets.
- **Art reference (§1.4):** graybox layout + silhouettes match `sv_map_012_breakpoint_farm_layout.png`,
  `sv_map_023_farmhouse_interior_starter.png`, and the morning mood of `sv_env_041_breakpoint_morning.png`
  (redwood edge, creek, fenced pasture, rounded timber farm buildings). No central court/net (§1.4 purge).

#### Prompt 047 — Production-foundation map II: Ballast Bay town district (WEF-10b)

Build the representative Ballast Bay town district (market lane, harbor approach, ≥1 elevation change)
from the metric kit and the Prompt 039 blockout.

Acceptance criteria:

- Reachable through ordinary transitions using the shared stack; demonstrates market/harbor activities,
  elevation, traversal, camera, and NPC cases; boundaries read as architecture.
- Critical routes + landmarks legible without a minimap at phone scale.
- All proxy/nav/anchor/volume/mesh layers toggle in debug; town save identities survive migration;
  automated tour on both projects; stays inside Prompt 052 budgets.
- **Art reference (§1.4):** graybox layout + silhouettes match `sv_map_013_ballast_bay_town_layout.png`,
  `sv_map_022_town_interiors_grid.png`, and the mood of `sv_map_026_market_lane_rainy.png` +
  `sv_map_027_harbor_evening.png` (harbor docks, lighthouse point, river-through-town, terraced lanes).

#### Prompt 048 — Production-foundation map III: Klam-ity River corridor + mounted traversal (WEF-10c-i)

Build the **Klam-ity River corridor slice** linking the two communities (riverbank path + shoreline +
shallow-water ford + cliff + bridge + **horse traversal** + a Willa Crick ↔ Ballast Bay
community-to-community transition). This is the showcase that exercises the Prompt 044 mount system on a
real map.

Acceptance criteria:

- Reachable through ordinary transitions using the shared stack; demonstrates wade/ford + shore
  legibility **and mounted (horseback) traversal end to end across the community transition**.
- Mounting at one community, riding the corridor, fording/bridging the river, and dismounting at the
  other community works without seam pop or camera discontinuity.
- Boundaries read as geography; routes legible at phone scale; all debug layers toggle.
- Automated tours cover every transition + representative interaction (including a mounted run) on both
  projects; stays inside Prompt 052 budgets.
- **Art reference (§1.4):** river/shore graybox draws on `sv_map_014_driftwood_beach_layout.png` +
  `sv_map_016_kelpglass_reef_layout.png` (wet sand, tide flats, reef cards, cliffs) and the
  creek/footbridge + cliff-to-water vocabulary in `sv_map_012` / `sv_env_041`.

#### Prompt 049 — Production-foundation map IV: cavern slice (WEF-10c-ii)

Build the cavern slice (tight passage + open room + slope/stair + ledge link + combat/navigation space).

Acceptance criteria:

- Reachable through ordinary transitions using the shared stack; demonstrates tight/open framing + ledge
  traversal + combat/navigation space.
- Boundaries read as geography; routes legible at phone scale; all debug layers toggle.
- Automated tours cover every transition + representative interaction on both projects; stays inside
  Prompt 052 budgets.
- **Art reference (§1.4):** cavern follows `sv_map_019_rainhall_caverns_layout.png` (tight passage, open
  lantern-lit room, ledge links) — the modular cave-room board.

#### Prompt 050 — Asset & rig contract + validator (WEF-11a)

Author `docs/ASSET_AND_RIG_CONTRACT.md` (meters, axes, transforms, origins, naming, materials, UVs,
texture budgets, skeletons, sockets, LODs, collision proxies, animation clips/events, root-motion
policy, bounds, export rules) and build the validator.

Acceptance criteria:

- The contract defines per-family reference requirements (character + NPCs, animals/fauna, flora,
  buildings, terrain modules, tools, machines, loose props).
- The validator rejects wrong scale, transforms, axes, missing clips/events, excessive
  materials/triangles, absent collision metadata, and invalid naming — with actionable messages.
- `npm run validate:assets` integrates the validator without weakening existing checks.

#### Prompt 051 — Swap factories + end-to-end asset fixtures (WEF-11b)

Reference manifests + asset factories that swap graybox render geometry for `.glb` without replacing
semantic anchors, collision, navigation, interaction, or save identifiers. Prove the pipeline with five
fixtures.

Acceptance criteria:

- A representative humanoid, animal, flora, building module, and loose-prop fixture each swap end to end
  via the factory, preserving anchors/collision/navigation/save identity.
- Grayboxes remain available as development and asset-failure fallbacks.
- Swap is reversible and Playwright-verified on both projects.

#### Prompt 052 — Performance, accessibility, and objective foundation gate (WEF-12)

Measure the complete foundation on desktop + Pixel 5 and codify budgets and quality tiers. Do not defer
accessibility or camera comfort.

Acceptance criteria:

- Budgets cover FPS/frame time, draw calls, triangles, active meshes, physics bodies, character motors,
  navigation agents, animated/skinned meshes, deforming flora, streamed memory, chunk transition time,
  and initial/region download size; all five maps pass on desktop + Pixel 5 with representative
  populations.
- Quality tiers change density/effects, not interaction reach, collision, route availability, schedules,
  or simulation outcomes.
- Accessibility checks cover remapping, touch target size, camera sensitivity, separate X/Y inversion,
  recenter control, reduced motion, camera shake, hold/toggle, auto-facing assistance, high-contrast
  focus, subtitles, and no-time-pressure mode.
- A single foundation-gate suite tours every environment, transition, camera context, traversal type,
  target type, NPC state, animal family, and simulation tier; `docs/SCALE_AND_PERFORMANCE.md` is updated
  from measured results and becomes the normative post-foundation budget document.

#### Prompt 053 — Migrate current scenes + close the foundation phase (WEF-13)

Remove obsolete scene-local camera/movement/collision/direct-navigation paths only after consumers
migrate. Reconcile documentation + planning so gameplay prompts build on one foundation.

Acceptance criteria:

- Farm, Town, Interior, Beach/coast, and Mine/cavern use the shared camera, motor, interaction,
  transition, physics, navigation, map-data, and debug contracts where applicable.
- Existing save/farm/forage/crop/tool/machine/animal/pet/fishing/reef/mine/combat/shop/NPC/dialogue/
  friendship/cutscene/time/weather/tide behavior has regression coverage and remains playable.
- Obsolete implementations removed only when repository search proves no live consumer; compatibility
  adapters have named retirement criteria.
- `README.md`, `docs/ARCHITECTURE.md`, `docs/SCALE_AND_PERFORMANCE.md`, and the legacy P-SPR accurately
  describe the resulting foundation; the atlas identifies the next region build order; the full verify
  gate, full E2E suite, foundation gate, clean-install build, and production preview smoke test pass.
- A final DEVLOG phase summary lists locked decisions, measured budgets, remaining risks, deferred
  final-art work, and confirms gameplay resumes at **Prompt 054**.

---

### 6.2 Gameplay continuation — Prompts 054–076 (legacy 028–050, on the new foundation)

These carry the legacy acceptance criteria verbatim. They now build on the shared camera/motor/
interaction/navigation/streaming/asset foundation; reconciliation notes (§5) reduce duplicated scope.
Full long-form context for each remains in `STURDY_VOLLEY_PSPR.md` §8.2.

#### Prompt 054 — Quest system (legacy 028)

Quest journal, story quests, daily requests, special orders, objectives, timers, rewards, relationship
effects, progress notifications, cancellation rules.

- ≥12 quests across farming, fishing, crafting, mining, foraging, exploration, social arcs.
- Quest UI is touch-friendly. Failed timed quests do not break story paths.

#### Prompt 055 — Community restoration projects (legacy 029)

Civic project board, contribution UI, item/money/relationship requirements, project phases, visible map
changes, opening ceremonies, reward unlocks.

- ≥3 projects fully functional. Completed projects visibly alter maps + schedules. Ceremonies include
  NPC reactions. (Map changes use the WEF streaming/anchor contracts.)

#### Prompt 056 — Festivals phase one (legacy 030)

Seasonal festival framework + Spring Seed Blessing, Summer Glowtide Night, Fall Harvest Fair.

- Festival days alter schedules/shops/map setup/music; each has ≥1 non-sport minigame, special shop,
  relationship opportunity; multiplayer hooks considered.

#### Prompt 057 — Festivals phase two (legacy 031)

Winter Frostlight Festival, Lantern Tide, Marsh Chorus, Founders Harvest Fair, rotating year-two
variants.

- Year-two dialogue/map variations; Founders Harvest Fair depends on restoration progress + relationship
  arcs; rewards unique but not mandatory for main progression.

#### Prompt 058 — Mail, news, and world reactivity (legacy 032)

Mail, notice board, weather/tide forecast, shipping + restoration notes, birthday reminders,
lost-and-found, dynamic news after player actions.

- Mail delivers items/recipes/quests/story; notice board creates daily/weekly reasons to visit town;
  news reacts to projects/festivals/restoration milestones.

#### Prompt 059 — Cooking and buffs (legacy 033)

Kitchen, recipes, ingredient tags, cooking UI, food buffs, favorite meals, picnic/shared-meal scenes.

- ≥25 original recipes; buffs affect stamina/skill/movement/fishing/mining/foraging/combat; NPC meal
  preferences integrate with relationships.

#### Prompt 060 — Home, decor, and customization (legacy 034)

Farmhouse interiors, furniture placement, wallpaper/flooring, renovations, wardrobe, appearance,
banners, trophy/curio shelves, photo mode.

- Decor placement works with touch + mouse; appearance changeable after start; photo mode hides UI and
  saves screenshots where the browser permits. (Built on the WEF interior kit + camera volumes.)

#### Prompt 061 — Audio architecture (legacy 035)

Music manager, ambient layers, positional sound, UI/tool/mine/cavern/weather/festival audio,
accessibility volume controls.

- Music changes by region/season/time/weather/event; ambience crossfades cleanly; audio mutable by
  category. (Uses WEF region/streaming + audio-zone separation.)

#### Prompt 062 — Visual polish pass one (legacy 036)

Replace placeholders for farm, player, core tools, first 4 NPCs, first animals, crops, and UI with
validated Theme 3 `.glb` models + compressed textures via the **Prompt 050/051** pipeline.

- First 15 minutes look cohesive; animations have anticipation/follow-through; UI legible over bright +
  dark maps; wireframe/texture/rig/scale/movement references exist per integrated hero asset.

#### Prompt 063 — Visual polish pass two (legacy 037)

Seasonal material/prop variants, weather particles/fog, day/night + indoor lighting transitions, window
glows, festival crowd reactions, animated flora/fauna, shoreline/tide meshes, water caustics,
distance-based effect reduction.

- Each season distinct within 5 s; weather affects mood + readability; performance within target;
  lighting preserves the N64-era character while clear on modern screens.

#### Prompt 064 — NPC content expansion (legacy 038)

Expand to 12 romance candidates + 12 core town NPCs with schedules, portraits, gift tastes, birthdays,
relationship scenes.

- ≥80 lines per NPC before launch alpha; no NPC exists only as a shop interface; arcs interconnect
  through town events. (Uses the WEF navigation/schedule service.)

#### Prompt 065 — Narrative act structure (legacy 039)

Three acts — Arrival and Repair, Trust and Old Wounds, Storm Archive + Founders Harvest Fair — with act
gates, optional routes, moral choices, post-credits year-two content.

- Main story completable without romance; choices change scenes/flavor without unfairly locking core
  features; ending celebrates community restoration, not domination.

#### Prompt 066 — Secrets and long-tail goals (legacy 040)

Hidden rooms, rare weather, secret crops, legendary fish, deep-cavern relics, animal personalities, map
fragments, archive mysteries, multi-year scenes.

- Secrets hinted through lore/environment, not pure obscurity; ≥20 by beta; completion log avoids
  spoiling undiscovered secrets.

#### Prompt 067 — Save migration and data versioning (legacy 041)

Save schema versioning, migrations, backup slots, corruption recovery, autosave, manual export,
cloud-save-ready abstraction.

- Old test saves migrate after schema changes; corrupt saves fail gracefully; exported save imports on
  another browser. (Must cover save-shape changes introduced across the WEF migration.)

#### Prompt 068 — Mobile optimization (legacy 042)

Polish on the **Prompt 052** budget floor: touch targets, safe areas, virtual controls, dynamic
resolution, shadow tiers, fog range, LOD bias, animation update rate, texture residency, battery-aware
effects, streamed loading, orientation, PWA install.

- Works at 360×740 + tablet; no required button under 44×44 CSS px; PWA launches offline after first
  load; target scenes within triangle/draw-call/texture-memory/active-rig budgets.

#### Prompt 069 — Controller and console-style feel (legacy 043)

On top of the **Prompt 029** controller/camera paths: full controller menu navigation, focus rings,
radial menus, rumble hooks where supported, couch-friendly UI scaling.

- Entire first day playable controller-only; menus have predictable focus order; button prompts update
  by input device.

#### Prompt 070 — Accessibility complete pass (legacy 044)

Finish, on the **Prompt 052** foundation: motion, flashing, timing assists, contrast, text size, font,
color markers, audio cues, remapping.

- Fishing + combat-light encounters completable with assist settings; important info never color-only;
  settings available before gameplay starts.

#### Prompt 071 — Automated test suite (legacy 045)

Consolidate per-prompt coverage + the **Prompt 052** foundation-gate suite: crop growth, inventory,
shops, relationships, quests, festivals, saves, machines, animals, mine-floor generation + combat,
scene smoke loads, GLB validation, animation clip availability, interaction anchors, collision proxies,
navigation links, canvas output.

- Core logic deterministic; Playwright smoke covers desktop + mobile; CI-ready scripts; canvas-pixel
  checks detect blank scenes, broken cameras, missing models, failed materials, framing regressions.

#### Prompt 072 — Balancing tools (legacy 046)

Debug dashboards for economy, crop profits, XP pacing, gift discovery, quest/festival rewards, machine
throughput, mine/combat difficulty.

- Designers export balance tables; debug tools excluded from production or flag-gated; economy outliers
  visible.

#### Prompt 073 — Content authoring guide (legacy 047)

Docs for adding NPCs, crops, items, recipes, quests, festivals, modular 3D maps, dialogue, cutscenes,
animals, mine floors/creatures — including Blender setup, budgets, rig reuse, clip naming, anchors,
collision, navigation, LOD, texture compression, `.glb` export, icon rendering, validation.

- A new contributor adds a simple NPC without touching engine code, and exports/validates a simple prop
  without hand-editing runtime files; docs include examples + validation rules; naming conventions
  clear.

#### Prompt 074 — Alpha vertical slice (legacy 048)

Assemble the first 7 in-game days: 3D farm basics, town intro, 4 rigged NPCs with posture profiles, 2
animated animals, fishing, one mine room with combat-light encounter, one story quest, one civic
project, one mini-festival teaser, a representative validated item library.

- A new player understands the game unaided; no progression blockers; end of slice invites continued
  play.

#### Prompt 075 — Beta content expansion (legacy 049)

Expand to one full in-game year: all seasons, all major modular 3D maps, 24 rigged NPCs, complete
documented crop/item/prop library, 40 recipes, 30 quests, 8 festivals, 4 farm variants, complete
mine-depth + skill-mastery progression.

- Year-one playthrough has varied weekly goals; every major system intersects ≥2 others; no single
  money strategy trivializes progression.

#### Prompt 076 — Release candidate polish (legacy 050)

Finish Theme 3 asset replacement, model/rig/animation validation, lighting, audio, localization hooks,
bug fixing, performance, save stability, credits, privacy-first telemetry option, final QA.

- Build passes all tests; Lighthouse/PWA basics healthy; no known save-destroying bugs; credits +
  licenses complete.

---

## 7. Completion checklist

**Foundation block (WEF):**

- [x] 028 — TS config split + camera proving-ground shell (WEF-01a)
- [x] 029 — Camera profiles, rig, obstruction, input (WEF-01b)
- [x] 030 — Lock camera baselines + telemetry + decision record (WEF-01c)
- [x] 031 — Havok adapter + capsule motor core (WEF-02a)
- [x] 032 — Motor terrain handling + recovery (WEF-02b)
- [x] 033 — Water + traversal links + save recovery (WEF-02c)
- [x] 034 — Interaction, facing, tool-targeting (WEF-03)
- [x] 035 — Exterior topology, chunks, streaming (WEF-04)
- [x] 036 — Interior kit + camera volumes (WEF-05)
- [x] 037 — Metric kit + map schemas (WEF-06a)
- [x] 038 — World atlas + region sheets (two-community + river spine) (WEF-06b)
- [x] 039 — Farm + town blockout diagrams (WEF-06c)
- [x] 040 — NPC navigation service core (WEF-07a)
- [x] 041 — Avoidance, schedules, offscreen sim (WEF-07b)
- [x] 042 — Animal families + domestic migration (WEF-08a)
- [x] 043 — Wild-fauna families (WEF-08b)
- [x] 044 — Mount system: rideable horse + mount/dismount + ridden motor
- [x] 045 — Flora + environmental-motion tiers (WEF-09)
- [x] 046 — Maps I: Farm exterior + Farmhouse (WEF-10a)
- [x] 047 — Map II: Ballast Bay town district (WEF-10b)
- [x] 048 — Map III: Klam-ity River corridor + mounted traversal (WEF-10c-i)
- [x] 049 — Map IV: cavern slice (WEF-10c-ii)
- [x] 050 — Asset & rig contract + validator (WEF-11a)
- [x] 051 — Swap factories + 5 fixtures (WEF-11b)
- [x] 052 — Performance + accessibility foundation gate (WEF-12)
- [x] 053 — Migrate scenes + close foundation (WEF-13)

**Gameplay continuation:**

- [x] 054 Quests · [x] 055 Civic projects · [x] 056 Festivals I · [x] 057 Festivals II ·
  [x] 058 Mail/news · [x] 059 Cooking · [ ] 060 Home/decor · [ ] 061 Audio · [ ] 062 Visual polish I ·
  [ ] 063 Visual polish II · [ ] 064 NPC expansion · [ ] 065 Narrative · [ ] 066 Secrets ·
  [ ] 067 Save migration · [ ] 068 Mobile · [ ] 069 Controller · [ ] 070 Accessibility ·
  [ ] 071 Test suite · [ ] 072 Balancing · [ ] 073 Authoring guide · [ ] 074 Alpha · [ ] 075 Beta ·
  [ ] 076 RC

## 8. Phase + project completion criteria

The **foundation block** is complete only when all of 028–053 are checked, the exact camera profiles +
input behavior are proven across the required aspect ratios, the shared physics/traversal/interaction/
navigation/fauna/flora tiers are integrated (not pure modules), **horseback traversal works end to end
across the Klam-ity River community-to-community transition**, all five production-foundation maps are
playable through normal transitions and pass the Prompt 052 gate, the world atlas + metric kit are
authoritative, finished assets can replace grayboxes through validated factories without changing
collision/navigation/anchors/save identity/scale, existing gameplay remains functional + migrated, docs
+ roadmap agree, the worktree has no accidental changes to protected user files, and no push occurred
unless explicitly requested.

The **project** is complete at Prompt 076: a release candidate passing all tests, healthy Lighthouse/PWA
basics, no known save-destroying bugs, and complete credits/licenses — with the §11 quality checklist of
`STURDY_VOLLEY_PSPR.md` satisfied.

## 9. Approval record

- Draft created: 2026-06-19 (folds the WEF draft + legacy roster into one continuous count)
- Structural decisions locked by user 2026-06-19: unified master roster · split heavy WEF prompts only ·
  pack-until-2/3 session cadence
- Art direction folded in 2026-06-19 after a full `art-production/` review (§1.4): OoT-era stylization +
  redwood-meets-coast content, anti-painterly-drift, canonical protagonist, sports purge.
- World canon locked by user 2026-06-19: **Willa Crick (inland) + Ballast Bay (coastal)** as two
  communities joined by **The Klam-ity River**, selectable starting farms, **horseback** early-game
  traversal, **OoT-mirror** camera/transitions/controls. Narrative/quests/achievements deferred to a
  separate future session.
- Roster adjustments locked by user 2026-06-19: **dedicated Mount-system prompt (044)** + **split the
  river-corridor/cavern map into 048 + 049**; foundation block is now 028–053, project ends at 076.
- OoT-decomp guardrail added 2026-06-19 (§0.7): mirror OoT **feel**, never copy the `zeldaret/oot`
  decomp or `HarbourMasters/Shipwright` port source; engine built from neutral first-party sources.
- User review: **complete (2026-06-19)**
- Explicit approval: **GRANTED by user 2026-06-19** — this is the active P-SPR.
- STS authorization: **GRANTED**; execution began 2026-06-19 and ran per the §0.12 session protocol.
- **Foundation block (028–053): COMPLETE (2026-06-21, WEF-13).** All 26 foundation prompts shipped with
  green verify gates (see `DEVLOG.md`); the camera/motor/interaction/navigation/streaming/interior/
  map-data/fauna/flora/mount/asset stack is in place, the five production-foundation maps are playable
  through real region transitions, and the foundation gate (budgets/tiers/accessibility) is codified.
- **Gameplay continuation resumes at Prompt 054** on top of this foundation. The legacy gameplay scenes
  are preserved (migrated, not discarded — see `docs/ARCHITECTURE.md` "Migration status").
