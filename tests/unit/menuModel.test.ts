import { describe, it, expect } from 'vitest';
import { buildTitleMenu } from '../../src/ui/menuModel';

describe('buildTitleMenu', () => {
  it('returns the four title actions in order', () => {
    const items = buildTitleMenu(false);
    expect(items.map((i) => i.id)).toEqual(['start', 'continue', 'settings', 'credits']);
  });

  it('disables Continue when there is no save', () => {
    const cont = buildTitleMenu(false).find((i) => i.id === 'continue');
    expect(cont?.enabled).toBe(false);
  });

  it('enables Continue when a save exists', () => {
    const cont = buildTitleMenu(true).find((i) => i.id === 'continue');
    expect(cont?.enabled).toBe(true);
  });

  it('gives every item a stable, unique testId', () => {
    const ids = buildTitleMenu(false).map((i) => i.testId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
