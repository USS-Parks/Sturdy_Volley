import { describe, it, expect, beforeEach } from 'vitest';
import { hasSaveGame, readSave, writeSave, deleteSave, SAVE_KEY } from '../../src/engine/save';
import { createNewSave } from '../../src/engine/saveModel';

beforeEach(() => {
  localStorage.clear();
});

describe('save store', () => {
  it('reports no save initially', () => {
    expect(hasSaveGame()).toBe(false);
    expect(readSave()).toBeNull();
  });

  it('writes then reads a save round-trip', () => {
    const save = createNewSave({ name: 'Wren', farmName: 'Saltbreak' }, 1000);
    writeSave(save);
    expect(hasSaveGame()).toBe(true);
    const loaded = readSave();
    expect(loaded?.player.name).toBe('Wren');
    expect(loaded?.player.farmName).toBe('Saltbreak');
  });

  it('ignores a corrupt stored save', () => {
    localStorage.setItem(SAVE_KEY, '{ not valid');
    expect(readSave()).toBeNull();
  });

  it('deleteSave clears the slot', () => {
    writeSave(createNewSave({ name: 'Wren', farmName: 'Saltbreak' }, 1000));
    deleteSave();
    expect(hasSaveGame()).toBe(false);
  });
});
