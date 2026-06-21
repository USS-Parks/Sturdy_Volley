import { describe, it, expect } from 'vitest';
import { questSchema, type Quest } from '../../src/data/schemas';
import { createNewSave, type QuestRecord } from '../../src/engine/saveModel';
import type { QuestWorld } from '../../src/engine/quests';
import {
  acceptQuest,
  applyQuestEvent,
  cancelQuest,
  grantQuestRewards,
  questCounts,
  questJournalRows,
  reconcileQuests,
} from '../../src/engine/quests';
import { loadGameContent } from '../../src/data/content';

/** Build a fully-defaulted Quest definition from a partial literal. */
function q(partial: Record<string, unknown>): Quest {
  return questSchema.parse(partial);
}

const emptyWorld: QuestWorld = { relationshipLevel: () => 0, itemCount: () => 0 };

const STORY = q({
  id: 'story-one',
  name: 'Story One',
  description: 'auto story',
  category: 'story',
  kind: 'story',
  autoActivate: true,
  objectives: [{ kind: 'harvest', label: 'Harvest one crop' }],
  rewards: [{ kind: 'gold', amount: 50 }],
});

const REQUEST = q({
  id: 'request-one',
  name: 'Request One',
  description: 'a request',
  category: 'foraging',
  kind: 'request',
  cancellable: true,
  limitDays: 3,
  objectives: [{ kind: 'forage', target: 'tide-shell', count: 3, label: 'Gather 3 shells' }],
  rewards: [{ kind: 'gold', amount: 30 }],
});

const SEQUEL = q({
  id: 'sequel',
  name: 'Sequel',
  description: 'unlocks after story-one',
  category: 'story',
  kind: 'story',
  autoActivate: true,
  prerequisiteQuestIds: ['story-one'],
  objectives: [{ kind: 'mine', label: 'Break a rock' }],
});

describe('reconcileQuests — seeding', () => {
  it('auto-activates story quests, offers requests, and locks prereq-gated quests', () => {
    const { record } = reconcileQuests({}, [STORY, REQUEST, SEQUEL], { day: 1 });
    expect(record['story-one']?.status).toBe('active');
    expect(record['story-one']?.startedDay).toBe(1);
    expect(record['request-one']?.status).toBe('available');
    expect(record['sequel']?.status).toBe('locked');
  });

  it('hides nothing it has already seeded on a second pass (idempotent)', () => {
    const first = reconcileQuests({}, [STORY, REQUEST], { day: 1 }).record;
    const second = reconcileQuests(first, [STORY, REQUEST], { day: 2 }).record;
    expect(second['story-one']?.status).toBe('active');
    expect(second['story-one']?.startedDay).toBe(1); // not re-stamped
    expect(second['request-one']?.status).toBe('available');
  });
});

describe('applyQuestEvent', () => {
  const base = reconcileQuests({}, [STORY, REQUEST], { day: 1 }).record;

  it('advances a matching objective on an active quest', () => {
    const { record } = applyQuestEvent(base, [STORY, REQUEST], 1, { kind: 'harvest' });
    expect(record['story-one']?.objectives[0]).toBe(1);
  });

  it('does not advance a quest that is only available (not accepted)', () => {
    const { record } = applyQuestEvent(base, [STORY, REQUEST], 1, { kind: 'forage', target: 'tide-shell' });
    expect(record['request-one']?.objectives[0]).toBe(0);
  });

  it('ignores events whose target does not match a targeted objective', () => {
    const accepted = acceptQuest(base, [STORY, REQUEST], 'request-one', 1);
    const { record } = applyQuestEvent(accepted, [STORY, REQUEST], 1, { kind: 'forage', target: 'driftwood' });
    expect(record['request-one']?.objectives[0]).toBe(0);
  });

  it('accumulates qty and caps at the objective target, then completes', () => {
    let record: QuestRecord = acceptQuest(base, [STORY, REQUEST], 'request-one', 1);
    const step = applyQuestEvent(record, [STORY, REQUEST], 1, { kind: 'forage', target: 'tide-shell', qty: 2 });
    record = step.record;
    expect(record['request-one']?.objectives[0]).toBe(2);
    expect(step.completed).toHaveLength(0);

    const finish = applyQuestEvent(record, [STORY, REQUEST], 1, { kind: 'forage', target: 'tide-shell', qty: 5 });
    expect(finish.record['request-one']?.objectives[0]).toBe(3); // capped at count
    expect(finish.record['request-one']?.status).toBe('complete');
    expect(finish.completed.map((c) => c.id)).toEqual(['request-one']);
  });

  it('reports a completion only once', () => {
    let record: QuestRecord = acceptQuest(base, [STORY, REQUEST], 'request-one', 1);
    record = applyQuestEvent(record, [STORY, REQUEST], 1, { kind: 'forage', target: 'tide-shell', qty: 3 }).record;
    const again = applyQuestEvent(record, [STORY, REQUEST], 1, { kind: 'forage', target: 'tide-shell', qty: 3 });
    expect(again.completed).toHaveLength(0);
  });
});

describe('accept / cancel', () => {
  const base = reconcileQuests({}, [STORY, REQUEST], { day: 1 }).record;

  it('accept moves an available quest to active and stamps the start day', () => {
    const record = acceptQuest(base, [STORY, REQUEST], 'request-one', 4);
    expect(record['request-one']?.status).toBe('active');
    expect(record['request-one']?.startedDay).toBe(4);
  });

  it('cancel returns a cancellable active quest to available and resets progress', () => {
    let record = acceptQuest(base, [STORY, REQUEST], 'request-one', 1);
    record = applyQuestEvent(record, [STORY, REQUEST], 1, { kind: 'forage', target: 'tide-shell', qty: 2 }).record;
    record = cancelQuest(record, [STORY, REQUEST], 'request-one');
    expect(record['request-one']?.status).toBe('available');
    expect(record['request-one']?.objectives[0]).toBe(0);
  });

  it('never cancels a non-cancellable story quest', () => {
    const record = cancelQuest(base, [STORY, REQUEST], 'story-one');
    expect(record['story-one']?.status).toBe('active');
  });
});

describe('timers never break story paths', () => {
  it('fails a non-story timed quest once its deadline passes', () => {
    let record = acceptQuest(reconcileQuests({}, [REQUEST], { day: 1 }).record, [REQUEST], 'request-one', 1);
    const tick = reconcileQuests(record, [REQUEST], { day: 1 + 3, advanceDay: true });
    record = tick.record;
    expect(record['request-one']?.status).toBe('failed');
    expect(tick.failed.map((f) => f.id)).toEqual(['request-one']);
  });

  it('never fails a story quest even with a limitDays set', () => {
    const timedStory = q({
      id: 'timed-story',
      name: 'Timed Story',
      description: 'story with a (ignored) timer',
      category: 'story',
      kind: 'story',
      autoActivate: true,
      limitDays: 1,
      objectives: [{ kind: 'talk', target: 'mara-vale', label: 'Talk to Mara' }],
    });
    const seeded = reconcileQuests({}, [timedStory], { day: 1 }).record;
    const tick = reconcileQuests(seeded, [timedStory], { day: 100, advanceDay: true });
    expect(tick.record['timed-story']?.status).toBe('active');
    expect(tick.failed).toHaveLength(0);
  });

  it('does not fail a completed timed quest at the deadline', () => {
    let record = acceptQuest(reconcileQuests({}, [REQUEST], { day: 1 }).record, [REQUEST], 'request-one', 1);
    record = applyQuestEvent(record, [REQUEST], 1, { kind: 'forage', target: 'tide-shell', qty: 3 }).record;
    const tick = reconcileQuests(record, [REQUEST], { day: 10, advanceDay: true });
    expect(tick.record['request-one']?.status).toBe('complete');
    expect(tick.failed).toHaveLength(0);
  });
});

describe('standing objectives (have / befriend) and prerequisites', () => {
  const HAVE = q({
    id: 'hoarder',
    name: 'Hoarder',
    description: 'hold things',
    category: 'foraging',
    kind: 'request',
    autoActivate: true,
    objectives: [{ kind: 'have', target: 'driftwood', count: 4, label: 'Hold 4 driftwood' }],
  });
  const BEFRIEND = q({
    id: 'friend',
    name: 'Friend',
    description: 'make a friend',
    category: 'social',
    kind: 'request',
    autoActivate: true,
    objectives: [{ kind: 'befriend', target: 'mara-vale', count: 2, label: 'Reach 2 hearts' }],
  });

  it('completes a have-objective when the world holds enough', () => {
    const world: QuestWorld = { relationshipLevel: () => 0, itemCount: (id) => (id === 'driftwood' ? 5 : 0) };
    const seeded = reconcileQuests({}, [HAVE], { day: 1 }).record;
    const tick = reconcileQuests(seeded, [HAVE], { day: 1, world });
    expect(tick.record['hoarder']?.status).toBe('complete');
    expect(tick.completed.map((c) => c.id)).toEqual(['hoarder']);
  });

  it('completes a befriend-objective at the required level', () => {
    const world: QuestWorld = { relationshipLevel: (id) => (id === 'mara-vale' ? 3 : 0), itemCount: () => 0 };
    const seeded = reconcileQuests({}, [BEFRIEND], { day: 1 }).record;
    const tick = reconcileQuests(seeded, [BEFRIEND], { day: 1, world });
    expect(tick.record['friend']?.status).toBe('complete');
  });

  it('promotes a locked quest once its prerequisite completes (same reconcile)', () => {
    // story-one completes via event; sequel should auto-activate on the next reconcile.
    let record = reconcileQuests({}, [STORY, SEQUEL], { day: 1 }).record;
    record = applyQuestEvent(record, [STORY, SEQUEL], 1, { kind: 'harvest' }).record;
    expect(record['story-one']?.status).toBe('complete');
    const tick = reconcileQuests(record, [STORY, SEQUEL], { day: 2 });
    expect(tick.record['sequel']?.status).toBe('active');
  });
});

describe('grantQuestRewards', () => {
  it('applies gold, items, recipes, relationships, and flags to the save', () => {
    const save = createNewSave({ name: 'Wren', farmName: 'Saltbreak' }, 1000);
    const goldBefore = save.wallet.gold;
    const reward = q({
      id: 'rewarder',
      name: 'Rewarder',
      description: 'gives everything',
      category: 'farming',
      kind: 'request',
      objectives: [{ kind: 'harvest', label: 'Harvest' }],
      rewards: [
        { kind: 'gold', amount: 100 },
        { kind: 'item', itemId: 'driftwood', qty: 3 },
        { kind: 'recipe', recipeId: 'shell-bracelet' },
        { kind: 'relationship', npcId: 'mara-vale', delta: 25 },
        { kind: 'flag', flag: 'rewarded', value: true },
      ],
    });
    grantQuestRewards(save, reward);
    expect(save.wallet.gold).toBe(goldBefore + 100);
    expect(save.inventory.slots.some((s) => s?.itemId === 'driftwood' && s.qty === 3)).toBe(true);
    expect(save.knownRecipeIds).toContain('shell-bracelet');
    expect(save.relationships['mara-vale']).toBe(25);
    expect(save.flags['rewarded']).toBe(true);
  });
});

describe('questJournalRows + questCounts', () => {
  it('hides locked quests, sorts active first, and computes objective progress', () => {
    let record = reconcileQuests({}, [STORY, REQUEST, SEQUEL], { day: 1 }).record;
    record = applyQuestEvent(record, [STORY, REQUEST, SEQUEL], 1, { kind: 'harvest' }).record; // story progress 1/1 -> complete
    const rows = questJournalRows(record, [STORY, REQUEST, SEQUEL], emptyWorld, 1);
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain('sequel'); // still locked at this reconcile
    expect(rows.find((r) => r.id === 'story-one')?.status).toBe('complete');
    const req = rows.find((r) => r.id === 'request-one');
    expect(req?.status).toBe('available');
    expect(req?.canAccept).toBe(true);
    expect(req?.objectives[0]).toMatchObject({ current: 0, target: 3, done: false });
  });

  it('counts quests by status', () => {
    const record = reconcileQuests({}, [STORY, REQUEST], { day: 1 }).record;
    expect(questCounts(record)).toEqual({ active: 1, available: 1, complete: 0 });
  });
});

describe('content acceptance — quest catalog', () => {
  const quests = loadGameContent().quests;

  it('ships at least 12 quests', () => {
    expect(quests.length).toBeGreaterThanOrEqual(12);
  });

  it('spans every required activity arc', () => {
    const cats = new Set(quests.map((qq) => qq.category));
    for (const arc of ['farming', 'fishing', 'crafting', 'mining', 'foraging', 'exploration', 'social'] as const) {
      expect(cats.has(arc), `missing a ${arc} quest`).toBe(true);
    }
  });

  it('seeds a fresh save with at least one active and one available quest', () => {
    const { record } = reconcileQuests({}, quests, { day: 1 });
    const counts = questCounts(record);
    expect(counts.active).toBeGreaterThanOrEqual(1);
    expect(counts.available).toBeGreaterThanOrEqual(1);
  });
});
