# Session Log

Every Claude Code session on Sturdy Volley writes one entry here at session end (or at the user's explicit "log this session" cue). Entries are append-only and exist for audit — if a future session, the user, or a reviewer needs to know what happened in a prior session, what was shipped, what was attempted but abandoned, or what's still open, the answer is here.

## Why this exists

`DEVLOG.md` is the prompt-level build journal — one entry per shipped P-SPR prompt. The session log is one level up: one entry per **conversation**, regardless of how many (or how few) prompts were touched. A session that landed three prompts gets one log entry that names them; a session that only discussed an approach and committed nothing also gets one entry.

## Filename

`YYYY-MM-DD-NN-short-title.md` where `NN` is a two-digit per-day sequence number (`01`, `02`, …) so two sessions on the same day don't collide.

Examples:
- `2026-06-19-01-claude-md-cleanup.md`
- `2026-06-19-02-rf-11-beach-fishing.md`

## Required sections

Each entry contains the following sections (`## `-level each). Skip none; if a section truly doesn't apply, write `N/A` with one sentence of why.

- **Operator** — Claude model + exact ID + the harness origin (Claude Code, Cowork, web, etc.).
- **Working folder** — absolute path the session ran in (worktree path, or repo root).
- **Branch** — git branch the session committed against. Note the `origin` if the working folder's git remote differs from the Sturdy Volley repo (e.g., parallel sessions running in repurposed worktrees).
- **Goal** — what the user asked for, in two to five sentences. Quote the user's directive verbatim where it was load-bearing.
- **Actions** — bulleted list of the substantive things the session did. Reference file paths and commit subjects. Don't paste full diffs; link to commits.
- **Verify gate** — result of the project verify gate per P-SPR §0.2 (typecheck · lint · Vitest count · Playwright count · `validate:assets` · `build`). If the session didn't run it, state why ("no source modified", "blocked before reaching gate", etc.).
- **Outcome** — exactly one of: `completed`, `partially completed` (name the remainder), `blocked` (name the reason), `handed off` (name the successor session's goal).
- **Open items** — bulleted list of follow-ups for the next session. Empty list is fine if truly none — write `- none`.

## Optional sections

- **Decisions** — non-obvious calls the session made that a future reader couldn't infer from the diff. Helpful when the "why" was discussed in chat but not captured in a commit message.
- **Parallel-session notes** — if another session was running concurrently, what was coordinated (merge-hotspot fences, file ownership, rebase points).

## Trim rules

Each entry should fit in roughly one screen of scrolled text. `DEVLOG.md` prompt-level entries are the source of truth for shipped work — session logs are about the *session*, not the prompt. If the session shipped three prompts, name them and link to the DEVLOG entries; don't duplicate the body.

## Privacy

Session logs are committed to the repo and visible to anyone with read access. Don't paste API keys, full chat transcripts, full system prompts, or private third-party output (PII, customer data, embargoed third-party design docs). Summaries and direct paraphrases are fine; verbatim transcript dumps are not.

## Authoring discipline

- The log entry is written by Claude at the end of the session, then the user (or Claude on explicit instruction) commits it.
- One entry per session. If a session is interrupted and resumed in a new conversation, the second conversation gets its own entry that references the first (`continues 2026-06-19-01`).
- Entries are append-only. Older entries are not edited after they ship except for typo / link fixes — for the same reason `DEVLOG.md` entries are append-only.
