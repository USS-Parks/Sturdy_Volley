# Gameplay Interaction and Tool Targeting — Sturdy Volley

Last revised: 2026-06-20 (Prompt 034, WEF-03).
Normative for the shared one-button interaction + tool-targeting model. Units:
metres, seconds, radians.

## 1. Pipeline

`src/engine/interaction-targeting.ts` is the pure, deterministic resolver. It
separates interaction into stages so **every input method feeds the same resolver
and picks the same target**:

```
discovery → scoring → selection (+ hysteresis) → facing alignment →
action commitment (anticipation → impact → recovery, with a cancel window)
```

The legacy `resolveInteraction` (Prompt 005) stays for FarmScene until the 053
migration; this is the foundation resolver the proving ground + future scenes use.
Farming stays deterministic on the **1 m logical grid**: a `farm-cell` candidate
carries its `{col,row}` cell, never a render-mesh name.

Supported candidate kinds: farm cells, crops/soil, forage, props, doors, NPCs,
animals, machines, ore nodes, water entry, fishing, loose bodies, and traversal
links.

## 2. Scoring (`resolveTarget`)

A candidate is in contention when its planar distance ≤ `reach + maxReachSlack`.
Score (higher wins; ties break by proximity):

```
score = priority   × priorityWeight        // action priority
      + front       × facingWeight          // front = cos(angle between facing and heading-to-target), 1 = dead ahead
      − distance    × distanceWeight         // closer is better
      + (heldTool === requiresTool ? toolMatchBonus : 0)
      − (obstructed ? obstructionPenalty : 0)
      + (id === previousChosen ? hysteresisBonus : 0)   // sticky target, stops flicker
```

Default weights (`DEFAULT_TARGETING_CONFIG`):

| Weight | Value |
|---|---:|
| priorityWeight | 100 |
| facingWeight | 30 |
| distanceWeight | 10 / m |
| toolMatchBonus | 40 |
| obstructionPenalty | 60 |
| hysteresisBonus | 15 |
| maxReachSlack | 0.3 m |

The resolver returns the chosen id **plus** the full scored list, so the scene
can show a **focus treatment** (the proving ground snaps a ground-preview ring to
the chosen target) before the player commits.

## 3. Facing alignment

| Property | Value |
|---|---:|
| Turn-in-place threshold | **0.9 rad (~50°)** — `turnInPlaceNeeded`; commit turns to face first when the heading error exceeds this |
| Facing turn rate (commit) | **14 rad/s** in the proving ground (`faceTarget`, shortest-arc, reuses the motor's `turnToward`) |

Heading convention is `atan2(dx, dz)` — the same as the motor's `facing`, so the
player turns to face the exact chosen target before the effect lands.

## 4. Action lifecycle (`ActionTiming`)

One contextual button drives a four-phase timeline. The effect fires exactly once,
on the step the action crosses **into impact** (`impactFired`).

| Phase | Duration | Meaning |
|---|---:|---|
| Anticipation | **0.18 s** | wind-up; tool raised |
| Impact | **0.08 s** | effect executes (hit soil, open door, pick up, …) |
| Recovery | **0.22 s** | follow-through before control returns |
| Cancel window | **0.12 s** | the action may be cancelled this far into anticipation |

`beginAction` → `stepAction` (advances + reports `impactFired`) → back to `idle`
after recovery. `canCancel` is true only within the cancel window during
anticipation; `cancelAction` returns to idle with no effect.

## 5. Input parity + preserved outcomes

Because keyboard, controller, touch tap, and virtual-stick + action all build the
same `PlayerContext` (position + facing + held tool) and call the same
`resolveTarget`, they choose the **same** target for equivalent situations —
verified by the crowded NPC/animal/door and crop/forage/tool unit tests
(`tests/unit/interaction-targeting.test.ts`) and the proving-ground e2e. The
resolver only *selects + commits*; existing inventory, tool-hardness, stamina,
dialogue, animal, machine, and forage outcomes are unchanged (the effect executed
on impact is the existing system, wired per scene during the 053 migration).
