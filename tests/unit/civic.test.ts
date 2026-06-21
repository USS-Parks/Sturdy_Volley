import { describe, it, expect } from 'vitest';
import { projectSchema, type CivicProject } from '../../src/data/schemas';
import { createNewSave, type ProjectRecord } from '../../src/engine/saveModel';
import {
  completedProjectFlags,
  contribute,
  ensureProjectState,
  grantProjectRewards,
  isProjectComplete,
  projectBoardRows,
  reconcileProjects,
  remainingForRequirement,
  type CivicWorld,
} from '../../src/engine/civic';
import { loadGameContent } from '../../src/data/content';

function p(partial: Record<string, unknown>): CivicProject {
  return projectSchema.parse(partial);
}

const world = (levels: Record<string, number> = {}): CivicWorld => ({
  relationshipLevel: (id) => levels[id] ?? 0,
});

const BEACON = p({
  id: 'beacon',
  name: 'Beacon',
  description: 'relight it',
  giverNpcId: 'mara-vale',
  phases: [
    {
      name: 'Clear',
      description: 'haul debris',
      requirements: [
        { kind: 'item', itemId: 'driftwood', qty: 3 },
        { kind: 'gold', amount: 50 },
      ],
    },
    {
      name: 'Wire',
      description: 'wire the lamp',
      requirements: [
        { kind: 'item', itemId: 'iron-ore', qty: 2 },
        { kind: 'relationship', npcId: 'mara-vale', level: 1 },
      ],
    },
  ],
  rewards: [
    { kind: 'gold', amount: 100 },
    { kind: 'flag', flag: 'beacon-lit', value: true },
  ],
  unlocks: 'opens the observatory',
  ceremony: [{ npcId: 'mara-vale', line: 'It burns again.' }],
});

const DEFS = [BEACON];

function seeded(): ProjectRecord {
  return ensureProjectState({}, DEFS);
}

describe('ensureProjectState', () => {
  it('seeds phase 0 with zeroed contributions shaped to the definition', () => {
    const record = seeded();
    expect(record['beacon']).toEqual({
      phase: 0,
      contributed: [
        [0, 0],
        [0, 0],
      ],
      complete: false,
      completedDay: null,
    });
  });

  it('is idempotent and reshapes a stale contribution grid', () => {
    const stale: ProjectRecord = {
      beacon: { phase: 0, contributed: [[5]], complete: false, completedDay: null },
    };
    const record = ensureProjectState(stale, DEFS);
    expect(record['beacon']?.contributed).toEqual([
      [5, 0],
      [0, 0],
    ]);
  });
});

describe('contribute', () => {
  it('records a contribution and caps it at the requirement target', () => {
    let record = seeded();
    const r1 = contribute(record, DEFS, world(), 'beacon', 0, 2, 1);
    record = r1.record;
    expect(r1.accepted).toBe(2);
    expect(record['beacon']?.contributed[0]?.[0]).toBe(2);

    const r2 = contribute(record, DEFS, world(), 'beacon', 0, 5, 1); // only 1 more needed
    expect(r2.accepted).toBe(1);
    expect(r2.record['beacon']?.contributed[0]?.[0]).toBe(3);
  });

  it('advances to the next phase once the current phase is fully met', () => {
    let record = seeded();
    record = contribute(record, DEFS, world(), 'beacon', 0, 3, 1).record; // driftwood
    expect(record['beacon']?.phase).toBe(0);
    record = contribute(record, DEFS, world(), 'beacon', 1, 50, 1).record; // gold
    expect(record['beacon']?.phase).toBe(1); // advanced
    expect(record['beacon']?.complete).toBe(false);
  });

  it('cannot contribute toward a relationship gate', () => {
    let record = seeded();
    record = contribute(record, DEFS, world(), 'beacon', 0, 3, 1).record;
    record = contribute(record, DEFS, world(), 'beacon', 1, 50, 1).record; // now phase 1
    const r = contribute(record, DEFS, world(), 'beacon', 1, 5, 1); // index 1 is the relationship gate
    expect(r.accepted).toBe(0);
  });

  it('does not complete while a relationship gate is unmet, then completes via reconcile', () => {
    let record = seeded();
    record = contribute(record, DEFS, world(), 'beacon', 0, 3, 1).record;
    record = contribute(record, DEFS, world(), 'beacon', 1, 50, 1).record; // phase 1
    const r = contribute(record, DEFS, world({ 'mara-vale': 0 }), 'beacon', 1, 0, 1);
    void r;
    record = contribute(record, DEFS, world({ 'mara-vale': 0 }), 'beacon', 0, 2, 1).record; // iron-ore met
    expect(record['beacon']?.complete).toBe(false); // relationship gate still unmet

    const recon = reconcileProjects(record, DEFS, world({ 'mara-vale': 2 }), 7);
    expect(recon.record['beacon']?.complete).toBe(true);
    expect(recon.record['beacon']?.completedDay).toBe(7);
    expect(recon.completed.map((c) => c.id)).toEqual(['beacon']);
  });

  it('completes immediately when the last contribution clears every gate', () => {
    let record = seeded();
    record = contribute(record, DEFS, world(), 'beacon', 0, 3, 1).record;
    record = contribute(record, DEFS, world(), 'beacon', 1, 50, 1).record; // phase 1
    const r = contribute(record, DEFS, world({ 'mara-vale': 3 }), 'beacon', 0, 2, 9);
    expect(r.record['beacon']?.complete).toBe(true);
    expect(r.completed?.id).toBe('beacon');
  });
});

describe('selectors', () => {
  it('remainingForRequirement reflects progress and ignores gates', () => {
    let record = seeded();
    expect(remainingForRequirement(record, DEFS, 'beacon', 0)).toBe(3);
    record = contribute(record, DEFS, world(), 'beacon', 0, 1, 1).record;
    expect(remainingForRequirement(record, DEFS, 'beacon', 0)).toBe(2);
  });

  it('completedProjectFlags lists civic:<id> for finished projects', () => {
    const recon = reconcileProjects(
      {
        beacon: { phase: 2, contributed: [[3, 50], [2, 0]], complete: true, completedDay: 3 },
      },
      DEFS,
      world(),
      3,
    );
    expect(completedProjectFlags(recon.record)).toEqual(['civic:beacon']);
    expect(isProjectComplete(recon.record, 'beacon')).toBe(true);
  });

  it('projectBoardRows shows phase + requirement progress; relationship reqs are not contributable', () => {
    let record = seeded();
    record = contribute(record, DEFS, world(), 'beacon', 0, 3, 1).record;
    record = contribute(record, DEFS, world(), 'beacon', 1, 50, 1).record; // phase 1
    const rows = projectBoardRows(record, DEFS, world({ 'mara-vale': 0 }), { item: (id) => id, npc: (id) => id });
    const row = rows.find((r) => r.id === 'beacon')!;
    expect(row.complete).toBe(false);
    expect(row.phaseIndex).toBe(1);
    expect(row.phaseName).toBe('Wire');
    const rel = row.requirements.find((r) => r.kind === 'relationship')!;
    expect(rel.contributable).toBe(false);
    expect(rel.met).toBe(false);
    const item = row.requirements.find((r) => r.kind === 'item')!;
    expect(item.contributable).toBe(true);
  });
});

describe('grantProjectRewards', () => {
  it('applies gold + flag rewards to the save', () => {
    const save = createNewSave({ name: 'Wren', farmName: 'Saltbreak' }, 1000);
    const before = save.wallet.gold;
    grantProjectRewards(save, BEACON);
    expect(save.wallet.gold).toBe(before + 100);
    expect(save.flags['beacon-lit']).toBe(true);
  });
});

describe('content acceptance — civic projects', () => {
  const projects = loadGameContent().projects;

  it('ships at least 3 fully-structured projects', () => {
    expect(projects.length).toBeGreaterThanOrEqual(3);
    for (const project of projects) {
      expect(project.phases.length).toBeGreaterThanOrEqual(1);
      expect(project.ceremony.length).toBeGreaterThanOrEqual(1);
      for (const phase of project.phases) {
        expect(phase.requirements.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('every project is completable: contributing all item/gold reqs + meeting gates finishes it', () => {
    for (const project of projects) {
      let record = ensureProjectState({}, projects);
      const gates: Record<string, number> = {};
      for (const phase of project.phases) {
        for (const req of phase.requirements) {
          if (req.kind === 'relationship') gates[req.npcId] = Math.max(gates[req.npcId] ?? 0, req.level);
        }
      }
      const w = world(gates);
      // Pour in everything for each phase in order.
      for (let guard = 0; guard < 20 && !record[project.id]?.complete; guard++) {
        const state = record[project.id]!;
        if (state.complete) break;
        const phase = project.phases[state.phase]!;
        phase.requirements.forEach((req, i) => {
          if (req.kind !== 'relationship') {
            const amount = req.kind === 'item' ? req.qty : req.amount;
            record = contribute(record, projects, w, project.id, i, amount, 1).record;
          }
        });
        // If a phase has only a relationship gate that's met, reconcile advances it.
        record = reconcileProjects(record, projects, w, 1).record;
      }
      expect(record[project.id]?.complete, `${project.id} should complete`).toBe(true);
    }
  });
});
