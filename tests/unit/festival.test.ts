import { describe, it, expect } from 'vitest';
import { festivalSchema, type Festival } from '../../src/data/schemas';
import { createNewSave } from '../../src/engine/saveModel';
import { loadGameContent } from '../../src/data/content';
import {
  activeSlotFor,
  canClaimMinigame,
  canClaimRelationship,
  claimRelationshipMoment,
  emptyFestivalState,
  festivalForDay,
  festivalStallRows,
  festivalWindowLabel,
  isFestivalActiveNow,
  markAttended,
  recordMinigameRun,
  startFestivalMinigame,
  tapFestivalSlot,
} from '../../src/engine/festival';
import { grantRewards } from '../../src/engine/rewards';

function fest(partial: Record<string, unknown>): Festival {
  return festivalSchema.parse(partial);
}

const FAIR = fest({
  id: 'test-fair',
  name: 'Test Fair',
  season: 'fall',
  day: 16,
  description: 'a test fair',
  startMinutes: 9 * 60,
  endMinutes: 22 * 60,
  minigame: {
    id: 'tap-game',
    kind: 'cook-off',
    name: 'Tap Game',
    description: 'tap the lit dish',
    rounds: 4,
    goalScore: 2,
    slots: 3,
    targetLabel: 'dish',
    rewards: [{ kind: 'gold', amount: 100 }, { kind: 'item', itemId: 'pea-jam', qty: 1 }],
  },
  stall: { name: 'Test Stall', entries: [{ itemId: 'pea-jam', price: 80 }] },
  relationship: { npcId: 'jun-park', line: 'glad you came', rewards: [{ kind: 'relationship', npcId: 'jun-park', delta: 40 }] },
});

describe('festival detection', () => {
  const festivals = [FAIR];

  it('finds the festival on its season + day', () => {
    expect(festivalForDay({ season: 'fall', day: 16 }, festivals)?.id).toBe('test-fair');
    expect(festivalForDay({ season: 'fall', day: 17 }, festivals)).toBeNull();
    expect(festivalForDay({ season: 'spring', day: 16 }, festivals)).toBeNull();
  });

  it('reports the active window correctly', () => {
    expect(isFestivalActiveNow(FAIR, 9 * 60)).toBe(true);
    expect(isFestivalActiveNow(FAIR, 21 * 60)).toBe(true);
    expect(isFestivalActiveNow(FAIR, 22 * 60)).toBe(false); // exclusive end
    expect(isFestivalActiveNow(FAIR, 8 * 60)).toBe(false);
  });

  it('formats a readable window label', () => {
    expect(festivalWindowLabel(FAIR)).toBe('9:00 AM–10:00 PM');
  });
});

describe('festival minigame', () => {
  it('starts from the definition', () => {
    const state = startFestivalMinigame(FAIR, 7)!;
    expect(state.rounds).toBe(4);
    expect(state.goal).toBe(2);
    expect(state.slots).toBe(3);
    expect(state.round).toBe(0);
    expect(state.score).toBe(0);
    expect(state.activeSlot).toBe(activeSlotFor(7, 0, 3));
  });

  it('returns null when the festival has no minigame', () => {
    const thin = fest({ id: 'thin', name: 'Thin', season: 'winter', day: 8, description: 'x' });
    expect(startFestivalMinigame(thin, 1)).toBeNull();
  });

  it('scores a hit, advances the round, and wins when the goal is met', () => {
    const seed = 42;
    let state = startFestivalMinigame(FAIR, seed)!;
    let won = false;
    let finished = false;
    for (let i = 0; i < FAIR.minigame!.rounds; i++) {
      const r = tapFestivalSlot(state, state.activeSlot, seed); // always hit
      state = r.state;
      won = r.won;
      finished = r.finished;
    }
    expect(finished).toBe(true);
    expect(state.score).toBe(4);
    expect(won).toBe(true);
  });

  it('loses when the player misses every round', () => {
    const seed = 9;
    let state = startFestivalMinigame(FAIR, seed)!;
    let last = { won: false, finished: false };
    for (let i = 0; i < FAIR.minigame!.rounds; i++) {
      const wrong = (state.activeSlot + 1) % state.slots;
      const r = tapFestivalSlot(state, wrong, seed);
      state = r.state;
      last = { won: r.won, finished: r.finished };
    }
    expect(last.finished).toBe(true);
    expect(state.score).toBe(0);
    expect(last.won).toBe(false);
  });

  it('ignores taps after the game is finished', () => {
    const seed = 3;
    let state = startFestivalMinigame(FAIR, seed)!;
    for (let i = 0; i < FAIR.minigame!.rounds; i++) state = tapFestivalSlot(state, state.activeSlot, seed).state;
    const after = tapFestivalSlot(state, 0, seed);
    expect(after.state.round).toBe(state.round);
    expect(after.finished).toBe(true);
  });

  it('activeSlotFor is deterministic and in-range', () => {
    for (let round = 0; round < 12; round++) {
      const slot = activeSlotFor(1234, round, 5);
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThan(5);
      expect(activeSlotFor(1234, round, 5)).toBe(slot); // stable
    }
  });
});

describe('per-year reward gating', () => {
  it('grants the minigame prize once per year and updates the best score', () => {
    let record = {};
    expect(canClaimMinigame(record, FAIR, 1)).toBe(true);

    const first = recordMinigameRun(record, FAIR, 1, 4, true);
    record = first.record;
    expect(first.rewards.length).toBe(2);
    expect(first.newBest).toBe(true);
    expect(canClaimMinigame(record, FAIR, 1)).toBe(false);

    // Same year, a second win grants nothing (and a lower score isn't a new best).
    const second = recordMinigameRun(record, FAIR, 1, 3, true);
    expect(second.rewards.length).toBe(0);
    expect(second.newBest).toBe(false);

    // A new year re-opens the prize.
    expect(canClaimMinigame(record, FAIR, 2)).toBe(true);
    const next = recordMinigameRun(record, FAIR, 2, 4, true);
    expect(next.rewards.length).toBe(2);
  });

  it('a loss never grants the prize but still records the best score', () => {
    const result = recordMinigameRun({}, FAIR, 1, 3, false);
    expect(result.rewards.length).toBe(0);
    expect(result.record['test-fair']?.bestScore).toBe(3);
    expect(result.record['test-fair']?.minigameWonYear).toBeNull();
  });

  it('claims the relationship moment once per year', () => {
    let record = {};
    expect(canClaimRelationship(record, FAIR, 1)).toBe(true);
    const first = claimRelationshipMoment(record, FAIR, 1);
    record = first.record;
    expect(first.claimed).toBe(true);
    expect(first.rewards.length).toBe(1);
    expect(canClaimRelationship(record, FAIR, 1)).toBe(false);

    const second = claimRelationshipMoment(record, FAIR, 1);
    expect(second.claimed).toBe(false);
    expect(second.rewards.length).toBe(0);

    expect(canClaimRelationship(record, FAIR, 2)).toBe(true);
  });

  it('markAttended stamps the year and is idempotent', () => {
    const r1 = markAttended({}, 'test-fair', 1);
    expect(r1['test-fair']?.attendedYear).toBe(1);
    const r2 = markAttended(r1, 'test-fair', 1);
    expect(r2).toBe(r1); // unchanged reference within the same year
  });

  it('emptyFestivalState is the zero record', () => {
    expect(emptyFestivalState()).toEqual({ attendedYear: null, bestScore: 0, minigameWonYear: null, relationshipYear: null });
  });
});

describe('selectors + reward grant integration', () => {
  it('festivalStallRows resolves names', () => {
    const rows = festivalStallRows(FAIR.stall!, (id) => (id === 'pea-jam' ? 'Pea Jam' : id));
    expect(rows).toEqual([{ itemId: 'pea-jam', name: 'Pea Jam', price: 80 }]);
  });

  it('the granted minigame rewards actually land on a save', () => {
    const save = createNewSave({ name: 'Wren', farmName: 'Saltbreak' }, 1000);
    const before = save.wallet.gold;
    const result = recordMinigameRun(save.festivals, FAIR, 1, 4, true);
    save.festivals = result.record;
    grantRewards(save, result.rewards);
    expect(save.wallet.gold).toBe(before + 100);
  });
});

describe('content acceptance — festivals (Prompt 056)', () => {
  const festivals = loadGameContent().festivals;
  const PHASE_ONE = ['seed-blessing', 'glowtide-night', 'harvest-fair'];

  it('ships the four named festivals across the seasons', () => {
    const ids = festivals.map((f) => f.id);
    expect(ids).toContain('seed-blessing');
    expect(ids).toContain('glowtide-night');
    expect(ids).toContain('harvest-fair');
    expect(ids).toContain('frostlight-festival');
  });

  it('enriches the phase-one trio with a minigame, stall, and relationship opportunity', () => {
    for (const id of PHASE_ONE) {
      const f = festivals.find((x) => x.id === id)!;
      expect(f.minigame, `${id} minigame`).not.toBeNull();
      expect(f.stall, `${id} stall`).not.toBeNull();
      expect(f.relationship, `${id} relationship`).not.toBeNull();
      // Each minigame is a non-sport game with a reachable goal and a real prize.
      expect(['forage-hunt', 'lantern-release', 'cook-off', 'fishing-contest']).toContain(f.minigame!.kind);
      expect(f.minigame!.goalScore).toBeLessThanOrEqual(f.minigame!.rounds);
      expect(f.minigame!.rewards.length).toBeGreaterThanOrEqual(1);
      expect(f.stall!.entries.length).toBeGreaterThanOrEqual(1);
      expect(f.relationship!.rewards.length).toBeGreaterThanOrEqual(1);
      // The active window is a valid, non-empty span.
      expect(f.endMinutes).toBeGreaterThan(f.startMinutes);
    }
  });

  it('every phase-one festival minigame is winnable (tap the lit slot each round)', () => {
    for (const id of PHASE_ONE) {
      const f = festivals.find((x) => x.id === id)!;
      let state = startFestivalMinigame(f, 1234)!;
      while (!state.finished) state = tapFestivalSlot(state, state.activeSlot, 1234).state;
      expect(state.won, `${id} should be winnable`).toBe(true);
    }
  });
});
