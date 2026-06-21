import type { CivicProject, ContributionRequirement, QuestReward } from '../data/schemas';
import type { ProjectRecord, ProjectState, SaveData } from './saveModel';
import { grantRewards } from './rewards';

/**
 * Community restoration engine (Prompt 055) — a pure, deterministic state
 * machine over the civic project definitions (`content.projects`) and the
 * per-save project record (`save.projects`). A project advances through ordered
 * phases; each phase requires item/gold contributions and/or a relationship
 * level (a gate, not consumed). Finishing every phase completes the project,
 * grants rewards, and (scene-side) runs the opening ceremony + alters the map
 * and NPC schedules. Nothing here touches the DOM, renderer, globals, or clock.
 */

export interface CivicWorld {
  /** Relationship level (hearts), 0+, for an NPC id — used by relationship gates. */
  relationshipLevel: (npcId: string) => number;
}

export function buildProjectIndex(defs: readonly CivicProject[]): Map<string, CivicProject> {
  return new Map(defs.map((p) => [p.id, p] as const));
}

/** The amount an item/gold requirement needs (0 for a relationship gate). */
export function requirementTarget(req: ContributionRequirement): number {
  if (req.kind === 'item') return req.qty;
  if (req.kind === 'gold') return req.amount;
  return 0;
}

function requirementMet(req: ContributionRequirement, contributed: number, world: CivicWorld): boolean {
  if (req.kind === 'item') return contributed >= req.qty;
  if (req.kind === 'gold') return contributed >= req.amount;
  return world.relationshipLevel(req.npcId) >= req.level;
}

function zerosForPhases(def: CivicProject): number[][] {
  return def.phases.map((ph) => new Array(ph.requirements.length).fill(0));
}

function seedState(def: CivicProject): ProjectState {
  return { phase: 0, contributed: zerosForPhases(def), complete: false, completedDay: null };
}

/** Coerce a stored contribution grid to the definition's phase × requirement shape. */
function normalizeContributed(contributed: readonly number[][], def: CivicProject): number[][] {
  return def.phases.map((ph, i) => {
    const row = contributed[i] ?? [];
    return ph.requirements.map((_, j) => row[j] ?? 0);
  });
}

function phaseMet(def: CivicProject, phaseIndex: number, contributedRow: readonly number[], world: CivicWorld): boolean {
  const phase = def.phases[phaseIndex];
  if (!phase) return false;
  return phase.requirements.every((req, j) => requirementMet(req, contributedRow[j] ?? 0, world));
}

/** Advance through every currently-satisfied phase; mark complete + stamp the day if all phases clear. */
function advance(state: ProjectState, def: CivicProject, world: CivicWorld, day: number): { state: ProjectState; justCompleted: boolean } {
  if (state.complete) return { state, justCompleted: false };
  let phase = state.phase;
  while (phase < def.phases.length && phaseMet(def, phase, state.contributed[phase] ?? [], world)) {
    phase++;
  }
  if (phase === state.phase) return { state, justCompleted: false };
  if (phase >= def.phases.length) {
    return { state: { ...state, phase, complete: true, completedDay: day }, justCompleted: true };
  }
  return { state: { ...state, phase }, justCompleted: false };
}

/** Idempotently seed a state for every project (preserving + reshaping existing progress). */
export function ensureProjectState(record: ProjectRecord, defs: readonly CivicProject[]): ProjectRecord {
  const next: ProjectRecord = {};
  for (const [id, state] of Object.entries(record)) {
    if (!defs.some((d) => d.id === id)) next[id] = state; // carry forward orphans
  }
  for (const def of defs) {
    const existing = record[def.id];
    next[def.id] = existing
      ? { ...existing, contributed: normalizeContributed(existing.contributed, def) }
      : seedState(def);
  }
  return next;
}

/** Remaining contribution needed for an item/gold requirement on a project's current phase (0 if met / gate / done). */
export function remainingForRequirement(
  record: ProjectRecord,
  defs: readonly CivicProject[],
  projectId: string,
  reqIndex: number,
): number {
  const def = buildProjectIndex(defs).get(projectId);
  const state = record[projectId];
  if (!def || !state || state.complete) return 0;
  const phase = def.phases[state.phase];
  const req = phase?.requirements[reqIndex];
  if (!req || req.kind === 'relationship') return 0;
  const current = state.contributed[state.phase]?.[reqIndex] ?? 0;
  return Math.max(0, requirementTarget(req) - current);
}

export interface ContributeResult {
  record: ProjectRecord;
  /** How much was actually accepted (so the caller removes exactly this from inventory/wallet). */
  accepted: number;
  /** The project if this contribution just completed it. */
  completed: CivicProject | null;
}

/**
 * Record an item/gold contribution to a project's current phase, capped at the
 * requirement's remaining need, then advance any satisfied phases. The caller is
 * responsible for removing `accepted` units from the player's inventory/wallet.
 */
export function contribute(
  record: ProjectRecord,
  defs: readonly CivicProject[],
  world: CivicWorld,
  projectId: string,
  reqIndex: number,
  amount: number,
  day: number,
): ContributeResult {
  const def = buildProjectIndex(defs).get(projectId);
  const state = record[projectId];
  if (!def || !state || state.complete) return { record, accepted: 0, completed: null };
  const phase = def.phases[state.phase];
  const req = phase?.requirements[reqIndex];
  if (!req || req.kind === 'relationship') return { record, accepted: 0, completed: null };

  const current = state.contributed[state.phase]?.[reqIndex] ?? 0;
  const accepted = Math.max(0, Math.min(Math.trunc(amount), requirementTarget(req) - current));
  if (accepted <= 0) return { record, accepted: 0, completed: null };

  const row = [...(state.contributed[state.phase] ?? [])];
  row[reqIndex] = current + accepted;
  const contributed = state.contributed.map((r, i) => (i === state.phase ? row : r));
  const adv = advance({ ...state, contributed }, def, world, day);
  return { record: { ...record, [projectId]: adv.state }, accepted, completed: adv.justCompleted ? def : null };
}

export interface ReconcileProjectsResult {
  record: ProjectRecord;
  completed: CivicProject[];
}

/**
 * Seed states + advance any project whose current phase is now fully satisfied —
 * notably for relationship gates that get met outside a contribution (gifts /
 * talk). Run on board open + at the day boundary.
 */
export function reconcileProjects(
  record: ProjectRecord,
  defs: readonly CivicProject[],
  world: CivicWorld,
  day: number,
): ReconcileProjectsResult {
  const seeded = ensureProjectState(record, defs);
  const next: ProjectRecord = { ...seeded };
  const completed: CivicProject[] = [];
  for (const def of defs) {
    const adv = advance(seeded[def.id]!, def, world, day);
    next[def.id] = adv.state;
    if (adv.justCompleted) completed.push(def);
  }
  return { record: next, completed };
}

/** Apply a completed project's rewards to the save (mutates `save`). */
export function grantProjectRewards(save: SaveData, project: CivicProject): void {
  grantRewards(save, project.rewards);
}

export function isProjectComplete(record: ProjectRecord, projectId: string): boolean {
  return record[projectId]?.complete === true;
}

/** Flag ids (`civic:<id>`) for every completed project — for scene mesh toggles + schedule `activeEventFlags`. */
export function completedProjectFlags(record: ProjectRecord): string[] {
  return Object.entries(record)
    .filter(([, s]) => s.complete)
    .map(([id]) => `civic:${id}`);
}

/* Board selectors ------------------------------------------------- */

export interface QuestNameResolvers {
  item?: (id: string) => string;
  npc?: (id: string) => string;
  recipe?: (id: string) => string;
}

export interface ProjectRequirementRow {
  kind: ContributionRequirement['kind'];
  label: string;
  current: number;
  target: number;
  met: boolean;
  /** True for item/gold reqs the player can contribute toward (false for relationship gates). */
  contributable: boolean;
}

export interface ProjectBoardRow {
  id: string;
  name: string;
  description: string;
  unlocks: string;
  complete: boolean;
  phaseIndex: number;
  phaseCount: number;
  phaseName: string;
  phaseDescription: string;
  requirements: ProjectRequirementRow[];
  rewardSummary: string;
  giverNpcId: string | null;
}

function summarizeReward(reward: QuestReward, names: QuestNameResolvers): string {
  switch (reward.kind) {
    case 'gold':
      return `${reward.amount} g`;
    case 'item':
      return `${reward.qty}× ${names.item?.(reward.itemId) ?? reward.itemId}`;
    case 'recipe':
      return `Recipe: ${names.recipe?.(reward.recipeId) ?? reward.recipeId}`;
    case 'relationship': {
      const who = names.npc?.(reward.npcId) ?? reward.npcId;
      return `${reward.delta >= 0 ? '+' : ''}${reward.delta} with ${who}`;
    }
    case 'flag':
      return 'Town progress';
  }
}

function requirementLabel(req: ContributionRequirement, names: QuestNameResolvers): string {
  if (req.kind === 'item') return names.item?.(req.itemId) ?? req.itemId;
  if (req.kind === 'gold') return 'Gold';
  return `${req.level} hearts with ${names.npc?.(req.npcId) ?? req.npcId}`;
}

/** Build display rows for the civic project board. */
export function projectBoardRows(
  record: ProjectRecord,
  defs: readonly CivicProject[],
  world: CivicWorld,
  names: QuestNameResolvers = {},
): ProjectBoardRow[] {
  const rows: ProjectBoardRow[] = [];
  for (const def of defs) {
    const state = record[def.id];
    if (!state) continue;
    const done = state.complete;
    const phaseIndex = done ? def.phases.length - 1 : state.phase;
    const phase = def.phases[Math.min(phaseIndex, def.phases.length - 1)]!;
    const contributedRow = state.contributed[Math.min(phaseIndex, def.phases.length - 1)] ?? [];

    const requirements: ProjectRequirementRow[] = phase.requirements.map((req, j) => {
      const contributable = req.kind !== 'relationship';
      const target = req.kind === 'relationship' ? req.level : requirementTarget(req);
      const current = req.kind === 'relationship' ? world.relationshipLevel(req.npcId) : contributedRow[j] ?? 0;
      return {
        kind: req.kind,
        label: requirementLabel(req, names),
        current: Math.min(current, target),
        target,
        met: done || requirementMet(req, contributedRow[j] ?? 0, world),
        contributable: contributable && !done,
      };
    });

    rows.push({
      id: def.id,
      name: def.name,
      description: def.description,
      unlocks: def.unlocks,
      complete: done,
      phaseIndex,
      phaseCount: def.phases.length,
      phaseName: phase.name,
      phaseDescription: phase.description,
      requirements,
      rewardSummary: def.rewards.map((r) => summarizeReward(r, names)).join(' · ') || 'No reward',
      giverNpcId: def.giverNpcId,
    });
  }
  // Active projects first, completed last; stable by name otherwise.
  rows.sort((a, b) => Number(a.complete) - Number(b.complete) || a.name.localeCompare(b.name));
  return rows;
}
