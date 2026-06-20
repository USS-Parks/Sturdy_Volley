# Sturdy Volley — World Embodiment Foundation P-SPR

Prepared: 2026-06-19  
Status: **DRAFT — NOT APPROVED FOR EXECUTION**  
Phase shorthand: **WEF** (World Embodiment Foundation)  
Target: browser-first, mobile-ready, controller-friendly low-poly 3D cozy adventure  
Depends on: the systems already shipped through legacy Prompt 027  
Governing project instructions: `AGENTS.md`

## 0. Approval, authority, and execution protocol

### 0.1 What approval means

This file becomes the active phase P-SPR only after the user explicitly approves it
or explicitly instructs Codex to run it STS. Saving this draft does not approve it,
and text inside this plan cannot approve itself.

After approval, execute WEF-01 through WEF-13 in order, Stem-to-Stern (STS). Do not pause for approval
between prompts, skip prompts, batch their commits, push, or reopen a decision that
has already passed its named gate unless implementation reveals a genuinely new
blocking fact.

Until approval, no code, dependency, build configuration, test, map, asset, DEVLOG,
or commit work described here is authorized.

### 0.2 Relationship to the legacy P-SPR

`STURDY_VOLLEY_PSPR.md` remains the project-wide historical and product plan. While
this WEF phase is active:

- WEF-01 through WEF-13 take precedence over conflicting camera, controller,
  collision, navigation, world-scale, map-construction, and asset-swap assumptions
  in the legacy plan.
- Already-shipped gameplay systems are migrated, not discarded or reimplemented
  without cause.
- The next unfinished legacy feature prompt does not execute in parallel with WEF.
- WEF-13 reconciles the resulting contracts back into the architecture, scale, and
  legacy planning documents before the phase closes.

### 0.3 Worktree and existing-change safety

The planning inspection found unrelated uncommitted changes in:

- `STURDY_VOLLEY_IMAGE_PROMPT_ROSTER.md`
- `tools/local_gitdoctor_scan.py`

They belong to the user and are out of scope. Every WEF prompt must preserve them,
must stage explicit paths only, and must stop for the user if an unavoidable overlap
appears. Do not stash, revert, reformat, or commit those changes as part of WEF.

If parallel-track work is later authorized, each track must use its own Git worktree.
This plan is sequential by default and does not authorize parallel implementation.

### 0.4 Per-prompt workflow

For every WEF prompt:

1. Re-read this prompt, its locked upstream decisions, and the current worktree.
2. Inspect the affected implementation and tests before editing.
3. Implement only that prompt's scope with integrated, visible behavior.
4. Run the full verify gate in §0.5 and the prompt-specific checks.
5. Add the DEVLOG entry described by §0.6.
6. Mark that prompt `[x]` in §6 only after every acceptance criterion is met.
7. Commit exactly that prompt using §0.7.
8. Continue immediately to the next unfinished prompt under STS authorization.

### 0.5 Verify gate

Every prompt must pass all applicable checks before completion:

1. Both strict TypeScript configurations pass. WEF-01 must establish explicit game
   and Node/tooling configurations because the repository currently has only one
   combined `tsconfig.json`; it must add scripts that execute both without weakening
   existing strictness. WEF-01 itself passes the new two-configuration gate before
   commit.
2. `npm run lint` exits 0.
3. `npm test` passes with no new skips.
4. `npm run validate:assets` exits 0.
5. `npm run build` exits 0 and produces `dist/`.
6. Relevant Playwright coverage passes on both `desktop-chromium` and
   `mobile-chromium`; prompts affecting shared navigation or scene lifecycle run the
   complete E2E suite.
7. `python tools/local_gitdoctor_scan.py --fail-on high` exits 0. The pre-existing
   user modification to that file remains untouched unless the user separately
   authorizes otherwise.
8. Visual prompts capture reproducible desktop and Pixel 5 evidence for their named
   profiles or environments. Evidence must show the player, relevant obstruction or
   interaction, HUD safe area, and active debug profile.
9. No prompt may relax an existing performance budget, test assertion, type rule,
   or accessibility requirement merely to pass.

When physics behavior cannot be asserted reliably through pixels, add deterministic
debug telemetry and test that contract. Manual-only checks are permitted only when
automation is genuinely impractical, and the DEVLOG must name the check, device,
result, and reason automation was not used.

### 0.6 DEVLOG discipline

Each completed prompt adds a new section at the top of `DEVLOG.md`:

`## WEF-NN — <title> (YYYY-MM-DD)`

Each entry contains:

- one short shipped-result paragraph;
- exact modules, scenes, data, documents, and tests touched;
- an **Acceptance criteria** subsection with one checked line per criterion;
- a **Decision record** subsection for locked measurements and rejected alternatives;
- a **Verify gate** line listing both TypeScript checks, lint, Vitest count,
  Playwright count/projects, asset validation, build, and GitDoctor result;
- visual/manual evidence notes where required;
- any approved budget waiver, with owner and recovery prompt.

DEVLOG history is append-only except for typo or broken-link corrections.

### 0.7 Commit and push discipline

- One commit per WEF prompt after its green gate and DEVLOG entry.
- Commit subject: `WEF-NN: <short summary>`.
- Stage explicit paths. Never use `git add .` or `git add -A`.
- Do not bypass hooks or signing.
- Do not amend an already-pushed commit.
- The user is the reviewer and pusher. Never push unless explicitly asked, and never
  force-push without an explicit force-push instruction.

## 1. Locked creative and technical doctrine

These decisions are approved inputs to the plan. WEF-01 measures and records their
exact parameters; it does not reopen their underlying direction.

### 1.1 Camera family

- The game uses a **hybrid third-person adventure camera**.
- The full player character remains visible during ordinary gameplay.
- Outdoors use an elevated chase camera with constrained orbit, automatic recentering,
  collision avoidance, and stable horizon behavior.
- Interiors use closer authored camera volumes with selective obstruction fading or
  cutaway treatment.
- Farming and other precision activities raise and stabilize the view subtly.
- Caves and combat lower and tighten the view without becoming an over-the-shoulder
  aiming game.
- Movement is camera-relative. Tools, conversations, pickups, doors, animals, and
  other actions use deliberate character-facing and alignment rules.
- There is no unrestricted jump button. Traversal uses contextual vault, climb,
  wade, swim, mount/dismount, doorway, and elevation-link actions.

### 1.2 Physical-simulation doctrine

"True physics" means believable, stable, consistent physical behavior at gameplay
scale. It does not mean making every visible object a dynamic rigid body.

- Player and NPCs use a kinematic capsule motor with gravity, grounding, slopes,
  stairs, stable collision, pushing, and recovery.
- Domestic animals and wild fauna inherit the physical foundation but use
  species-appropriate bodies, locomotion, navigation, and transitions.
- Flora uses authored wind, bend, impact, growth, harvest, and seasonal responses;
  simulation is reserved for close interactions that benefit visibly.
- Loose gameplay props use pooled rigid bodies with sleep, bounds recovery, and
  deterministic save-state rules.
- Terrain and buildings use simple invisible collision proxies, never render-mesh
  collision as the production default.
- Farming retains deterministic one-meter logical cells beneath freely authored 3D
  terrain and visible soil geometry.

### 1.3 World and asset doctrine

- One world unit remains one meter.
- Graybox maps built in this phase are production spatial foundations, not disposable
  mockups. Finished art replaces visible meshes without changing approved metrics,
  anchors, collision, navigation, or camera intent.
- World regions are modular and streamable. Interiors may be separate scene spaces;
  exterior seams and transitions must feel intentional rather than arbitrary.
- Render meshes, collision proxies, navigation surfaces, interaction anchors, camera
  volumes, spawn points, audio zones, and streaming bounds remain separate concerns.
- Originality rules in the legacy P-SPR remain absolute. The game may learn from the
  physical presence of older 3D adventures but may not copy their maps, characters,
  symbols, props, camera scripts, or visual identity.

## 2. Camera hypotheses to test, not silently assume

WEF-01 must test at least three parameter variants around the ranges below and lock
one baseline per context. Babylon arc angles must be documented both as engine values
and as human-readable degrees of downward view.

| Context | Downward view | Follow distance | Vertical FOV | Behavioral hypothesis |
|---|---:|---:|---:|---|
| Exterior exploration | 28–35° | 8–11 m | 45–50° | bounded manual orbit; delayed auto-recenter |
| Farm/precision | 38–46° | 8–10 m | 43–48° | damped yaw; stable cell visibility |
| Small interior | 35–45° | 5–7 m | 48–55° | authored volume; wall fade/cutaway |
| Large public interior | 30–40° | 7–9 m | 45–52° | authored target offsets and room transitions |
| Cave exploration/combat | 20–29° | 6–8 m | 48–55° | tighter framing; faster obstruction response |
| Contextual swim/wade | 25–34° | 8–10 m | 46–52° | horizon and shore remain legible |

The following are required decisions, not predetermined answers:

- orbit yaw limits and whether the bounds follow character heading or authored world
  heading;
- recenter delay, angular speed, acceleration, and user-input grace period;
- look-ahead distance by gait;
- character screen-space anchor and mobile safe-area limits;
- near/far clip bands, obstruction probe shape, fade threshold, and recovery speed;
- camera behavior at sharp corners, roofs, doorways, slopes, cliffs, water, large
  animals, conversations, tool charge, cutscenes, and scene transitions;
- right-stick, mouse-drag, touch-drag, recenter-button, and reduced-motion behavior.

No production map metric may be finalized before this camera gate is complete.

## 3. World-map deliverables and scope boundary

This phase creates the physical foundation for the real Sturdy Coast world.

### 3.1 Playable production-foundation maps delivered in WEF

1. Breakpoint Farm exterior.
2. A representative, expandable Ballast Bay town district including market lane,
   harbor approach, and at least one elevation change.
3. Farmhouse interior.
4. A coast connector combining path, shoreline, shallow water, cliff, and transition.
5. A cavern slice combining tight passage, open room, slope/stair, ledge link, and
   combat/navigation space.

These maps must be playable with the final camera, motor, metrics, collision proxies,
navigation surfaces, camera volumes, interaction anchors, and transition format.

### 3.2 Authoritative atlas specifications delivered in WEF

The world atlas covers every named core region:

- Breakpoint Farm
- Ballast Bay Town
- Netlight Point
- Driftwood Beach
- Kelpglass Reefs
- Belltide Marsh
- Ironroot Quarry
- Rainhall Caverns
- Splitwind Ridge
- Outer Islets

For each, record purpose, approximate footprint, elevation bands, entrances/exits,
adjacent regions, sightline landmark, traversal vocabulary, activity density,
streaming cells, time/tide/season variants, required interiors, camera risks,
navigation risks, and production order. Atlas specification does not claim that all
ten finished-art regions are implemented during WEF.

### 3.3 Explicit non-goals

- Final character, animal, flora, building, or prop art.
- Final hand-painted textures, complete animation libraries, audio, VFX, or lighting
  polish.
- Full finished-art implementation of all ten world regions.
- Ragdoll player locomotion, unrestricted jumping, free climbing on arbitrary
  surfaces, or fully simulated vegetation fields.
- Networked multiplayer physics.
- Rebalancing economy, relationships, quests, calendar content, or narrative except
  where migration is necessary to preserve current behavior.

## 4. Cross-cutting engineering contracts

### 4.1 Coordinate frames and persistence

- Runtime world convention: Y-up, meters, and one documented forward-axis convention.
- Every region owns a stable local origin and region identifier.
- Saves store semantic anchors or stable entity identifiers wherever possible, not
  brittle render-mesh names.
- Cross-region transitions contain source anchor, destination anchor, facing, camera
  handoff, and fallback recovery data.
- Dynamic bodies save only gameplay-relevant state; decorative physical motion may
  reset safely on load.

### 4.2 Determinism boundary

- Schedules, spawn selection, harvest state, fauna intent, and saved prop outcomes
  remain deterministic from explicit state and seeds.
- Visual wind, secondary motion, particles, and harmless idle variation may be
  nondeterministic.
- Physics must not become the sole authority for economy, inventory, quest, crop, or
  relationship outcomes.

### 4.3 Simulation tiers

- **Tier 0 — abstract:** offscreen schedules, distant fauna, seasonal growth.
- **Tier 1 — visual:** visible but non-colliding wind, idle, and ambient motion.
- **Tier 2 — kinematic:** characters, animals, doors, authored traversal.
- **Tier 3 — dynamic:** nearby loose props and explicitly physical gameplay objects.
- **Tier 4 — hero event:** short, budgeted, authored physical set pieces.

Every entity family must declare its tier, activation radius or condition, sleep or
throttle behavior, save authority, and mobile fallback.

### 4.4 Shared debug surfaces

By phase end the game must expose development-only overlays for:

- camera profile, yaw/pitch/FOV/distance, obstruction state, and active volume;
- grounding, slope, step, velocity, capsule, and traversal-link state;
- interaction candidates, score, chosen target, facing target, and reach volume;
- streaming cell, region origin, transition anchors, collision proxies, and bounds;
- navigation mesh, path, local-avoidance intent, and recovery state;
- simulation tier, active/throttled entity counts, physics bodies, and performance.

Debug surfaces must be excluded or disabled by default in production play.

## 5. Sequential prompt roster

### WEF-01 — Camera and control doctrine plus proving ground

Build a dedicated camera proving ground before changing production-map dimensions.
It must include open ground, a farm grid, narrow lane, small room, large room, roof,
tree canopy, wall corner, slope, stairs, cliff, shallow water, doorway, NPC capsule,
animal body, interaction prop, and cave corridor. Add data-driven camera profiles and
runtime switching among at least three variants for each relevant context.

Also split the current combined TypeScript configuration into strict game and
Node/tooling configurations with a single command that runs both, preserving every
existing strictness rule.

Anticipated files:

- `docs/GAMEPLAY_CAMERA_AND_CONTROLS.md`
- `src/camera/` profile, rig, volume, obstruction, and input modules
- `src/scenes/CameraLabScene.ts`
- scene registry/debug navigation
- camera unit and Playwright specifications
- TypeScript configurations and package scripts

Acceptance criteria:

- The hybrid doctrine in §1.1 is visible and playable with keyboard/mouse,
  controller, and touch input paths.
- Exact selected values are recorded for every context in §2, including degree and
  Babylon representations.
- Constrained orbit, recenter grace, look-ahead, collision/occlusion response, and
  context blending are deterministic and tunable from profile data.
- Full character visibility and HUD-safe framing pass at desktop, tablet, Pixel 5,
  ultrawide, and tall-phone aspect ratios.
- Interior obstruction demonstrates both selective fade and cutaway candidates; the
  chosen rule and fallback are recorded.
- Reduced-motion mode removes camera impulses and uses conservative blend timing.
- Camera telemetry and reproducible screenshot routes exist.
- Both strict TypeScript configurations run in the verify gate.
- The decision record explains rejected alternatives and locks the baseline.

### WEF-02 — Player scale, kinematic motor, and contextual traversal

Replace scene-local planar movement with one reusable player motor. Integrate Havok
through a narrow adapter after verifying the current official Babylon/Havok APIs.
Use a kinematic capsule and explicit gameplay state rather than a dynamic ragdoll.

Implement grounding, gravity, acceleration, braking, turning, slope limit, sliding,
step offset, stairs, moving-platform contact contract, stable pushing, penetration
recovery, out-of-bounds recovery, wading, swimming entry/exit, and authored traversal
links for vault/climb/elevation transitions. There is no unrestricted jump.

Acceptance criteria:

- One motor produces the same core behavior in the proving ground on desktop and
  mobile frame-rate bands.
- Capsule dimensions, skin/contact offset, step height, slope limit, speeds,
  acceleration, braking, turn rates, gravity, buoyancy, and recovery thresholds are
  documented in meters and seconds.
- Slopes, stairs, corners, door thresholds, shore entry, water exit, moving contact,
  pushing, and low-ceiling cases do not jitter, tunnel, hover, or trap the player.
- Traversal links are contextual, cancellable where safe, and restore control without
  camera discontinuity.
- Save/load and region entry recover to a valid grounded pose and stable anchor.
- Motor logic has deterministic unit coverage; scene integration has desktop and
  mobile Playwright coverage.
- Existing stamina and gait behavior remain functional through the new adapter.

### WEF-03 — Interaction, facing, and tool-targeting model

Create a shared 3D interaction resolver that separates candidate discovery, scoring,
selection, facing alignment, action commitment, and effect execution. Preserve the
one-button contextual philosophy while making the chosen target visually predictable.

Support farm cells, crops, soil, forage, props, doors, NPCs, animals, machines, ore,
water, fishing, loose bodies, and traversal links. Farming remains deterministic on
the one-meter logical grid while visible targeting conforms to terrain.

Acceptance criteria:

- Candidate scoring includes distance, view/facing relevance, action priority,
  reachability, obstruction, held tool, and sticky-target hysteresis.
- A visible focus treatment and optional ground preview show the exact target before
  action commitment.
- Character facing, turn-in-place threshold, hand/tool alignment target, anticipation,
  impact event, recovery, and cancel window are documented.
- Farming mode selects logical cells reliably on slopes and near props without
  exposing grid implementation awkwardly.
- Touch tap, virtual stick plus action, keyboard, and controller choose the same
  target for equivalent situations.
- Crowded NPC/animal/door and crop/forage/tool cases have automated regression tests.
- Current inventory, tool hardness, stamina, dialogue, animal, machine, and forage
  outcomes remain intact.

### WEF-04 — Exterior topology, chunks, streaming, and coordinate frames

Define and implement the exterior world container before laying out full regions.
Choose chunk dimensions from measured camera visibility and mobile budgets. Separate
render chunks, collision proxies, navigation data, interaction anchors, spawn sets,
camera volumes, audio zones, and persistence identifiers.

Acceptance criteria:

- `docs/WORLD_TOPOLOGY_AND_STREAMING.md` records region, chunk, local-origin, seam,
  preload, unload, persistence, and transition contracts.
- A multi-chunk exterior test crosses seams without visible pop, collision gaps,
  camera snaps, NPC discontinuity, duplicate entities, or save-identity changes.
- Streaming uses hysteresis and an explicit memory/mesh/body budget rather than only
  distance from origin.
- Origin/coordinate strategy remains numerically stable across the planned world.
- Failure and slow-load states keep the player on valid ground with clear recovery.
- Tide, season, weather, and restoration variants can change chunk content without
  changing stable anchor identities.
- Debug overlay exposes chunk bounds, states, region origin, and active budgets.

### WEF-05 — Interior construction and authored camera volumes

Create a reusable interior kit for farmhouse rooms, shops, homes, public halls, and
cavern-like enclosed spaces. Interiors use metric modules but may break the exterior
footprint illusion when playability requires it; any such expansion is recorded.

Acceptance criteria:

- Interior modules define wall, floor, ceiling, doorway, window, stair, counter,
  furniture-clearance, interaction, and navigation dimensions.
- Camera volumes support profile override, target offset, yaw bounds, obstruction
  mode, blend boundary, priority, and safe fallback.
- Adjacent volumes blend without oscillation or rapid priority switching.
- Wall fade/cutaway never exposes a void without a deliberate backing treatment.
- Small-room, corridor, stair, crowded-shop, and large-hall tests keep the character
  and primary interaction readable on Pixel 5.
- Exterior/interior handoff preserves destination anchor, facing, camera intent,
  time, NPC state, and return path.
- Farmhouse construction becomes the reference implementation for WEF-10.

### WEF-06 — Map metric kit and complete Sturdy Coast atlas

Lock the spatial grammar only after camera, motor, topology, and interior findings are
known. Create a metric kit and an authoritative atlas for all ten core regions.

The kit must cover paths, desire lines, plazas, farm cells, beds, counters, doorways,
rooms, buildings, docks, bridges, fences, paddocks, trees, crop clearances, cliffs,
slopes, stairs, shorelines, wading bands, swim boundaries, cave corridors, encounter
rooms, transition thresholds, camera clearance, navigation clearance, and landmark
sightlines.

Acceptance criteria:

- `docs/world/METRIC_KIT.md` gives final dimensions, tolerances, rationale, and camera
  compatibility for every kit element.
- `docs/world/ATLAS.md` defines global adjacency and progression among all ten regions.
- Each region has an authoritative spatial sheet containing the fields in §3.2.
- Machine-readable map schemas validate coordinate frames, chunks, anchors, volumes,
  collision references, navigation references, variants, and transitions.
- Breakpoint Farm and the Ballast Bay district receive dimensioned top-down and
  elevation/blockout diagrams derived from the final kit.
- Every route supports player capsule, NPC, relevant animal body, camera clearance,
  and mobile legibility.
- No region layout copies the topology or landmark arrangement of another game.

### WEF-07 — NPC navigation, avoidance, schedules, and offscreen simulation

Replace direct waypoint interpolation with a navigation service that consumes baked
or generated navigation data, authored off-mesh links, doors, dynamic obstacles,
local avoidance, and deterministic recovery. Preserve schedule authority and use
abstract simulation outside active neighborhoods.

Acceptance criteria:

- At least four existing NPCs traverse exterior, doorway, interior, stair/slope, and
  schedule-transition cases using the shared motor/navigation contract.
- NPCs avoid the player and one another without permanent deadlock, doorway dancing,
  or pushing the player into invalid space.
- Door queues, temporary blockages, missed schedule time, navmesh loss, and stuck
  recovery have explicit policies.
- Offscreen simulation consumes no active character physics body and rejoins the
  visible world at a valid semantic anchor.
- Conversation alignment and schedule pausing/resumption remain correct.
- Navigation debug view shows mesh, path, next link, desired velocity, avoidance,
  active/abstract state, and recovery reason.
- Performance tests cover representative town population and mobile throttling.

### WEF-08 — Domestic-animal and wild-fauna movement families

Define body, motor, navigation, behavior, and simulation-tier families instead of a
single generic animal mover. At minimum cover small quadruped pet, grazing livestock,
  bird, shoreline crawler, swimming fauna, and cave creature.

Acceptance criteria:

- `docs/ANIMAL_AND_FAUNA_PHYSICS.md` defines scale, body proxy, gait bands, turning,
  slope/water capability, obstacle policy, interaction distance, animation needs,
  LOD/throttle, and save authority for each family.
- Existing pets and farm animals migrate without losing affection, feeding, produce,
  weather, or schedule behavior.
- Representative wild fauna demonstrate patrol/forage/flee/flock-or-group/swim or
  species-appropriate equivalents without requiring every animal to be dynamic.
- Animals respect fences, gates, water eligibility, cliffs, doors, navigation links,
  and recovery bounds.
- Player/animal and animal/animal contacts feel soft and stable, never explosive.
- Offscreen and distant fauna downgrade through declared tiers deterministically.
- Mobile population and active-skinned-body ceilings are measured and enforced.

### WEF-09 — Flora and environmental-motion tiers

Create a shared flora/environment motion system for grass, crops, shrubs, flowers,
trees, reeds, kelp, hanging nets, flags, shoreline foam, fog, and lightweight ambient
fauna effects. Use authored deformation and tiering; reserve physical bodies for
gameplay-relevant close interaction.

Acceptance criteria:

- `docs/FLORA_AND_ENVIRONMENT_MOTION.md` defines motion source, bend points, phase
  variation, interaction response, season/weather inputs, distance tiers, reduced-
  motion behavior, and mobile fallback for each family.
- Wind has coherent direction and gust timing while repeated plants avoid lockstep.
- Player, tool, animal, weather, harvest, and regrowth responses have clear ownership
  and do not alter deterministic crop or forage outcomes.
- Tree trunks/canopies, reeds/grass, crops, and shoreline vegetation demonstrate
  distinct believable responses in the coast and farm environments.
- Instancing/batching remains available; per-plant scripting is not the default.
- Reduced-motion and low-quality modes preserve gameplay cues.
- Performance tests enforce active deformation and draw-call ceilings.

### WEF-10 — Five production-foundation graybox environments

Build the five maps in §3.1 from the approved metric kit. These are the first real
spatial versions of their locations: gray visible geometry over production collision,
navigation, anchor, camera-volume, streaming, and transition data.

Acceptance criteria:

- Farm, town district, farmhouse, coast connector, and cavern are reachable through
  ordinary gameplay transitions and use the shared camera/motor/interaction stack.
- Each map demonstrates its required activities, elevation, traversal, camera, NPC or
  fauna, flora, and environmental-motion cases.
- Map boundaries read as geography or architecture, not invisible arbitrary walls.
- Critical routes and landmarks remain legible without a minimap at phone scale;
  accessibility navigation aids may supplement but not rescue confusing layout.
- Collision proxies, nav surfaces, interaction anchors, camera volumes, and render
  meshes can each be toggled in debug view.
- Farm/town save identities and shipped gameplay loops survive migration.
- Automated tours exercise every transition and representative interaction on both
  Playwright projects.
- Each map stays inside the approved WEF-12 budgets before art replacement begins.

### WEF-11 — Wireframes, rigs, collision assets, animation contracts, and swaps

Define the production asset contract against the working graybox systems. Create
reference manifests and validation fixtures, not a speculative library of final art.

Acceptance criteria:

- `docs/ASSET_AND_RIG_CONTRACT.md` defines meters, axes, transforms, origins, naming,
  materials, UVs, texture budgets, skeletons, sockets, LODs, collision proxies,
  animation clips/events, root-motion policy, bounds, and export rules.
- Character reference requirements include hero render, orthographic turnaround,
  wireframe/topology, UV/material sheet, scale comparison, collision view, skeleton,
  sockets, and movement/posture sheet.
- Equivalent family-specific requirements exist for NPCs, animals/fauna, flora,
  buildings, terrain modules, tools, machines, and loose props.
- Asset factories swap graybox render geometry for `.glb` content without replacing
  semantic anchors, collision, navigation, interaction, or save identifiers.
- Grayboxes remain available as development and asset-failure fallbacks.
- Validator rejects wrong scale, transforms, axes, missing clips/events, excessive
  materials/triangles, absent collision metadata, and invalid naming with actionable
  messages.
- A representative humanoid, animal, flora, building module, and loose-prop fixture
  prove the pipeline end to end.

### WEF-12 — Performance, accessibility, and objective foundation gate

Measure the complete foundation on desktop and target mobile, then codify budgets and
quality tiers. Do not defer accessibility or camera comfort until art polish.

Acceptance criteria:

- Budgets cover FPS/frame time, draw calls, triangles, active meshes, physics bodies,
  character motors, navigation agents, animated/skinned meshes, deforming flora,
  streamed memory, chunk transition time, and initial/region download size.
- Farm, town, farmhouse, coast, and cavern pass budgets on desktop and Pixel 5 test
  profiles with representative populations and effects.
- Quality tiers change density/effects, not interaction reach, collision, route
  availability, schedules, or simulation outcomes.
- Accessibility checks cover remapping, touch target size, camera sensitivity,
  separate X/Y inversion, recenter control, reduced motion, camera shake, hold/toggle,
  auto-facing assistance, high-contrast focus, subtitles, and no-time-pressure mode.
- Frame-rate variation tests demonstrate stable motor, camera, navigation, and
  interaction behavior.
- A single foundation-gate suite tours every environment, transition, camera context,
  traversal type, target type, NPC state, animal family, and simulation tier.
- `docs/SCALE_AND_PERFORMANCE.md` is updated from measured results and becomes the
  normative post-WEF budget document.

### WEF-13 — Migrate current scenes and close the foundation phase

Remove obsolete scene-local camera, movement, collision, and direct-navigation paths
only after their consumers have migrated. Reconcile documentation and planning so
future gameplay prompts build on one foundation.

Acceptance criteria:

- Farm, Town, Interior, Beach/coast, and Mine/cavern use shared camera, motor,
  interaction, transition, physics, navigation, map-data, and debug contracts where
  applicable.
- Existing save, farm, forage, crop, tool, machine, animal, pet, fishing, reef, mine,
  combat, shop, NPC, dialogue, friendship, cutscene, time, weather, and tide behavior
  has regression coverage and remains playable.
- Obsolete implementations are removed only when repository search proves no live
  consumer; compatibility adapters have named retirement criteria.
- `README.md`, `docs/ARCHITECTURE.md`, `docs/SCALE_AND_PERFORMANCE.md`, and the legacy
  P-SPR accurately describe the resulting foundation and next production-map phase.
- The world atlas identifies the next region build order and which graybox kits each
  region reuses.
- The full verify gate, full E2E suite, foundation gate, clean-install build, and
  production preview smoke test pass.
- A final DEVLOG phase summary lists locked decisions, measured budgets, remaining
  risks, deferred final-art work, and the exact next unfinished legacy/product prompt.

## 6. Completion checklist

- [ ] WEF-01 — Camera and control doctrine plus proving ground
- [ ] WEF-02 — Player scale, kinematic motor, and contextual traversal
- [ ] WEF-03 — Interaction, facing, and tool-targeting model
- [ ] WEF-04 — Exterior topology, chunks, streaming, and coordinate frames
- [ ] WEF-05 — Interior construction and authored camera volumes
- [ ] WEF-06 — Map metric kit and complete Sturdy Coast atlas
- [ ] WEF-07 — NPC navigation, avoidance, schedules, and offscreen simulation
- [ ] WEF-08 — Domestic-animal and wild-fauna movement families
- [ ] WEF-09 — Flora and environmental-motion tiers
- [ ] WEF-10 — Five production-foundation graybox environments
- [ ] WEF-11 — Wireframes, rigs, collision assets, animation contracts, and swaps
- [ ] WEF-12 — Performance, accessibility, and objective foundation gate
- [ ] WEF-13 — Migrate current scenes and close the foundation phase

## 7. Phase completion criteria

The WEF phase is complete only when:

1. All thirteen prompts are checked, individually verified, logged, and committed.
2. The exact camera profiles and input behavior are documented and proven across the
   required aspect ratios.
3. Shared character physics, traversal, interaction, navigation, fauna, and flora
   tiers are integrated rather than existing only as pure modules.
4. All five production-foundation maps are playable through normal transitions and
   pass the foundation gate.
5. The full ten-region Sturdy Coast atlas and metric kit are authoritative enough to
   build later regions without reinventing camera or spatial rules.
6. Finished assets can replace grayboxes through validated factories without changing
   collision, navigation, anchors, save identity, or gameplay scale.
7. Existing gameplay remains functional and migrated to the shared foundation.
8. Documentation and the legacy roadmap agree on the resulting architecture and the
   next phase.
9. The worktree contains no accidental changes to the user's pre-existing modified
   files.
10. No push has occurred unless the user explicitly requested it.

## 8. Approval record

- Draft created: 2026-06-19
- User review: pending
- Explicit approval: **not granted**
- STS authorization: **not granted**
- Execution may begin: **no**

