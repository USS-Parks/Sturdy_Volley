import { describe, it, expect } from 'vitest';
import {
  ANIMAL_DEFS,
  createAnimal,
  feedAnimal,
  heartsOf,
  moodOf,
  petAnimal,
  resolveAnimalsDay,
  shouldBeOutside,
  tickAnimalDay,
} from '../../src/engine/animals';
import { addItem, createContainer } from '../../src/engine/inventory';
import { createNewSave, parseSave, serializeSave } from '../../src/engine/saveModel';
import type { Weather } from '../../src/data/schemas';

const SUNNY: Weather = { id: 'sunny', name: 'Sunny', description: 'x', affectsTravel: false };
const RAIN: Weather = { id: 'rain', name: 'Rain', description: 'x', affectsTravel: true };

describe('animals (Prompt 019)', () => {
  it('ships hen + goat defs', () => {
    expect(Object.keys(ANIMAL_DEFS).sort()).toEqual(['bluff-goat', 'mooncalf-hen']);
    expect(ANIMAL_DEFS['mooncalf-hen'].produceItemId).toBe('mooncalf-egg');
    expect(ANIMAL_DEFS['bluff-goat'].produceItemId).toBe('bluff-goat-milk');
  });

  it('petAnimal sets pettedToday once and adds affection', () => {
    const a = createAnimal({ id: 'a', kind: 'mooncalf-hen', name: 'Pip' });
    const next = petAnimal(a);
    expect(next.pettedToday).toBe(true);
    expect(next.affection).toBe(a.affection + 15);
    expect(petAnimal(next)).toEqual(next); // idempotent same-day
  });

  it('feedAnimal consumes one hay and rejects if missing', () => {
    const a = { ...createAnimal({ id: 'a', kind: 'bluff-goat', name: 'Clover' }), fedToday: false };
    let c = createContainer(4);
    const empty = feedAnimal({ animal: a, container: c });
    expect(empty.accepted).toBe(false);
    expect(empty.reason).toBe('no-feed');
    c = addItem(c, 'hay', 3).container;
    const ok = feedAnimal({ animal: a, container: c });
    expect(ok.accepted).toBe(true);
    expect(ok.animal.fedToday).toBe(true);
    // 3 hay - 1 = 2 left.
    const hay = ok.container.slots.find((s) => s?.itemId === 'hay');
    expect(hay?.qty).toBe(2);
  });

  it('moodOf cold beats lonely beats happy/content', () => {
    const a = createAnimal({ id: 'a', kind: 'mooncalf-hen', name: 'Pip' });
    expect(moodOf({ animal: a, weather: SUNNY, sheltered: true })).toBe('content');
    const happy = { ...a, pettedToday: true, fedToday: true };
    expect(moodOf({ animal: happy, weather: SUNNY, sheltered: true })).toBe('happy');
    const lonely = { ...a, daysSincePetted: 5 };
    expect(moodOf({ animal: lonely, weather: SUNNY, sheltered: true })).toBe('lonely');
    expect(moodOf({ animal: lonely, weather: RAIN, sheltered: false })).toBe('cold');
  });

  it('tickAnimalDay produces an egg for a fed, mature hen and skips it when exposed', () => {
    const fed = createAnimal({ id: 'a', kind: 'mooncalf-hen', name: 'Pip' });
    // Default daysSinceProduce = daysToMature, so first tick already matures.
    const out = tickAnimalDay({ animal: { ...fed, fedToday: true }, weather: SUNNY, sheltered: true });
    expect(out.product?.itemId).toBe('mooncalf-egg');
    expect(out.animal.daysSinceProduce).toBe(0);
    expect(out.animal.fedToday).toBe(false);

    const exposed = tickAnimalDay({ animal: { ...fed, fedToday: true }, weather: RAIN, sheltered: false });
    expect(exposed.product).toBeUndefined();
  });

  it('unfed animals lose affection and don\'t produce', () => {
    const a = { ...createAnimal({ id: 'a', kind: 'bluff-goat', name: 'Clover' }), fedToday: false };
    const out = tickAnimalDay({ animal: a, weather: SUNNY, sheltered: true });
    expect(out.product).toBeUndefined();
    expect(out.animal.affection).toBe(a.affection - 25);
  });

  it('heartsOf returns 0..5 based on affection / 200', () => {
    expect(heartsOf({ ...createAnimal({ id: 'x', kind: 'mooncalf-hen', name: 'p' }), affection: 0 })).toBe(0);
    expect(heartsOf({ ...createAnimal({ id: 'x', kind: 'mooncalf-hen', name: 'p' }), affection: 400 })).toBe(2);
    expect(heartsOf({ ...createAnimal({ id: 'x', kind: 'mooncalf-hen', name: 'p' }), affection: 1000 })).toBe(5);
  });

  it('resolveAnimalsDay drops products into the bin and counts moods', () => {
    const save = createNewSave({ name: 'Pat', farmName: 'Tide' }, 0);
    // Force both animals into a state that produces this morning.
    for (const a of Object.values(save.animals!)) {
      a.fedToday = true;
      a.pettedToday = true;
      a.daysSinceProduce = ANIMAL_DEFS[a.kind].daysToMature;
      a.affection = 400; // ≥ 2 hearts
    }
    const r = resolveAnimalsDay({ save, weather: SUNNY, shelteredById: {}, bin: save.shippingBin });
    expect(r.produced.length).toBe(2);
    expect(r.moodCounts.happy).toBe(2);
  });

  it('shouldBeOutside denies night / storm / fog', () => {
    expect(shouldBeOutside(12 * 60, SUNNY)).toBe(true);
    expect(shouldBeOutside(3 * 60, SUNNY)).toBe(false);
    expect(shouldBeOutside(12 * 60, RAIN)).toBe(false);
  });

  it('createNewSave seeds Pip the hen and Clover the goat', () => {
    const save = createNewSave({ name: 'Pat', farmName: 'Tide' }, 0);
    expect(save.animals?.['Farm:hen:1']?.name).toBe('Pip');
    expect(save.animals?.['Farm:goat:1']?.name).toBe('Clover');
    const round = parseSave(serializeSave(save));
    expect(round.animals?.['Farm:hen:1']?.kind).toBe('mooncalf-hen');
  });
});
