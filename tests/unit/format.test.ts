import { describe, it, expect } from 'vitest';
import { formatClock, capitalize, formatSaveStatus } from '../../src/engine/format';
import { createNewSave } from '../../src/engine/saveModel';

describe('formatClock', () => {
  it('formats midnight, morning, noon, and afternoon', () => {
    expect(formatClock(0)).toBe('12:00 AM');
    expect(formatClock(6 * 60)).toBe('6:00 AM');
    expect(formatClock(12 * 60)).toBe('12:00 PM');
    expect(formatClock(13 * 60 + 5)).toBe('1:05 PM');
  });

  it('wraps values outside a single day', () => {
    expect(formatClock(25 * 60)).toBe('1:00 AM');
    expect(formatClock(-60)).toBe('11:00 PM');
  });
});

describe('capitalize', () => {
  it('capitalizes the first letter', () => {
    expect(capitalize('spring')).toBe('Spring');
    expect(capitalize('')).toBe('');
  });
});

describe('formatSaveStatus', () => {
  it('renders player, calendar, and clock', () => {
    const save = createNewSave({ name: 'Wren', farmName: 'Saltbreak' }, 1000);
    expect(formatSaveStatus(save)).toBe('Wren · Year 1, Spring 1 · 6:00 AM');
  });
});
