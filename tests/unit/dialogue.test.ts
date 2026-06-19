import { describe, it, expect } from 'vitest';
import {
  applyEffect,
  evalCondition,
  pickChoice,
  run,
  type DialogueGraph,
  type DialogueState,
} from '../../src/engine/dialogue';

function freshState(overrides: Partial<DialogueState> = {}): DialogueState {
  return {
    flags: {},
    relationships: {},
    lineSeenToday: {},
    lineSeenEver: {},
    inventoryCount: () => 0,
    now: { season: 'spring', day: 1, weatherId: null },
    ...overrides,
  };
}

const GRAPH: DialogueGraph = {
  startNodeId: 'greet',
  nodes: {
    greet: {
      id: 'greet',
      speakerNpcId: 'mara-vale',
      body: 'Morning, neighbor.',
      next: 'offer',
    },
    offer: {
      id: 'offer',
      speakerNpcId: 'mara-vale',
      body: 'Need any help with the harbor?',
      choices: [
        {
          id: 'yes',
          label: 'Sure',
          effects: [{ kind: 'addRapport', npcId: 'mara-vale', delta: 2 }],
          next: 'thanks',
        },
        {
          id: 'no',
          label: 'Not today',
          effects: [{ kind: 'setFlag', flag: 'declined-mara', value: true }],
          next: 'sigh',
        },
        {
          id: 'rich',
          label: 'Buy you out',
          conditions: [{ kind: 'rapportAtLeast', npcId: 'mara-vale', value: 5 }],
        },
      ],
    },
    thanks: {
      id: 'thanks',
      speakerNpcId: 'mara-vale',
      body: 'I appreciate it.',
    },
    sigh: {
      id: 'sigh',
      speakerNpcId: 'mara-vale',
      body: 'Maybe tomorrow.',
    },
  },
};

describe('evalCondition', () => {
  it('checks flags, rapport, inventory, weather, season, and seen-line', () => {
    const s = freshState({
      flags: { 'shipwreck-cleared': true },
      relationships: { 'mara-vale': 6 },
      now: { season: 'fall', day: 1, weatherId: 'rain' },
      inventoryCount: (id) => (id === 'driftwood' ? 4 : 0),
      lineSeenEver: { 'mara-vale': new Set(['greet']) },
    });
    expect(evalCondition({ kind: 'flag', flag: 'shipwreck-cleared', equals: true }, s)).toBe(true);
    expect(evalCondition({ kind: 'rapportAtLeast', npcId: 'mara-vale', value: 5 }, s)).toBe(true);
    expect(evalCondition({ kind: 'hasItem', itemId: 'driftwood', qty: 3 }, s)).toBe(true);
    expect(evalCondition({ kind: 'hasItem', itemId: 'driftwood', qty: 5 }, s)).toBe(false);
    expect(evalCondition({ kind: 'weather', id: 'rain' }, s)).toBe(true);
    expect(evalCondition({ kind: 'season', id: 'fall' }, s)).toBe(true);
    expect(
      evalCondition({ kind: 'lineNotSeenEver', npcId: 'mara-vale', lineId: 'greet' }, s),
    ).toBe(false);
  });
});

describe('applyEffect', () => {
  it('mutates the right field for each effect', () => {
    let s = freshState();
    s = applyEffect({ kind: 'setFlag', flag: 'met-mara', value: true }, s);
    expect(s.flags['met-mara']).toBe(true);
    s = applyEffect({ kind: 'addRapport', npcId: 'mara-vale', delta: 4 }, s);
    expect(s.relationships['mara-vale']).toBe(4);
    s = applyEffect({ kind: 'markLineSeenToday', npcId: 'mara-vale', lineId: 'greet' }, s);
    expect(s.lineSeenToday['mara-vale']?.has('greet')).toBe(true);
  });
});

describe('run + pickChoice', () => {
  it('walks until the choice node and exposes eligible options', () => {
    const r = run(GRAPH, freshState({ relationships: { 'mara-vale': 3 } }));
    const choices = r.awaitChoice!;
    expect(choices.map((c) => c.id)).toEqual(['yes', 'no']); // "rich" gated out by rapport
    expect(r.events[0]).toMatchObject({ kind: 'line', nodeId: 'greet' });
    expect(r.events.find((e) => e.kind === 'choice')).toBeDefined();
  });

  it('picking "yes" applies rapport and continues to the thanks node', () => {
    const a = run(GRAPH, freshState());
    const r = pickChoice(GRAPH, a.awaitChoice![0]!, a.state);
    expect(r.state.relationships['mara-vale']).toBe(2);
    expect(r.events.some((e) => e.kind === 'line' && (e as { nodeId: string }).nodeId === 'thanks')).toBe(
      true,
    );
  });

  it('declining sets a flag and ends after the sigh line', () => {
    const a = run(GRAPH, freshState());
    const r = pickChoice(GRAPH, a.awaitChoice![1]!, a.state);
    expect(r.state.flags['declined-mara']).toBe(true);
    expect(r.events[r.events.length - 1]).toEqual({ kind: 'end' });
  });

  it('the high-rapport "rich" choice surfaces when rapport ≥ 5', () => {
    const r = run(GRAPH, freshState({ relationships: { 'mara-vale': 5 } }));
    expect(r.awaitChoice!.map((c) => c.id)).toEqual(['yes', 'no', 'rich']);
  });
});
