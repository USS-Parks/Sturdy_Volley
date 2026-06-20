#!/usr/bin/env python3
"""Local audit scanner for Sturdy Volley.

A pre-commit / pre-push static audit that mirrors the invariants
[STURDY_VOLLEY_PSPR.md](../STURDY_VOLLEY_PSPR.md) §0 expects every
prompt to honor:

- engine purity (pure modules under ``src/engine/`` + ``src/data/`` stay
  renderer-agnostic — no Babylon, no DOM, no localStorage)
- scene discipline (every scene that adds a ``keydown``/``keyup``
  listener also removes it on dispose, no dangling globals)
- UX guardrails (no blocking ``window.prompt/alert/confirm`` in src/)
- test discipline (no ``.only`` modifiers left in specs, no
  ``page.pause()``, no ``console.log``, every spec asserts at least once)
- type discipline (``as any`` budget, ``@ts-ignore`` requires a reason)
- originality (PSPR §0.7 — no copyrighted cozy-game franchise names in
  shipping code or data; docs and dev plans are exempt)
- save-model safety (schemas should add new fields as optional with a
  ``.default(...)``, never required, so old saves still load)
- project hygiene (.gitignore covers the right paths, no committed
  ``.env``, README + lock file present)
- package-script wiring (the full PSPR verify gate is callable via npm:
  typecheck, lint, test, test:e2e, validate:assets, build)
- PSPR / DEVLOG discipline (DEVLOG.md has a recent entry; the canonical
  plan + per-prompt log are present)
- security baseline (no hardcoded secrets, no private keys, no
  ``eval``/``new Function``, no raw ``innerHTML`` assignment)

The checks are heuristic. A finding means "look at this before you push",
not "the code is broken". False positives should be closed in code or
via a deliberate ignore (extend ``IGNORED_DIRS`` / ``IGNORED_FILES`` at
the top of this file), not by silencing the whole rule.

Run::

    python tools/local_gitdoctor_scan.py
    python tools/local_gitdoctor_scan.py --fail-on high       # CI mode
    python tools/local_gitdoctor_scan.py --format json --output .tmp/audit.json

Stdlib only. No network, no third-party deps, no model calls. Safe to
run from any worktree.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import subprocess
import sys
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


# --- File walker configuration -------------------------------------------

IGNORED_DIRS = {
    ".git",
    ".claude",                # parallel-session worktrees from other projects
    ".husky",
    ".idea",
    ".vscode",
    ".playwright-cache",
    ".pytest_cache",
    ".ruff_cache",
    ".tmp",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "playwright-report",
    "test-results",
}

# Files this scanner produces. Don't scan its own output.
IGNORED_FILES = {
    "tools/local_gitdoctor_scan.py",
    ".tmp/gitdoctor-report.md",
    ".tmp/gitdoctor-report.json",
    # Generated / large data the scanner has no useful opinion on.
    "package-lock.json",
}

CODE_EXTENSIONS = {
    ".cjs",
    ".js",
    ".jsx",
    ".mjs",
    ".ts",
    ".tsx",
}

TEXT_EXTENSIONS = CODE_EXTENSIONS | {
    ".css",
    ".env",
    ".example",
    ".html",
    ".json",
    ".md",
    ".ps1",
    ".sh",
    ".toml",
    ".txt",
    ".yaml",
    ".yml",
}

# Path slices that mark a file as test code.
TEST_NAME_RE = re.compile(r"(^|[\\/])(tests?|__tests__|specs?)[\\/]|(\.test\.|\.spec\.)")

# Where source code lives (relative to repo root, posix-style).
SOURCE_ROOTS = ("src/",)

# Pure-engine modules: must not import a renderer or hit the DOM/storage.
PURE_ENGINE_ROOTS = ("src/engine/", "src/data/")

# Where production scenes live.
SCENE_ROOT = "src/scenes/"

# Docs + planning surfaces — originality banlist is *not* enforced here
# (the project plan + DEVLOG legitimately compare against prior art).
DOC_ROOTS = (
    "AGENTS.md",
    "CLAUDE.md",
    "DEVLOG.md",
    "README.md",
    "SESSION_LOG/",
    "STURDY_VOLLEY_IMAGE_PROMPT_ROSTER.md",
    "STURDY_VOLLEY_PSPR.md",
    "docs/",
)


# --- Core types ----------------------------------------------------------


@dataclass(frozen=True)
class CheckDef:
    check_id: str
    category: str
    title: str
    severity: str  # CRITICAL | HIGH | MEDIUM | LOW
    description: str
    runner: str


@dataclass
class Finding:
    check_id: str
    category: str
    title: str
    severity: str
    description: str
    evidence: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, object]:
        return {
            "check_id": self.check_id,
            "category": self.category,
            "title": self.title,
            "severity": self.severity,
            "description": self.description,
            "evidence": self.evidence,
        }


@dataclass
class ScanContext:
    root: Path
    files: list[Path]
    text_by_file: dict[Path, str]
    lines_by_file: dict[Path, list[str]]
    tracked_files: set[str] = field(default_factory=set)

    def rel(self, path: Path) -> str:
        return path.relative_to(self.root).as_posix()

    def files_with_suffix(self, suffixes: Iterable[str]) -> list[Path]:
        suffix_set = set(suffixes)
        return [p for p in self.files if p.suffix in suffix_set]

    def code_files(self) -> list[Path]:
        return self.files_with_suffix(CODE_EXTENSIONS)

    def source_files(self) -> list[Path]:
        return [
            p for p in self.code_files()
            if any(self.rel(p).startswith(root) for root in SOURCE_ROOTS)
        ]

    def test_files(self) -> list[Path]:
        return [p for p in self.code_files() if TEST_NAME_RE.search(self.rel(p))]

    def doc_files(self) -> list[Path]:
        return [
            p for p in self.files
            if any(self.rel(p) == d or self.rel(p).startswith(d) for d in DOC_ROOTS)
        ]

    def is_tracked(self, path: Path) -> bool:
        if not self.tracked_files:
            return True
        return self.rel(path) in self.tracked_files


@dataclass
class ScanReport:
    root: str
    total_checks: int
    passed: int
    failed: int
    findings: list[Finding]
    category_scores: dict[str, dict[str, int]]

    @property
    def overall_score(self) -> int:
        if self.total_checks == 0:
            return 100
        return round(100 * self.passed / self.total_checks)

    def to_dict(self) -> dict[str, object]:
        return {
            "root": self.root,
            "overall_score": self.overall_score,
            "total_checks": self.total_checks,
            "passed": self.passed,
            "failed": self.failed,
            "category_scores": self.category_scores,
            "findings": [f.to_dict() for f in self.findings],
        }


# --- File walker ---------------------------------------------------------


def iter_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel_parts = path.relative_to(root).parts
        rel_name = path.relative_to(root).as_posix()
        if any(part in IGNORED_DIRS for part in rel_parts):
            continue
        if rel_name in IGNORED_FILES:
            continue
        if path.suffix not in TEXT_EXTENSIONS and path.name not in {
            ".env",
            ".gitignore",
            "Dockerfile",
            "Makefile",
            "package-lock.json",
            "README",
        }:
            continue
        files.append(path)
    return files


def git_tracked_files(root: Path) -> set[str]:
    try:
        completed = subprocess.run(
            ["git", "-C", str(root), "ls-files"],
            text=True,
            capture_output=True,
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired):
        return set()
    if completed.returncode != 0:
        return set()
    return {
        line.strip().replace("\\", "/")
        for line in completed.stdout.splitlines()
        if line.strip()
    }


def build_context(root: Path) -> ScanContext:
    root = root.resolve()
    text_by_file: dict[Path, str] = {}
    lines_by_file: dict[Path, list[str]] = {}
    files = iter_files(root)
    for path in files:
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        text_by_file[path] = text
        lines_by_file[path] = text.splitlines()
    return ScanContext(
        root=root,
        files=files,
        text_by_file=text_by_file,
        lines_by_file=lines_by_file,
        tracked_files=git_tracked_files(root),
    )


# --- Helpers -------------------------------------------------------------


def first_matches(
    ctx: ScanContext,
    pattern: str,
    *,
    files: Iterable[Path] | None = None,
    flags: int = 0,
    limit: int = 12,
) -> list[str]:
    regex = re.compile(pattern, flags)
    evidence: list[str] = []
    for path in files or ctx.files:
        for idx, line in enumerate(ctx.lines_by_file.get(path, []), start=1):
            if regex.search(line):
                evidence.append(f"{ctx.rel(path)}:{idx}  {line.strip()[:160]}")
                if len(evidence) >= limit:
                    return evidence
    return evidence


def has_any(
    ctx: ScanContext,
    pattern: str,
    *,
    files: Iterable[Path] | None = None,
    flags: int = 0,
) -> bool:
    return bool(first_matches(ctx, pattern, files=files, flags=flags, limit=1))


def finding(defn: CheckDef, evidence: list[str] | None = None) -> Finding:
    return Finding(
        check_id=defn.check_id,
        category=defn.category,
        title=defn.title,
        severity=defn.severity,
        description=defn.description,
        evidence=evidence or [],
    )


def is_comment_line(line: str) -> bool:
    s = line.lstrip()
    return s.startswith(("//", "/*", "*", "#"))


def source_files_outside_tests(ctx: ScanContext) -> list[Path]:
    return [
        p for p in ctx.source_files()
        if not TEST_NAME_RE.search(ctx.rel(p))
    ]


# ========================================================================
# CHECK RUNNERS
# ========================================================================
#
# Each runner takes (CheckDef, ScanContext) and returns a list of Finding
# (empty list = pass). Naming convention: `<category>_<short_name>` so the
# CHECKS catalog below can resolve the runner by name via globals().
#
# ========================================================================


# --- Engine purity --------------------------------------------------------

def eng_no_babylon_in_pure_modules(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """Pure engine modules must stay renderer-agnostic.

    ``src/engine/`` is the deterministic game logic; ``src/data/`` is the
    static catalog. Either importing ``@babylonjs/core`` would couple the
    test surface (vitest, no DOM) to the renderer and slow / break unit
    tests. The render layer lives in ``src/scenes/`` + ``src/render/``.
    """
    pure_files = [
        p for p in ctx.source_files()
        if any(ctx.rel(p).startswith(root) for root in PURE_ENGINE_ROOTS)
    ]
    return [finding(defn, ev)] if (ev := first_matches(
        ctx, r"from\s+['\"]@babylonjs", files=pure_files
    )) else []


# Filenames inside src/engine/ that legitimately bridge to the DOM /
# browser-storage layer. Keep this list short and reviewed.
ENGINE_BRIDGE_FILES = {
    "save.ts",          # localStorage-backed save store
    "saveStore.ts",     # alias if/when it lands
    "saveTransfer.ts",  # download/upload via blob + anchor + file input
}


def eng_no_dom_in_pure_modules(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """Pure engine modules must not touch the DOM.

    A small allow-list of save-bridge files is exempt because they're
    the deliberate browser-storage / file-transfer surface.
    """
    pure_files = [
        p for p in ctx.source_files()
        if any(ctx.rel(p).startswith(root) for root in PURE_ENGINE_ROOTS)
        and p.name not in ENGINE_BRIDGE_FILES
    ]
    return [finding(defn, ev)] if (ev := first_matches(
        ctx,
        r"\b(document|window)\s*\.\s*(getElementById|querySelector"
        r"|createElement|addEventListener|location|history)\b",
        files=pure_files,
    )) else []


def eng_no_storage_in_pure_modules(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """Pure engine modules must not read/write storage directly.

    The save pipeline (``save.ts``, ``saveTransfer.ts``) is the
    legitimate exception; other engine modules should receive state via
    parameters, not reach into ``localStorage`` themselves.
    """
    pure_files = [
        p for p in ctx.source_files()
        if any(ctx.rel(p).startswith(root) for root in PURE_ENGINE_ROOTS)
        and p.name not in ENGINE_BRIDGE_FILES
    ]
    return [finding(defn, ev)] if (ev := first_matches(
        ctx, r"\blocalStorage\s*\.\s*(getItem|setItem|removeItem|clear)\b",
        files=pure_files,
    )) else []


# --- Scene discipline -----------------------------------------------------

def scn_keydown_paired_with_removal(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """Every scene that adds a window keydown/keyup must remove it on dispose.

    Leaked listeners pile up across scene transitions and cause input
    cross-talk (e.g., FarmScene's 'i' firing while in TownScene).
    """
    evidence: list[str] = []
    for path in ctx.code_files():
        rel = ctx.rel(path)
        if not rel.startswith(SCENE_ROOT):
            continue
        text = ctx.text_by_file.get(path, "")
        add_re = re.compile(
            r"window\s*\.\s*addEventListener\s*\(\s*['\"](keydown|keyup)['\"]"
        )
        rm_re = re.compile(
            r"window\s*\.\s*removeEventListener\s*\(\s*['\"](keydown|keyup)['\"]"
        )
        adds = {m.group(1) for m in add_re.finditer(text)}
        removes = {m.group(1) for m in rm_re.finditer(text)}
        missing = adds - removes
        if missing:
            evidence.append(
                f"{rel}  adds {sorted(adds)} but removes only {sorted(removes)}"
            )
    return [finding(defn, evidence)] if evidence else []


def scn_listener_owners_override_dispose(
    defn: CheckDef, ctx: ScanContext,
) -> list[Finding]:
    """Scenes that addEventListener on window must override dispose().

    GameScene supplies a default ``dispose()`` that subclasses inherit,
    but any scene that wires its own window-level listener must override
    it to take responsibility for removal. SCN-001 catches the keydown
    case specifically; this check is broader (any window event).
    """
    evidence: list[str] = []
    for path in ctx.code_files():
        rel = ctx.rel(path)
        if not rel.startswith(SCENE_ROOT):
            continue
        text = ctx.text_by_file.get(path, "")
        if not re.search(r"window\s*\.\s*addEventListener\s*\(", text):
            continue
        # Look for an explicit dispose() override on the scene class.
        if re.search(r"\b(override\s+)?dispose\s*\(\s*\)\s*:", text):
            continue
        evidence.append(
            f"{rel}  adds a window listener but does not override dispose()"
        )
    return [finding(defn, evidence)] if evidence else []


# --- UX guardrails --------------------------------------------------------

def ux_no_blocking_dialogs(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """No window.prompt / alert / confirm in shipping src/.

    They block the engine update loop and don't work in our headless
    Playwright runs. UX prompts live in ``src/ui/overlay.ts`` (modal panels).
    """
    files = source_files_outside_tests(ctx)
    return [finding(defn, ev)] if (ev := first_matches(
        ctx, r"\bwindow\s*\.\s*(prompt|alert|confirm)\s*\(", files=files,
    )) else []


# --- Test discipline ------------------------------------------------------

def tst_no_only_modifier(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """No `.only(` modifiers left in spec files.

    Playwright + vitest both honor ``.only`` and silently exclude every
    other test. A merged ``.only`` will gut the whole CI suite.
    """
    return [finding(defn, ev)] if (ev := first_matches(
        ctx,
        r"\b(test|it|describe)\s*\.\s*only\s*\(",
        files=ctx.test_files(),
    )) else []


def tst_no_page_pause(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """No ``await page.pause()`` left in spec files — hangs CI forever."""
    return [finding(defn, ev)] if (ev := first_matches(
        ctx, r"\bpage\s*\.\s*pause\s*\(", files=ctx.test_files(),
    )) else []


def tst_no_console_noise(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """No console.log/warn/error in tests — clutters CI output."""
    return [finding(defn, ev)] if (ev := first_matches(
        ctx, r"\bconsole\s*\.\s*(log|warn|error|debug)\s*\(",
        files=ctx.test_files(),
    )) else []


def tst_specs_have_assertions(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """Every spec file asserts at least once.

    A spec that just calls into the app without asserting passes
    trivially and tells us nothing.
    """
    evidence: list[str] = []
    assertion_re = re.compile(
        r"\b(expect|assert|toBe|toEqual|toContain|toHaveText|toBeVisible)\b"
    )
    for path in ctx.test_files():
        text = ctx.text_by_file.get(path, "")
        if not assertion_re.search(text):
            evidence.append(f"{ctx.rel(path)}  no assertion calls")
    return [finding(defn, evidence)] if evidence else []


# --- Type discipline ------------------------------------------------------

def typ_as_any_budget(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """`as any` budget across non-test source.

    Tests sometimes need ``as any`` to construct window typings — exempt.
    Production source should generally not.
    """
    budget = 10  # tightenable as the codebase matures
    files = [p for p in ctx.source_files() if not TEST_NAME_RE.search(ctx.rel(p))]
    matches = first_matches(ctx, r"\bas\s+any\b", files=files, limit=200)
    if len(matches) <= budget:
        return []
    # Report the budget overrun + first few examples for context.
    head = matches[:8]
    head.append(f"… {len(matches) - len(head)} more `as any` site(s)")
    return [finding(defn, [f"{len(matches)} `as any` sites in src/ (budget {budget})", *head])]


def typ_ts_ignore_needs_reason(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """`@ts-ignore` / `@ts-expect-error` must come with a reason comment.

    A bare ``// @ts-ignore`` rots silently. Require either an inline
    explanation on the same line or a comment on the following line.
    """
    evidence: list[str] = []
    pattern = re.compile(r"@ts-(ignore|expect-error)\s*(.*)$")
    for path in ctx.code_files():
        lines = ctx.lines_by_file.get(path, [])
        for idx, line in enumerate(lines, start=1):
            m = pattern.search(line)
            if not m:
                continue
            inline_reason = m.group(2).strip(" -:")
            if inline_reason:
                continue
            # Allow a same-block preceding comment line.
            prev = lines[idx - 2] if idx >= 2 else ""
            if re.search(r"//\s*\S", prev):
                continue
            evidence.append(f"{ctx.rel(path)}:{idx}  {line.strip()[:160]}")
    return [finding(defn, evidence[:12])] if evidence else []


# --- Originality (PSPR §0.7) ----------------------------------------------

# Names from franchises Sturdy Volley intentionally does NOT copy from.
# Docs / DEVLOG / PSPR are exempt (they may reference prior art).
COPYRIGHTED_NAMES = [
    # Stardew Valley
    r"\bStardew\b",
    r"\bConcernedApe\b",
    r"\bPelican Town\b",
    r"\bJojaMart\b",
    r"\bCindersap\b",
    r"\bMarnie\b",
    r"\bMayor Lewis\b",
    r"\bAbigail\b",
    r"\bShane\b",
    r"\bLeah\b",
    r"\bMaru\b",
    r"\bPenny\b",
    r"\bHaley\b",
    r"\bSebastian\b",
    r"\bSam\b",
    r"\bElliott\b",
    r"\bHarvey\b",
    r"\bAlex\b",
    # Animal Crossing
    r"\bAnimal Crossing\b",
    r"\bTom Nook\b",
    r"\bIsabelle\b",
    r"\bK\.?K\.? Slider\b",
    r"\bNookazon\b",
    # Harvest Moon / Story of Seasons
    r"\bHarvest Moon\b",
    r"\bStory of Seasons\b",
    r"\bBokujou Monogatari\b",
    # N64-era franchise names (we evoke the *era*, not these games)
    r"\bOcarina of Time\b",
    r"\bBanjo[- ]Kazooie\b",
    r"\bConker\b",
    r"\bMario Kart\b",
    r"\bSuper Mario\b",
]

_COPYRIGHTED_RE = re.compile("|".join(COPYRIGHTED_NAMES), re.IGNORECASE)


def ori_no_copyrighted_names_in_shipping_code(
    defn: CheckDef, ctx: ScanContext,
) -> list[Finding]:
    """No copyrighted cozy-game franchise names in shipping code/data.

    Per [PSPR](../STURDY_VOLLEY_PSPR.md) §0.7. Docs, dev-log, image
    roster, and SESSION_LOG/ may reference prior art — they're filtered
    out via DOC_ROOTS. Shipping code (src/, public/, tests/) must not.
    """
    doc_paths = {ctx.rel(p) for p in ctx.doc_files()}
    evidence: list[str] = []
    scan_paths = []
    for p in ctx.files:
        rel = ctx.rel(p)
        if rel in doc_paths:
            continue
        if any(rel.startswith(d) for d in DOC_ROOTS):
            continue
        if rel.startswith(SOURCE_ROOTS) or rel.startswith(("public/", "tests/")):
            scan_paths.append(p)
    for path in scan_paths:
        for idx, line in enumerate(ctx.lines_by_file.get(path, []), start=1):
            if is_comment_line(line):
                # Allow comparisons in code comments (e.g., "unlike Stardew, …").
                continue
            if _COPYRIGHTED_RE.search(line):
                evidence.append(f"{ctx.rel(path)}:{idx}  {line.strip()[:160]}")
                if len(evidence) >= 12:
                    return [finding(defn, evidence)]
    return [finding(defn, evidence)] if evidence else []


# --- Save-model safety ----------------------------------------------------

def save_version_exported(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """src/engine/saveModel.ts must export a numeric SAVE_VERSION literal.

    Catches the migration footgun where someone changes the schema shape
    but forgets to bump the version constant — old saves then load into
    the new shape and the validator either crashes mid-game or silently
    misinterprets data.

    The pure-fields-without-defaults check this replaces was too noisy:
    nested object schemas have required fields by design, and a static
    line-by-line scan can't tell which are root-save fields vs. nested.
    A SAVE_VERSION presence check is the single high-signal invariant
    the file's contract guarantees.
    """
    target = ctx.root / "src" / "engine" / "saveModel.ts"
    if not target.exists():
        return []  # file doesn't exist — nothing to gate
    text = target.read_text(encoding="utf-8", errors="replace")
    if not re.search(
        r"export\s+const\s+SAVE_VERSION\s*[:=][^=\n]*\d+", text,
    ):
        return [finding(defn, [
            "src/engine/saveModel.ts  no `export const SAVE_VERSION = <n>;` "
            "literal found",
        ])]
    # Sanity: the root schema literals should reference SAVE_VERSION.
    if "SAVE_VERSION" not in re.sub(
        r"export\s+const\s+SAVE_VERSION\s*[:=][^;]*;", "", text,
    ):
        return [finding(defn, [
            "src/engine/saveModel.ts  SAVE_VERSION is exported but never "
            "referenced from a schema — likely a dead constant",
        ])]
    return []


# --- Project hygiene ------------------------------------------------------

def prj_no_committed_env(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    evidence = [ctx.rel(p) for p in ctx.files if p.name == ".env"]
    return [finding(defn, evidence)] if evidence else []


def prj_gitignore_covers_basics(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    gitignore = ctx.root / ".gitignore"
    if not gitignore.exists():
        return [finding(defn, [".gitignore  no .gitignore at repo root"])]
    text = gitignore.read_text(encoding="utf-8", errors="replace")
    required = ["node_modules", ".env", "dist", "playwright-report", "test-results"]
    missing = [pat for pat in required if pat not in text]
    return (
        [finding(defn, [f".gitignore  missing: {', '.join(missing)}"])]
        if missing else []
    )


def prj_readme_present(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    has_readme = any(p.name.lower() in {"readme", "readme.md"} for p in ctx.files)
    return [] if has_readme else [finding(defn, ["No README file found."])]


def prj_lockfile_present(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """package.json must be paired with a tracked lock file.

    Checks `git ls-files` directly so this is unaffected by which lock
    file paths the scanner has chosen to ignore in IGNORED_FILES.
    """
    has_pkg = (ctx.root / "package.json").exists()
    if not has_pkg:
        return []
    locks = {"package-lock.json", "pnpm-lock.yaml", "yarn.lock"}
    tracked_locks = {Path(p).name for p in ctx.tracked_files if Path(p).name in locks}
    if tracked_locks:
        return []
    return [finding(defn, [
        "package.json present but no tracked lock file "
        "(checked git ls-files for package-lock.json / pnpm-lock.yaml / yarn.lock)",
    ])]


# --- Package-script wiring ------------------------------------------------

PSPR_VERIFY_SCRIPTS = ("typecheck", "lint", "test", "test:e2e", "validate:assets", "build")


def pkg_verify_scripts_present(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """All PSPR §0.2 verify-gate scripts must be wired in package.json."""
    pkg = ctx.root / "package.json"
    if not pkg.exists():
        return []
    try:
        data = json.loads(pkg.read_text(encoding="utf-8", errors="replace"))
    except json.JSONDecodeError as exc:
        return [finding(defn, [f"package.json  parse error: {exc}"])]
    scripts = data.get("scripts") or {}
    missing = [s for s in PSPR_VERIFY_SCRIPTS if s not in scripts]
    return (
        [finding(defn, [f"package.json missing script(s): {', '.join(missing)}"])]
        if missing else []
    )


def pkg_tsconfig_strict(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    tsc = ctx.root / "tsconfig.json"
    if not tsc.exists():
        return [finding(defn, ["tsconfig.json  not found"])]
    text = tsc.read_text(encoding="utf-8", errors="replace")
    if '"strict"' in text and not re.search(r'"strict"\s*:\s*false', text):
        return []
    return [finding(defn, ["tsconfig.json  strict mode missing or set to false"])]


# --- PSPR / DEVLOG discipline ---------------------------------------------

def pspr_plan_present(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    pspr = ctx.root / "STURDY_VOLLEY_PSPR.md"
    return [] if pspr.exists() else [finding(defn, ["STURDY_VOLLEY_PSPR.md  missing"])]


def pspr_devlog_present(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    devlog = ctx.root / "DEVLOG.md"
    return [] if devlog.exists() else [finding(defn, ["DEVLOG.md  missing"])]


def pspr_devlog_has_recent_entry(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """DEVLOG.md should have at least one `## ` heading.

    Doesn't try to parse dates — the value is making sure prompts are
    being logged at all, not that the log is freshly stamped (each
    session's commits will refresh it).
    """
    devlog = ctx.root / "DEVLOG.md"
    if not devlog.exists():
        return []  # covered by pspr_devlog_present
    text = devlog.read_text(encoding="utf-8", errors="replace")
    headings = [
        line for line in text.splitlines()
        if line.startswith("## ") and "Sturdy Volley" not in line
    ]
    return (
        [] if headings
        else [finding(defn, ["DEVLOG.md  no `## Prompt …` entries found"])]
    )


# --- Security baseline ----------------------------------------------------

def sec_hardcoded_secrets(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """Flag long alphanumeric string literals assigned to secret-ish keys.

    Conservative: requires the LHS to be a recognized secret keyword and
    the RHS to look like a real token (length ≥ 16, not an env-var name,
    not an obvious placeholder).
    """
    regex = re.compile(
        r"(?i)(api[_-]?key|secret|token|password|auth_?token)\s*[:=]\s*['\"]"
        r"([A-Za-z0-9_\-]{16,})"
    )
    evidence: list[str] = []
    for path in ctx.files:
        for idx, line in enumerate(ctx.lines_by_file.get(path, []), start=1):
            m = regex.search(line)
            if not m:
                continue
            value = m.group(2)
            # Env-var references like `API_KEY = process.env.API_KEY` get
            # matched if the literal contains the env name — filter those.
            if re.fullmatch(r"[A-Z][A-Z0-9_]+", value):
                continue
            if value.lower().startswith(
                ("example", "placeholder", "replace-me", "your-", "test-")
            ):
                continue
            evidence.append(f"{ctx.rel(path)}:{idx}  {line.strip()[:160]}")
            if len(evidence) >= 8:
                return [finding(defn, evidence)]
    return [finding(defn, evidence)] if evidence else []


def sec_no_private_keys(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    return [finding(defn, ev)] if (ev := first_matches(
        ctx, r"-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----",
    )) else []


def sec_no_dynamic_execution(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """eval / new Function() in shipping code."""
    files = source_files_outside_tests(ctx)
    return [finding(defn, ev)] if (ev := first_matches(
        ctx, r"\b(eval\s*\(|new\s+Function\s*\()", files=files,
    )) else []


def sec_no_inner_html_assignment(defn: CheckDef, ctx: ScanContext) -> list[Finding]:
    """Direct ``.innerHTML = ...`` assignment in shipping code.

    DOM building in this project goes through ``src/ui/overlay.ts`` which
    uses ``document.createElement`` + ``textContent`` — XSS-safe by
    construction. Read access (e.g., ``el.innerHTML`` on the RHS) is fine.
    """
    files = source_files_outside_tests(ctx)
    return [finding(defn, ev)] if (ev := first_matches(
        ctx,
        r"\.\s*(innerHTML|outerHTML)\s*=\s*[^=]",
        files=files,
    )) else []


# ========================================================================
# CHECKS catalog
# ========================================================================

CHECKS: list[CheckDef] = [
    # Engine purity
    CheckDef(
        "ENG-001", "Engine Purity",
        "Pure modules import @babylonjs/core",
        "HIGH",
        "src/engine/ and src/data/ must stay renderer-agnostic so unit "
        "tests run without a WebGL context.",
        "eng_no_babylon_in_pure_modules",
    ),
    CheckDef(
        "ENG-002", "Engine Purity",
        "Pure modules touch the DOM",
        "HIGH",
        "src/engine/ and src/data/ must not call document.* or "
        "window.addEventListener.",
        "eng_no_dom_in_pure_modules",
    ),
    CheckDef(
        "ENG-003", "Engine Purity",
        "Pure modules read/write localStorage directly",
        "MEDIUM",
        "Pure engine modules should receive state by parameter; only the "
        "save store reads/writes localStorage.",
        "eng_no_storage_in_pure_modules",
    ),

    # Scene discipline
    CheckDef(
        "SCN-001", "Scene Discipline",
        "Scene adds a keydown/keyup listener without removing it",
        "HIGH",
        "Listener leaks across scene transitions cause input cross-talk "
        "(e.g., FarmScene's 'i' firing inside TownScene).",
        "scn_keydown_paired_with_removal",
    ),
    CheckDef(
        "SCN-002", "Scene Discipline",
        "Scene adds a window listener but doesn't override dispose()",
        "HIGH",
        "GameScene supplies a default dispose() that subclasses inherit, "
        "but any scene that wires its own window-level listener must "
        "override dispose() so removal is its own responsibility.",
        "scn_listener_owners_override_dispose",
    ),

    # UX guardrails
    CheckDef(
        "UX-001", "UX Guardrails",
        "Blocking window.prompt / alert / confirm in shipping code",
        "HIGH",
        "Blocking dialogs freeze the engine update loop and don't work "
        "in headless Playwright. Use overlay modal panels instead.",
        "ux_no_blocking_dialogs",
    ),

    # Test discipline
    CheckDef(
        "TST-001", "Test Discipline",
        "`.only(` modifier left in a spec file",
        "CRITICAL",
        "`.only` silently excludes every other test. A merged `.only` "
        "guts the whole CI suite.",
        "tst_no_only_modifier",
    ),
    CheckDef(
        "TST-002", "Test Discipline",
        "`await page.pause()` left in a spec file",
        "CRITICAL",
        "Hangs CI forever.",
        "tst_no_page_pause",
    ),
    CheckDef(
        "TST-003", "Test Discipline",
        "console.log / warn / error in tests",
        "LOW",
        "Pollutes CI output; usually leftover debugging.",
        "tst_no_console_noise",
    ),
    CheckDef(
        "TST-004", "Test Discipline",
        "Spec file has no assertions",
        "HIGH",
        "A spec that doesn't assert passes trivially and tells us nothing.",
        "tst_specs_have_assertions",
    ),

    # Type discipline
    CheckDef(
        "TYP-001", "Type Discipline",
        "`as any` budget exceeded in src/",
        "MEDIUM",
        "Bare `as any` defeats TypeScript's catch and rots silently.",
        "typ_as_any_budget",
    ),
    CheckDef(
        "TYP-002", "Type Discipline",
        "@ts-ignore / @ts-expect-error without a reason comment",
        "MEDIUM",
        "Suppressions should explain why they're necessary so a future "
        "reader can decide if they're still needed.",
        "typ_ts_ignore_needs_reason",
    ),

    # Originality (PSPR §0.7)
    CheckDef(
        "ORI-001", "Originality (PSPR §0.7)",
        "Copyrighted cozy-game franchise name in shipping code",
        "HIGH",
        "Per PSPR §0.7 — Sturdy Volley does not copy other games' "
        "characters, locations, or franchise terms. Docs may reference "
        "prior art; src/, public/, and tests/ must not.",
        "ori_no_copyrighted_names_in_shipping_code",
    ),

    # Save-model safety
    CheckDef(
        "SAVE-001", "Save Model Safety",
        "saveModel.ts missing SAVE_VERSION constant",
        "HIGH",
        "src/engine/saveModel.ts must export a numeric SAVE_VERSION used "
        "by the root schema. Without it, schema changes silently load "
        "old saves into the new shape and either crash mid-game or "
        "misinterpret data.",
        "save_version_exported",
    ),

    # Project hygiene
    CheckDef(
        "PRJ-001", "Project Hygiene",
        ".env file committed to repository",
        "HIGH",
        ".env files can expose secrets and should never be tracked.",
        "prj_no_committed_env",
    ),
    CheckDef(
        "PRJ-002", "Project Hygiene",
        ".gitignore missing required entries",
        "MEDIUM",
        ".gitignore must cover node_modules, .env, dist, "
        "playwright-report, test-results.",
        "prj_gitignore_covers_basics",
    ),
    CheckDef(
        "PRJ-003", "Project Hygiene",
        "Missing README",
        "LOW",
        "README is the entry-point for the project.",
        "prj_readme_present",
    ),
    CheckDef(
        "PRJ-004", "Project Hygiene",
        "Missing dependency lock file",
        "HIGH",
        "package.json present but no tracked lock file — installs will "
        "drift between machines.",
        "prj_lockfile_present",
    ),

    # Package-script wiring
    CheckDef(
        "PKG-001", "Package Scripts",
        "PSPR verify-gate npm script missing",
        "HIGH",
        "All of typecheck, lint, test, test:e2e, validate:assets, build "
        "must be runnable via npm — the PSPR §0.2 verify gate depends "
        "on these.",
        "pkg_verify_scripts_present",
    ),
    CheckDef(
        "PKG-002", "Package Scripts",
        "TypeScript strict mode disabled",
        "HIGH",
        "tsconfig.json must enable strict mode.",
        "pkg_tsconfig_strict",
    ),

    # PSPR / DEVLOG discipline
    CheckDef(
        "PSPR-001", "PSPR Discipline",
        "STURDY_VOLLEY_PSPR.md missing",
        "HIGH",
        "The canonical plan is load-bearing — every prompt's verify "
        "gate / commit / push discipline references its §0.",
        "pspr_plan_present",
    ),
    CheckDef(
        "PSPR-002", "PSPR Discipline",
        "DEVLOG.md missing",
        "HIGH",
        "Each completed prompt logs to DEVLOG.md (PSPR §0.3).",
        "pspr_devlog_present",
    ),
    CheckDef(
        "PSPR-003", "PSPR Discipline",
        "DEVLOG.md has no prompt entries",
        "MEDIUM",
        "DEVLOG.md should accumulate `## Prompt …` headings as work "
        "lands.",
        "pspr_devlog_has_recent_entry",
    ),

    # Security baseline
    CheckDef(
        "SEC-001", "Security",
        "Hardcoded secret / API key / token in source",
        "CRITICAL",
        "Secrets must not be committed.",
        "sec_hardcoded_secrets",
    ),
    CheckDef(
        "SEC-002", "Security",
        "Private key material committed",
        "CRITICAL",
        "Private key material must not live in source control.",
        "sec_no_private_keys",
    ),
    CheckDef(
        "SEC-003", "Security",
        "eval() / new Function() in shipping code",
        "HIGH",
        "Dynamic code execution creates RCE/XSS risk. Tests may use it "
        "deliberately; src/ should not.",
        "sec_no_dynamic_execution",
    ),
    CheckDef(
        "SEC-004", "Security",
        "Direct innerHTML / outerHTML assignment",
        "HIGH",
        "DOM building goes through src/ui/overlay.ts using "
        "createElement + textContent (XSS-safe by construction).",
        "sec_no_inner_html_assignment",
    ),
]


RUNNERS: dict[str, Callable[[CheckDef, ScanContext], list[Finding]]] = {
    name: obj
    for name, obj in globals().items()
    if callable(obj)
    and name.split("_", 1)[0] in {
        "eng", "scn", "ux", "tst", "typ", "ori", "save", "prj", "pkg", "pspr", "sec",
    }
}


# ========================================================================
# Runner / reporter
# ========================================================================


def run_scan(root: Path) -> ScanReport:
    ctx = build_context(root)
    findings: list[Finding] = []
    category_totals: dict[str, dict[str, int]] = {}
    for defn in CHECKS:
        bucket = category_totals.setdefault(
            defn.category,
            {"total": 0, "passed": 0, "failed": 0, "score": 0},
        )
        bucket["total"] += 1
        runner = RUNNERS.get(defn.runner)
        if runner is None:
            check_findings = [finding(
                defn,
                [f"Runner '{defn.runner}' not found in this scanner."],
            )]
        else:
            check_findings = runner(defn, ctx)
        if check_findings:
            bucket["failed"] += 1
            findings.extend(check_findings)
        else:
            bucket["passed"] += 1
    for bucket in category_totals.values():
        bucket["score"] = (
            round(100 * bucket["passed"] / bucket["total"])
            if bucket["total"] else 100
        )
    return ScanReport(
        root=str(root.resolve()),
        total_checks=len(CHECKS),
        passed=len(CHECKS) - len(findings),
        failed=len(findings),
        findings=findings,
        category_scores=category_totals,
    )


def render_markdown(report: ScanReport) -> str:
    lines = [
        "# Sturdy Volley — Local Audit",
        "",
        f"Root: `{report.root}`",
        f"Overall score: **{report.overall_score}/100**",
        f"Checks: {report.total_checks} total, "
        f"{report.passed} passed, {report.failed} failed",
        "",
        "## Category Scores",
        "",
        "| Category | Score | Passed | Failed |",
        "|---|---:|---:|---:|",
    ]
    for category, bucket in sorted(report.category_scores.items()):
        lines.append(
            f"| {category} | {bucket['score']}/100 | "
            f"{bucket['passed']} | {bucket['failed']} |"
        )
    lines.extend(["", "## Findings", ""])
    if not report.findings:
        lines.append("No findings. Repo is clean.")
    else:
        for item in report.findings:
            lines.append(
                f"### {item.check_id} — {item.title} ({item.severity})"
            )
            lines.append("")
            lines.append(item.description)
            if item.evidence:
                lines.append("")
                for entry in item.evidence:
                    lines.append(f"- `{entry}`")
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render_text(report: ScanReport) -> str:
    lines = [
        "Sturdy Volley — Local Audit",
        f"Root: {report.root}",
        f"Overall: {report.overall_score}/100  "
        f"({report.passed} passed, {report.failed} failed)",
        "",
        "Category scores:",
    ]
    for category, bucket in sorted(report.category_scores.items()):
        lines.append(
            f"  {category:<28} {bucket['score']:>3}/100  "
            f"({bucket['passed']}/{bucket['total']})"
        )
    lines.append("")
    if not report.findings:
        lines.append("No findings. Repo is clean.")
    else:
        lines.append("Findings:")
        for item in report.findings:
            lines.append(
                f"  [{item.severity}] {item.check_id} {item.title}"
            )
            for entry in item.evidence[:6]:
                lines.append(f"      - {entry}")
            if len(item.evidence) > 6:
                lines.append(f"      … {len(item.evidence) - 6} more")
    return "\n".join(lines) + "\n"


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sturdy Volley local audit scanner (PSPR §0 gate)."
    )
    parser.add_argument(
        "--root", type=Path, default=REPO_ROOT,
        help="Repository root to scan (defaults to this script's parent).",
    )
    parser.add_argument(
        "--format", choices=["markdown", "json", "text"], default="text",
        help="Output format. `text` is the terminal default; "
             "use `markdown` for an audit artifact.",
    )
    parser.add_argument(
        "--output", type=Path,
        help="Write report to this path instead of stdout.",
    )
    parser.add_argument(
        "--fail-on", choices=["none", "any", "high"], default="none",
        help="Exit non-zero when findings match. "
             "`high` = any HIGH or CRITICAL finding.",
    )
    return parser.parse_args(argv)


def _safe_stdout_write(output: str) -> None:
    """Print to stdout without crashing on cp1252 Windows consoles.

    The default Windows terminal uses cp1252 which can't encode many of
    the unicode chars our reports use (`—`, `§`, `…`, `≥`). Switch
    stdout to a utf-8 wrapper proactively when the underlying encoding
    isn't already utf-8, falling back to ascii with replacement.
    """
    encoding = getattr(sys.stdout, "encoding", "") or ""
    buffer = getattr(sys.stdout, "buffer", None)
    if encoding.lower().replace("-", "") != "utf8" and buffer is not None:
        try:
            wrapper = io.TextIOWrapper(
                buffer, encoding="utf-8", errors="replace", newline="",
            )
            wrapper.write(output)
            wrapper.flush()
            return
        except (OSError, ValueError):
            pass
    try:
        sys.stdout.write(output)
    except UnicodeEncodeError:
        sys.stdout.write(output.encode("ascii", "replace").decode("ascii"))


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    report = run_scan(args.root)
    if args.format == "json":
        output = json.dumps(report.to_dict(), indent=2, sort_keys=True) + "\n"
    elif args.format == "markdown":
        output = render_markdown(report)
    else:
        output = render_text(report)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8")
    else:
        _safe_stdout_write(output)

    if args.fail_on == "any" and report.findings:
        return 1
    if args.fail_on == "high" and any(
        f.severity in {"HIGH", "CRITICAL"} for f in report.findings
    ):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
