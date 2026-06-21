import type { Quest, QuestObjective, QuestObjectiveKind } from '../data/schemas';
import type { QuestRecord, QuestState, SaveData } from './saveModel';
import { addItem } from './inventory';
import { unlockRecipes } from './crafting';

/**
 * Quest engine (Prompt 054) — a pure, deterministic state machine over the
 * quest definitions (`content.quests`) and the per-save quest record
 * (`save.quests`). Nothing here touches the DOM, the renderer, globals, or the
 * clock; every transition is a function of explicit inputs, so the whole arc is
 * unit-testable. Scene glue (reading the active save, persisting, flashing a
 * notification) lives in `quest-tracking.ts`.
 *
 * Lifecycle: `locked` → (`available` → `active` | `active`) → `complete` | `failed`.
 *  - `locked`     prerequisites not yet complete.
 *  - `available`  offered; a request/order the player must accept.
 *  - `active`     accepted (or auto-activated); objectives are tracked.
 *  - `complete`   every objective met; rewards granted exactly once.
 *  - `failed`     a *non-story* timed quest whose deadline passed. Story quests
 *                 are immune to timers, so a missed deadline can never break a
 *                 story path.
 */

/** Objective kinds that accumulate from player actions (events). */
export const EVENT_OBJECTIVE_KINDS: ReadonlySet<QuestObjectiveKind> = new Set([
  'harvest',
  'fish',
  'forage',
  'mine',
  'craft',
  'ship',
  'gift',
  'talk',
  'visit',
]);

/** Objective kinds re-evaluated from world state on each reconcile. */
export const STANDING_OBJECTIVE_KINDS: ReadonlySet<QuestObjectiveKind> = new Set(['befriend', 'have']);

/** A single player action that may advance an event objective. */
export interface QuestEvent {
  kind: QuestObjectiveKind;
  /** itemId / npcId / sceneKey, or omitted for "any". */
  target?: string | null;
  /** Defaults to 1. */
  qty?: number;
}

/** Read-only view of world state used to evaluate standing objectives. */
export interface QuestWorld {
  /** Relationship level (hearts), 0+, for an NPC id. */
  relationshipLevel: (npcId: string) => number;
  /** Total quantity of an item the player currently holds. */
  itemCount: (itemId: string) => number;
}

export interface ReconcileContext {
  /** Absolute in-game day (monotonic across seasons). */
  day: number;
  /** Supply to refresh `befriend` / `have` objectives; omit to leave them as-is. */
  world?: QuestWorld;
  /** When true, run timer expiry for non-story timed quests. */
  advanceDay?: boolean;
}

export interface ReconcileResult {
  record: QuestRecord;
  /** Quests that transitioned active → complete this call (grant their rewards). */
  completed: Quest[];
  /** Quests that transitioned active → failed this call. */
  failed: Quest[];
}

export interface ObjectiveRow {
  kind: QuestObjectiveKind;
  label: string;
  current: number;
  target: number;
  done: boolean;
}

export interface QuestJournalRow {
  id: string;
  name: string;
  description: string;
  category: Quest['category'];
  kind: Quest['kind'];
  status: QuestState['status'];
  objectives: ObjectiveRow[];
  rewardSummary: string;
  giverNpcId: string | null;
  /** True when the journal should offer an Accept button. */
  canAccept: boolean;
  /** True when the journal should offer a Cancel button. */
  canCancel: boolean;
  /** Days remaining on a timed quest (null when untimed / not active). */
  timeLeftDays: number | null;
}

/** Optional id→display-name resolvers for reward summaries. */
export interface QuestNameResolvers {
  item?: (id: string) => string;
  npc?: (id: string) => string;
  recipe?: (id: string) => string;
}

export function buildQuestIndex(defs: readonly Quest[]): Map<string, Quest> {
  return new Map(defs.map((q) => [q.id, q] as const));
}

/** Story quests are immune to timers (acceptance: failed timers never break story). */
export function isStoryQuest(def: Quest): boolean {
  return def.category === 'story' || def.kind === 'story';
}

function prereqsMet(def: Quest, record: QuestRecord): boolean {
  return def.prerequisiteQuestIds.every((id) => record[id]?.status === 'complete');
}

function zeros(n: number): number[] {
  return new Array(n).fill(0);
}

/** Pad/trim a counter array to match the definition's objective count. */
function normalizeCounters(counters: readonly number[], objectiveCount: number): number[] {
  const out = zeros(objectiveCount);
  for (let i = 0; i < objectiveCount; i++) out[i] = counters[i] ?? 0;
  return out;
}

function objectiveDone(obj: QuestObjective, counter: number): boolean {
  return counter >= obj.count;
}

function allObjectivesDone(def: Quest, counters: readonly number[]): boolean {
  return def.objectives.every((obj, i) => objectiveDone(obj, counters[i] ?? 0));
}

function seedState(def: Quest, record: QuestRecord, day: number): QuestState {
  const counters = zeros(def.objectives.length);
  if (!prereqsMet(def, record)) {
    return { status: 'locked', objectives: counters, startedDay: null, completedDay: null };
  }
  if (def.autoActivate) {
    return { status: 'active', objectives: counters, startedDay: day, completedDay: null };
  }
  return { status: 'available', objectives: counters, startedDay: null, completedDay: null };
}

/** Refresh standing (`befriend` / `have`) objective counters from world state. */
function refreshStanding(def: Quest, counters: number[], world: QuestWorld): void {
  def.objectives.forEach((obj, i) => {
    if (!STANDING_OBJECTIVE_KINDS.has(obj.kind) || obj.target == null) return;
    const value = obj.kind === 'befriend' ? world.relationshipLevel(obj.target) : world.itemCount(obj.target);
    counters[i] = Math.min(obj.count, Math.max(0, value));
  });
}

/**
 * Idempotently seed/advance every quest: create missing states, promote locked
 * quests whose prerequisites just cleared, refresh standing objectives, expire
 * non-story timed quests (when `advanceDay`), and detect completions. Pure: the
 * caller grants rewards for the returned `completed` quests.
 */
export function reconcileQuests(
  record: QuestRecord,
  defs: readonly Quest[],
  ctx: ReconcileContext,
): ReconcileResult {
  const next: QuestRecord = {};
  const completed: Quest[] = [];
  const failed: Quest[] = [];

  // Carry forward states for quest ids that no longer have a definition.
  for (const [id, state] of Object.entries(record)) {
    if (!defs.some((d) => d.id === id)) next[id] = state;
  }

  // Prereq status prefers a state already resolved this pass (so a prereq that
  // completes earlier in `defs` can promote a dependent quest in the same call),
  // falling back to the incoming record.
  const merged: QuestRecord = { ...record };
  const prereqLookup = (def: Quest): boolean =>
    def.prerequisiteQuestIds.every((id) => merged[id]?.status === 'complete');

  for (const def of defs) {
    const existing = record[def.id];
    let state: QuestState = existing
      ? { ...existing, objectives: normalizeCounters(existing.objectives, def.objectives.length) }
      : seedState(def, merged, ctx.day);

    // Promote a locked quest whose prerequisites have now cleared.
    if (state.status === 'locked' && prereqLookup(def)) {
      state = def.autoActivate
        ? { ...state, status: 'active', startedDay: ctx.day }
        : { ...state, status: 'available' };
    }

    // Refresh standing objectives for quests the player can make progress on.
    if (ctx.world && (state.status === 'active' || state.status === 'available')) {
      const counters = [...state.objectives];
      refreshStanding(def, counters, ctx.world);
      state = { ...state, objectives: counters };
    }

    if (state.status === 'active') {
      if (allObjectivesDone(def, state.objectives)) {
        state = { ...state, status: 'complete', completedDay: ctx.day };
        completed.push(def);
      } else if (
        ctx.advanceDay &&
        !isStoryQuest(def) &&
        def.limitDays != null &&
        state.startedDay != null &&
        ctx.day - state.startedDay >= def.limitDays
      ) {
        state = { ...state, status: 'failed', completedDay: ctx.day };
        failed.push(def);
      }
    }

    next[def.id] = state;
    merged[def.id] = state;
  }

  return { record: next, completed, failed };
}

export interface ApplyEventResult {
  record: QuestRecord;
  completed: Quest[];
}

/**
 * Apply a single player action to every *active* quest, advancing matching
 * event objectives and detecting completions. Standing objectives are untouched
 * (they reconcile from world state instead).
 */
export function applyQuestEvent(
  record: QuestRecord,
  defs: readonly Quest[],
  day: number,
  event: QuestEvent,
): ApplyEventResult {
  if (!EVENT_OBJECTIVE_KINDS.has(event.kind)) return { record, completed: [] };
  const qty = Math.max(1, Math.trunc(event.qty ?? 1));
  const index = buildQuestIndex(defs);
  const next: QuestRecord = { ...record };
  const completed: Quest[] = [];

  for (const [id, state] of Object.entries(record)) {
    const def = index.get(id);
    if (!def || state.status !== 'active') continue;

    let changed = false;
    const counters = normalizeCounters(state.objectives, def.objectives.length);
    def.objectives.forEach((obj, i) => {
      if (obj.kind !== event.kind) return;
      if (obj.target != null && obj.target !== (event.target ?? null)) return;
      if (counters[i]! >= obj.count) return;
      counters[i] = Math.min(obj.count, counters[i]! + qty);
      changed = true;
    });
    if (!changed) continue;

    let updated: QuestState = { ...state, objectives: counters };
    if (allObjectivesDone(def, counters)) {
      updated = { ...updated, status: 'complete', completedDay: day };
      completed.push(def);
    }
    next[id] = updated;
  }

  return { record: next, completed };
}

/** Accept an `available` quest (request/order), making it `active`. No-op otherwise. */
export function acceptQuest(record: QuestRecord, defs: readonly Quest[], id: string, day: number): QuestRecord {
  const def = buildQuestIndex(defs).get(id);
  const state = record[id];
  if (!def || !state || state.status !== 'available') return record;
  return {
    ...record,
    [id]: {
      ...state,
      status: 'active',
      startedDay: day,
      objectives: normalizeCounters(state.objectives, def.objectives.length),
    },
  };
}

/**
 * Abandon a cancellable active/available quest. Returns it to `available` (or
 * `locked` if prerequisites are no longer met), resetting progress. Story and
 * non-cancellable quests are never abandoned.
 */
export function cancelQuest(record: QuestRecord, defs: readonly Quest[], id: string): QuestRecord {
  const def = buildQuestIndex(defs).get(id);
  const state = record[id];
  if (!def || !def.cancellable || !state) return record;
  if (state.status !== 'active' && state.status !== 'available') return record;
  const status = prereqsMet(def, record) ? 'available' : 'locked';
  return {
    ...record,
    [id]: { status, objectives: zeros(def.objectives.length), startedDay: null, completedDay: null },
  };
}

/** Apply a completed quest's rewards to the save (mutates `save`). */
export function grantQuestRewards(save: SaveData, quest: Quest): void {
  for (const reward of quest.rewards) {
    switch (reward.kind) {
      case 'gold':
        save.wallet.gold += reward.amount;
        break;
      case 'item': {
        const r = addItem(save.inventory, reward.itemId, reward.qty, reward.quality);
        save.inventory = r.container;
        break;
      }
      case 'recipe':
        save.knownRecipeIds = unlockRecipes(save.knownRecipeIds, [reward.recipeId]);
        break;
      case 'relationship':
        save.relationships[reward.npcId] = (save.relationships[reward.npcId] ?? 0) + reward.delta;
        break;
      case 'flag':
        save.flags[reward.flag] = reward.value;
        break;
    }
  }
}

function summarizeReward(reward: Quest['rewards'][number], names: QuestNameResolvers): string {
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
      return 'Story progress';
  }
}

/** Build display rows for the quest journal, sorted active → available → done → locked. */
export function questJournalRows(
  record: QuestRecord,
  defs: readonly Quest[],
  world: QuestWorld,
  day: number,
  names: QuestNameResolvers = {},
): QuestJournalRow[] {
  const ORDER: Record<QuestState['status'], number> = {
    active: 0,
    available: 1,
    complete: 2,
    failed: 3,
    locked: 4,
  };

  const rows: QuestJournalRow[] = [];
  for (const def of defs) {
    const state = record[def.id];
    if (!state) continue;
    if (state.status === 'locked') continue; // hide locked quests until offered

    const counters = normalizeCounters(state.objectives, def.objectives.length);
    const objectives: ObjectiveRow[] = def.objectives.map((obj, i) => {
      let current = counters[i] ?? 0;
      if (STANDING_OBJECTIVE_KINDS.has(obj.kind) && obj.target != null) {
        const value = obj.kind === 'befriend' ? world.relationshipLevel(obj.target) : world.itemCount(obj.target);
        current = Math.min(obj.count, Math.max(0, value));
      }
      return { kind: obj.kind, label: obj.label, current, target: obj.count, done: current >= obj.count };
    });

    const rewardSummary = def.rewards.map((r) => summarizeReward(r, names)).join(' · ') || 'No reward';
    const timeLeftDays =
      state.status === 'active' && !isStoryQuest(def) && def.limitDays != null && state.startedDay != null
        ? Math.max(0, def.limitDays - (day - state.startedDay))
        : null;

    rows.push({
      id: def.id,
      name: def.name,
      description: def.description,
      category: def.category,
      kind: def.kind,
      status: state.status,
      objectives,
      rewardSummary,
      giverNpcId: def.giverNpcId,
      canAccept: state.status === 'available',
      canCancel: def.cancellable && (state.status === 'active' || state.status === 'available'),
      timeLeftDays,
    });
  }

  rows.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name));
  return rows;
}

/** Count quests by lifecycle status (for the HUD/journal summary line). */
export function questCounts(record: QuestRecord): { active: number; available: number; complete: number } {
  let active = 0;
  let available = 0;
  let complete = 0;
  for (const state of Object.values(record)) {
    if (state.status === 'active') active++;
    else if (state.status === 'available') available++;
    else if (state.status === 'complete') complete++;
  }
  return { active, available, complete };
}
