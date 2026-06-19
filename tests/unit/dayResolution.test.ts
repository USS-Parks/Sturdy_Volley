import { describe, it, expect } from 'vitest';
import { createNewSave, type SaveData } from '../../src/engine/saveModel';
import {
  getGameTime,
  applyGameTime,
  applyCollapsePenalty,
  resolveDay,
  DEFAULT_COLLAPSE_PENALTY,
} from '../../src/engine/dayResolution';
import { DAY_END_MIN, DAY_START_MIN } from '../../src/engine/timeSystem';
import type { Festival, Npc } from '../../src/data/schemas';

const FESTIVALS: Festival[] = [
  { id: 'seed-blessing', name: 'Seed Blessing', season: 'spring', day: 2, description: 'x' },
];
const NPCS: Npc[] = [
  {
    id: 'mara-vale',
    name: 'Mara Vale',
    role: 'r',
    description: 'd',
    birthday: { season: 'spring', day: 2 },
    lovedGiftItemIds: [],
    romanceable: true,
  },
];

function freshSave(): SaveData {
  return createNewSave({ name: 'Wren', farmName: 'Saltbreak' }, 1000);
}

describe('getGameTime / applyGameTime', () => {
  it('round-trips between save calendar and GameTime', () => {
    const save = freshSave();
    const t = getGameTime(save);
    expect(t).toEqual({ year: 1, season: 'spring', day: 1, minutes: DAY_START_MIN });
    applyGameTime(save, { year: 2, season: 'fall', day: 14, minutes: 12 * 60 });
    expect(save.calendar).toEqual({
      year: 2,
      season: 'fall',
      day: 14,
      timeMinutes: 12 * 60,
    });
  });
});

describe('applyCollapsePenalty', () => {
  it('docks the configured fraction and reports wake stamina', () => {
    const save = freshSave();
    save.wallet.gold = 1000;
    const outcome = applyCollapsePenalty(save);
    expect(outcome.goldLost).toBe(100);
    expect(save.wallet.gold).toBe(900);
    expect(outcome.wakeStamina).toBe(DEFAULT_COLLAPSE_PENALTY.energyFloor);
  });

  it('handles an empty wallet gracefully', () => {
    const save = freshSave();
    save.wallet.gold = 0;
    const outcome = applyCollapsePenalty(save);
    expect(outcome.goldLost).toBe(0);
    expect(save.wallet.gold).toBe(0);
  });

  it('respects a custom penalty', () => {
    const save = freshSave();
    save.wallet.gold = 800;
    const outcome = applyCollapsePenalty(save, { goldFraction: 0.5, energyFloor: 25 });
    expect(outcome.goldLost).toBe(400);
    expect(outcome.wakeStamina).toBe(25);
  });
});

describe('resolveDay', () => {
  it('applies income, rolls the calendar, and lists tomorrow notices', () => {
    const save = freshSave();
    applyGameTime(save, { year: 1, season: 'spring', day: 1, minutes: DAY_END_MIN });
    const before = save.wallet.gold;
    const result = resolveDay({
      save,
      ledger: { income: 150, skillXp: { cultivation: 10 }, relationshipChanges: 1 },
      collapsed: false,
      festivals: FESTIVALS,
      npcs: NPCS,
    });
    expect(save.wallet.gold).toBe(before + 150);
    expect(save.calendar.day).toBe(2);
    expect(save.calendar.timeMinutes).toBe(DAY_START_MIN);
    expect(result.collapse).toBeNull();
    expect(result.summary.income).toBe(150);
    expect(result.summary.skillXp.cultivation).toBe(10);
    expect(result.summary.notices).toContain('Tomorrow: Seed Blessing.');
    expect(result.summary.notices).toContain("Mara Vale's birthday is tomorrow.");
  });

  it('applies the collapse penalty when collapsed', () => {
    const save = freshSave();
    save.wallet.gold = 1000;
    applyGameTime(save, { year: 1, season: 'spring', day: 1, minutes: DAY_END_MIN });
    const result = resolveDay({
      save,
      ledger: { income: 0, skillXp: {}, relationshipChanges: 0 },
      collapsed: true,
      festivals: [],
      npcs: [],
    });
    expect(result.collapse).not.toBeNull();
    expect(result.collapse!.goldLost).toBe(100);
    expect(save.wallet.gold).toBe(900);
    expect(result.summary.notices).toContain('You collapsed and were carried home.');
  });

  it('wraps to summer 1 after spring 28', () => {
    const save = freshSave();
    applyGameTime(save, { year: 1, season: 'spring', day: 28, minutes: DAY_END_MIN });
    const result = resolveDay({
      save,
      ledger: { income: 0, skillXp: {}, relationshipChanges: 0 },
      collapsed: false,
      festivals: [],
      npcs: [],
    });
    expect(save.calendar).toEqual({ year: 1, season: 'summer', day: 1, timeMinutes: DAY_START_MIN });
    expect(result.nextTime.season).toBe('summer');
  });
});
