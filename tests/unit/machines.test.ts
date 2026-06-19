import { describe, it, expect } from 'vitest';
import {
  MACHINE_CATALOG,
  collectMachine,
  createMachine,
  findRecipeForInput,
  isDaylight,
  loadMachine,
  newlyReady,
  remainingMinutes,
  statusOf,
} from '../../src/engine/machines';
import { addItem, createContainer } from '../../src/engine/inventory';
import { createNewSave, parseSave, serializeSave } from '../../src/engine/saveModel';

describe('machines (Prompt 018)', () => {
  it('ships the five Prompt 018 kinds', () => {
    const kinds = Object.keys(MACHINE_CATALOG).sort();
    expect(kinds).toEqual(
      ['brine-barrel', 'cheese-drum', 'herb-dryer', 'honey-spinner', 'oil-press'].sort(),
    );
  });

  it('findRecipeForInput resolves an accepted input to a recipe index', () => {
    expect(findRecipeForInput('cheese-drum', 'bluff-goat-milk')).toBe(0);
    expect(findRecipeForInput('cheese-drum', 'driftwood')).toBeNull();
  });

  it('loadMachine consumes input + fuel and stamps a start time', () => {
    const m = createMachine({ id: 'm', kind: 'brine-barrel', sceneKey: 'Farm', x: 0, z: 0 });
    let c = createContainer(8);
    c = addItem(c, 'blush-radish', 2).container;
    c = addItem(c, 'salt', 1).container;
    const r = loadMachine({ state: m, container: c, itemId: 'blush-radish', nowAbsoluteMinutes: 600 });
    expect(r.accepted).toBe(true);
    expect(r.state.startMinutes).toBe(600);
    expect(r.state.recipeIndex).toBe(0);
    // Ingredients + fuel gone.
    expect(r.container.slots.some((s) => s?.itemId === 'blush-radish')).toBe(false);
    expect(r.container.slots.some((s) => s?.itemId === 'salt')).toBe(false);
  });

  it('loadMachine rejects when fuel is missing', () => {
    const m = createMachine({ id: 'm', kind: 'brine-barrel', sceneKey: 'Farm', x: 0, z: 0 });
    let c = createContainer(8);
    c = addItem(c, 'blush-radish', 2).container;
    const r = loadMachine({ state: m, container: c, itemId: 'blush-radish', nowAbsoluteMinutes: 600 });
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('missing-fuel');
  });

  it('loadMachine rejects an unsupported input', () => {
    const m = createMachine({ id: 'm', kind: 'cheese-drum', sceneKey: 'Farm', x: 0, z: 0 });
    let c = createContainer(4);
    c = addItem(c, 'driftwood', 5).container;
    const r = loadMachine({ state: m, container: c, itemId: 'driftwood', nowAbsoluteMinutes: 600 });
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('unsupported-input');
  });

  it('the herb dryer refuses input after dark', () => {
    const m = createMachine({ id: 'm', kind: 'herb-dryer', sceneKey: 'Farm', x: 0, z: 0 });
    let c = createContainer(4);
    c = addItem(c, 'harborlime', 2).container;
    const night = 22 * 60;
    const r = loadMachine({ state: m, container: c, itemId: 'harborlime', nowAbsoluteMinutes: night });
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('after-dark');
    expect(isDaylight(22 * 60)).toBe(false);
    expect(isDaylight(10 * 60)).toBe(true);
  });

  it('statusOf walks idle → processing → ready', () => {
    const m = createMachine({ id: 'm', kind: 'cheese-drum', sceneKey: 'Farm', x: 0, z: 0 });
    let c = createContainer(2);
    c = addItem(c, 'bluff-goat-milk', 1).container;
    const start = 6 * 60;
    const r = loadMachine({ state: m, container: c, itemId: 'bluff-goat-milk', nowAbsoluteMinutes: start });
    expect(r.accepted).toBe(true);
    expect(statusOf(r.state, start)).toBe('processing');
    const recipeMin = MACHINE_CATALOG['cheese-drum'].recipes[0]!.processMinutes;
    expect(statusOf(r.state, start + recipeMin - 1)).toBe('processing');
    expect(statusOf(r.state, start + recipeMin)).toBe('ready');
    expect(remainingMinutes(r.state, start + recipeMin / 2)).toBe(Math.ceil(recipeMin / 2));
  });

  it('collectMachine refuses when not ready and yields the output stack when ready', () => {
    const m = createMachine({ id: 'm', kind: 'oil-press', sceneKey: 'Farm', x: 0, z: 0 });
    let c = createContainer(2);
    c = addItem(c, 'sunmelon', 1).container;
    const start = 6 * 60;
    const loaded = loadMachine({ state: m, container: c, itemId: 'sunmelon', nowAbsoluteMinutes: start });
    expect(loaded.accepted).toBe(true);
    const early = collectMachine({ state: loaded.state, container: loaded.container, nowAbsoluteMinutes: start + 10 });
    expect(early.accepted).toBe(false);
    expect(early.reason).toBe('not-ready');
    const ready = MACHINE_CATALOG['oil-press'].recipes[0]!.processMinutes;
    const done = collectMachine({
      state: loaded.state,
      container: loaded.container,
      nowAbsoluteMinutes: start + ready,
    });
    expect(done.accepted).toBe(true);
    expect(done.output?.itemId).toBe('sunmelon-oil');
    expect(done.output?.quality).toBe(1);
    expect(done.state.startMinutes).toBeNull();
  });

  it('newlyReady returns machines that crossed the ready threshold this tick', () => {
    const m = createMachine({ id: 'm', kind: 'honey-spinner', sceneKey: 'Farm', x: 0, z: 0 });
    let c = createContainer(2);
    c = addItem(c, 'raw-honeycomb', 1).container;
    const start = 6 * 60;
    const loaded = loadMachine({ state: m, container: c, itemId: 'raw-honeycomb', nowAbsoluteMinutes: start });
    expect(loaded.accepted).toBe(true);
    const ready = MACHINE_CATALOG['honey-spinner'].recipes[0]!.processMinutes;
    const transitions = newlyReady([loaded.state], start + ready - 5, start + ready + 5);
    expect(transitions.map((s) => s.id)).toEqual(['m']);
    // Same tick window after ready already happened: nothing new.
    expect(newlyReady([loaded.state], start + ready + 5, start + ready + 60)).toEqual([]);
  });
});

describe('machines + save round-trip', () => {
  it('seeds five Farm machines in fresh saves and survives serialize/parse', () => {
    const save = createNewSave({ name: 'Mill', farmName: 'Press' }, 0);
    expect(Object.keys(save.machines ?? {})).toHaveLength(5);
    const round = parseSave(serializeSave(save));
    expect(Object.keys(round.machines ?? {})).toHaveLength(5);
    const oil = round.machines!['Farm:oil-press:1'];
    expect(oil?.kind).toBe('oil-press');
    expect(oil?.sceneKey).toBe('Farm');
  });
});
