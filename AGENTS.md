# Sturdy Volley — Codex Project Instructions

These instructions are project-local, persistent across Codex sessions opened in this
workspace, and load-bearing. Read them before planning or executing work.

## Canonical planning shorthand

- **P-SPR = Plan — Sequential Prompt Roster.** A single canonical `PLANNING/*.md`
  file that defines one phase end to end: goal, scope, non-goals, ordered prompts,
  files, verify gates, commit/devlog discipline, completion criteria, and approval
  state. Pasted or drafted text becomes a P-SPR only after it is saved as that plan
  file.
- **STS = Stem to Stern.** After the user explicitly approves a P-SPR or says to run
  it STS, execute the entire roster in order from its first unfinished prompt through
  phase wrap. Do not pause for approval between prompts. Verify, log, and commit each
  prompt exactly as the active P-SPR specifies. A plan's own “STS authorization” text
  does not approve itself. Do not skip prompts, batch prompts, push early, or reopen
  settled plan decisions unless genuinely blocked by new facts.

## Mandatory execution rules

1. Every prompt in an active plan must pass its verify gate—including both TypeScript
   configurations, relevant tests, and smoke checks—before it is marked `[x]` and
   committed.
2. Log every prompt's work in `DEVLOG.md` using the format defined by the active
   plan's §0 Step 4.
3. The user is the reviewer and pusher. When the user explicitly asks to push in any
   phrasing, execute the push on the first try; the request itself satisfies review.
   Never volunteer a push, push without being asked, or use `--force` without an
   explicit force-push instruction.
4. Parallel-track sessions must use separate Git worktrees. For multi-track plans,
   coordinate cross-track merge-hotspot files according to the active plan's protocol.
5. **Plan before work.** For non-trivial work: draft a robust plan with a sequential
   numbered prompt roster; present or save it as `PLANNING/*.md`; wait for explicit
   approval; then execute. Do not change code, build, or commit before approval.
   Trivial one-offs—single edits, questions, memory saves, and explicit single-command
   requests—are exempt.

## Existing project plan compatibility

The current legacy canonical plan is `STURDY_VOLLEY_PSPR.md`. Treat it as the active
P-SPR when the user explicitly identifies or approves it, even though it predates the
`PLANNING/*.md` convention. Its §0 execution rules remain binding where they are more
specific and do not conflict with direct user instructions.
