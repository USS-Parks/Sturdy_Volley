import { describe, it, expect } from 'vitest';
import {
  createNewSave,
  serializeSave,
  parseSave,
  saveSchema,
  SAVE_VERSION,
} from '../../src/engine/saveModel';

describe('save model', () => {
  it('createNewSave produces a schema-valid save', () => {
    const save = createNewSave({ name: 'Wren', farmName: 'Saltbreak' }, 1000);
    expect(saveSchema.safeParse(save).success).toBe(true);
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.calendar).toEqual({ year: 1, season: 'spring', day: 1, timeMinutes: 360 });
    expect(save.location.sceneKey).toBe('Farm');
  });

  it('falls back to defaults for blank names', () => {
    const save = createNewSave({ name: '   ', farmName: '' }, 1000);
    expect(save.player.name).toBe('Coast Keeper');
    expect(save.player.farmName).toBe('Breakpoint Farm');
  });

  it('round-trips through serialize/parse', () => {
    const save = createNewSave({ name: 'Wren', farmName: 'Saltbreak' }, 1000);
    const parsed = parseSave(serializeSave(save));
    expect(parsed).toEqual(save);
  });

  it('rejects non-JSON with a readable message', () => {
    expect(() => parseSave('not json {')).toThrow(/not valid JSON/);
  });

  it('rejects structurally invalid saves with a path in the message', () => {
    const broken = JSON.stringify({ version: SAVE_VERSION, player: { name: 'x' } });
    expect(() => parseSave(broken)).toThrow(/invalid/i);
  });

  it('rejects a save from a different version', () => {
    const save = createNewSave({ name: 'Wren', farmName: 'Saltbreak' }, 1000);
    const wrongVersion = JSON.stringify({ ...save, version: 999 });
    expect(() => parseSave(wrongVersion)).toThrow();
  });
});
