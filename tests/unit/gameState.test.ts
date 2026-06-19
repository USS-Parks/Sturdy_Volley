import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDayLedger,
  recordIncome,
  recordSkillXp,
  recordRelationshipChange,
  resetDayLedger,
} from '../../src/engine/gameState';

beforeEach(() => resetDayLedger());

describe('day ledger', () => {
  it('starts empty', () => {
    expect(getDayLedger()).toEqual({ income: 0, skillXp: {}, relationshipChanges: 0 });
  });

  it('accumulates income, skill XP, and relationship deltas', () => {
    recordIncome(120);
    recordIncome(30);
    recordSkillXp('cultivation', 5);
    recordSkillXp('cultivation', 3);
    recordSkillXp('angling', 2);
    recordRelationshipChange(1);
    recordRelationshipChange(-2);
    const ledger = getDayLedger();
    expect(ledger.income).toBe(150);
    expect(ledger.skillXp).toEqual({ cultivation: 8, angling: 2 });
    expect(ledger.relationshipChanges).toBe(3);
  });

  it('ignores non-positive XP and clamps negative income', () => {
    recordIncome(-100);
    recordSkillXp('forage', 0);
    recordSkillXp('forage', -5);
    expect(getDayLedger()).toEqual({ income: 0, skillXp: {}, relationshipChanges: 0 });
  });

  it('resetDayLedger zeroes the totals', () => {
    recordIncome(50);
    recordSkillXp('mining', 4);
    resetDayLedger();
    expect(getDayLedger()).toEqual({ income: 0, skillXp: {}, relationshipChanges: 0 });
  });
});
