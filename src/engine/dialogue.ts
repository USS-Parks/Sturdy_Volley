/**
 * Dialogue engine (Prompt 012). Pure. A DialogueGraph is a set of named nodes
 * each with optional conditions, a body, optional choices, and per-effect
 * resolution. The runner advances through nodes, evaluates conditions, applies
 * effects (rapport, flags, inventory checks, quest triggers, scene triggers),
 * and produces a flat list of step events the renderer turns into typed lines.
 */
export type FlagValue = boolean | number | string;

export interface DialogueState {
  flags: Record<string, FlagValue>;
  /** Per-NPC affection score the runner can read + adjust. */
  relationships: Record<string, number>;
  /** Per-NPC counters for "lines seen today" and "weekly gift" tracking. */
  lineSeenToday: Record<string, ReadonlySet<string>>;
  /** Has the player encountered this once-only line before? */
  lineSeenEver: Record<string, ReadonlySet<string>>;
  inventoryCount: (itemId: string) => number;
  consumeItem?: (itemId: string, qty: number) => boolean;
  now: { season: string; day: number; weatherId: string | null };
}

export type Condition =
  | { kind: 'flag'; flag: string; equals: FlagValue }
  | { kind: 'rapportAtLeast'; npcId: string; value: number }
  | { kind: 'hasItem'; itemId: string; qty?: number }
  | { kind: 'weather'; id: string }
  | { kind: 'season'; id: string }
  | { kind: 'lineNotSeenToday'; npcId: string; lineId: string }
  | { kind: 'lineNotSeenEver'; npcId: string; lineId: string };

export type Effect =
  | { kind: 'setFlag'; flag: string; value: FlagValue }
  | { kind: 'addRapport'; npcId: string; delta: number }
  | { kind: 'consumeItem'; itemId: string; qty: number }
  | { kind: 'startQuest'; questId: string }
  | { kind: 'startCutscene'; cutsceneId: string }
  | { kind: 'markLineSeenToday'; npcId: string; lineId: string }
  | { kind: 'markLineSeenEver'; npcId: string; lineId: string };

export interface DialogueChoice {
  id: string;
  label: string;
  next?: string; // node id to jump to
  conditions?: Condition[];
  effects?: Effect[];
}

export interface DialogueNode {
  id: string;
  speakerNpcId: string;
  body: string;
  conditions?: Condition[];
  effects?: Effect[];
  choices?: DialogueChoice[];
  next?: string;
}

export interface DialogueGraph {
  startNodeId: string;
  nodes: Record<string, DialogueNode>;
}

export type DialogueEvent =
  | { kind: 'line'; nodeId: string; speakerNpcId: string; body: string }
  | { kind: 'choice'; nodeId: string; choices: DialogueChoice[] }
  | { kind: 'effect'; effect: Effect }
  | { kind: 'end' };

export function evalCondition(c: Condition, s: DialogueState): boolean {
  switch (c.kind) {
    case 'flag':
      return s.flags[c.flag] === c.equals;
    case 'rapportAtLeast':
      return (s.relationships[c.npcId] ?? 0) >= c.value;
    case 'hasItem':
      return s.inventoryCount(c.itemId) >= (c.qty ?? 1);
    case 'weather':
      return s.now.weatherId === c.id;
    case 'season':
      return s.now.season === c.id;
    case 'lineNotSeenToday':
      return !(s.lineSeenToday[c.npcId]?.has(c.lineId) ?? false);
    case 'lineNotSeenEver':
      return !(s.lineSeenEver[c.npcId]?.has(c.lineId) ?? false);
  }
}

export function evalAll(conds: readonly Condition[] | undefined, s: DialogueState): boolean {
  if (!conds || conds.length === 0) return true;
  return conds.every((c) => evalCondition(c, s));
}

export function applyEffect(e: Effect, s: DialogueState): DialogueState {
  switch (e.kind) {
    case 'setFlag':
      return { ...s, flags: { ...s.flags, [e.flag]: e.value } };
    case 'addRapport':
      return {
        ...s,
        relationships: {
          ...s.relationships,
          [e.npcId]: (s.relationships[e.npcId] ?? 0) + e.delta,
        },
      };
    case 'consumeItem':
      s.consumeItem?.(e.itemId, e.qty);
      return s;
    case 'markLineSeenToday': {
      const cur = s.lineSeenToday[e.npcId] ?? new Set<string>();
      const next = new Set(cur);
      next.add(e.lineId);
      return { ...s, lineSeenToday: { ...s.lineSeenToday, [e.npcId]: next } };
    }
    case 'markLineSeenEver': {
      const cur = s.lineSeenEver[e.npcId] ?? new Set<string>();
      const next = new Set(cur);
      next.add(e.lineId);
      return { ...s, lineSeenEver: { ...s.lineSeenEver, [e.npcId]: next } };
    }
    case 'startQuest':
    case 'startCutscene':
      // Side-effects the runner emits but doesn't apply here — the caller routes them.
      return s;
  }
}

export interface RunResult {
  events: DialogueEvent[];
  state: DialogueState;
  awaitChoice?: DialogueChoice[];
}

/**
 * Walk the graph until we hit a choice node, a side-effect-only ending, or an
 * empty `next` pointer. Returns the typed event list the UI plays back.
 */
export function run(graph: DialogueGraph, startState: DialogueState): RunResult {
  const events: DialogueEvent[] = [];
  let state = startState;
  let nodeId: string | undefined = graph.startNodeId;
  const visited = new Set<string>();

  while (nodeId) {
    if (visited.has(nodeId)) break; // guard against tight cycles
    visited.add(nodeId);
    const node: DialogueNode | undefined = graph.nodes[nodeId];
    if (!node) break;
    if (!evalAll(node.conditions, state)) {
      nodeId = node.next;
      continue;
    }
    events.push({ kind: 'line', nodeId: node.id, speakerNpcId: node.speakerNpcId, body: node.body });
    for (const eff of node.effects ?? []) {
      state = applyEffect(eff, state);
      events.push({ kind: 'effect', effect: eff });
    }
    if (node.choices && node.choices.length > 0) {
      const eligible = node.choices.filter((c: DialogueChoice) => evalAll(c.conditions, state));
      events.push({ kind: 'choice', nodeId: node.id, choices: eligible });
      return { events, state, awaitChoice: eligible };
    }
    nodeId = node.next;
  }
  events.push({ kind: 'end' });
  return { events, state };
}

export function pickChoice(
  graph: DialogueGraph,
  choice: DialogueChoice,
  current: DialogueState,
): RunResult {
  let state = current;
  const events: DialogueEvent[] = [];
  for (const eff of choice.effects ?? []) {
    state = applyEffect(eff, state);
    events.push({ kind: 'effect', effect: eff });
  }
  if (!choice.next) {
    events.push({ kind: 'end' });
    return { events, state };
  }
  const subGraph: DialogueGraph = { startNodeId: choice.next, nodes: graph.nodes };
  const r = run(subGraph, state);
  return { events: [...events, ...r.events], state: r.state, awaitChoice: r.awaitChoice };
}
