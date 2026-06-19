import { describe, it, expect } from 'vitest';
import {
  PET_DEFS,
  createPet,
  fillBowl,
  petPet,
  playFetch,
  setCollar,
  tickPetDay,
  tickPetFollow,
  unlockedPetPerk,
} from '../../src/engine/pets';
import { createNewSave, parseSave, serializeSave } from '../../src/engine/saveModel';

describe('pets engine (Prompt 020)', () => {
  it('ships tide-cat + bay-dog defs with distinct perks', () => {
    expect(Object.keys(PET_DEFS).sort()).toEqual(['bay-dog', 'tide-cat']);
    expect(PET_DEFS['tide-cat'].maxAffectionPerk).toBe('comfort');
    expect(PET_DEFS['bay-dog'].maxAffectionPerk).toBe('forage-sniff');
  });

  it('petPet, fillBowl, playFetch all bump affection', () => {
    const p = createPet({ kind: 'tide-cat', name: 'Pixel' });
    const after = playFetch(fillBowl(petPet({ ...p, bowlFilledToday: false })));
    expect(after.affection).toBe(100 + 20 + 10 + 8);
  });

  it('petPet is idempotent within a single day', () => {
    const p = petPet(createPet({ kind: 'tide-cat', name: 'Pixel' }));
    expect(petPet(p)).toEqual(p);
  });

  it('tickPetDay drains affection when bowl wasn\'t filled', () => {
    const p = { ...createPet({ kind: 'bay-dog', name: 'Drift' }), bowlFilledToday: false };
    const after = tickPetDay(p);
    expect(after.affection).toBe(p.affection - 15);
    expect(after.bowlFilledToday).toBe(false); // reset for tomorrow
  });

  it('unlockedPetPerk gates on 1000 affection', () => {
    const p = createPet({ kind: 'tide-cat', name: 'Pixel' });
    expect(unlockedPetPerk(p)).toBeNull();
    expect(unlockedPetPerk({ ...p, affection: 1000 })).toBe('comfort');
    expect(unlockedPetPerk({ ...createPet({ kind: 'bay-dog', name: 'Drift' }), affection: 1000 })).toBe('forage-sniff');
  });

  it('setCollar updates the cosmetic field', () => {
    const p = createPet({ kind: 'tide-cat', name: 'Pixel' });
    expect(setCollar(p, 'kelp').collar).toBe('kelp');
    expect(setCollar(p, null).collar).toBeNull();
  });

  it('tickPetFollow follows the player when moving and idles when still', () => {
    const p = createPet({ kind: 'bay-dog', name: 'Drift', x: 0, z: 0 });
    const moving = tickPetFollow({
      pet: p,
      playerX: 5,
      playerZ: 0,
      playerMoving: true,
      doors: [],
      dt: 0.5,
      seed: 1,
    });
    // Pet should have moved positively along x toward the player's wake.
    expect(moving.pet.x).toBeGreaterThan(0);

    // After 4 seconds idle, retarget fires.
    const idle = tickPetFollow({
      pet: { ...p, timeOnTarget: 4 },
      playerX: 0,
      playerZ: 0,
      playerMoving: false,
      doors: [],
      dt: 0.5,
      seed: 7,
    });
    expect(idle.retargeted).toBe(true);
  });

  it('tickPetFollow keeps targets out of door zones', () => {
    const p = createPet({ kind: 'tide-cat', name: 'Pixel', x: 0.2, z: 0.0 });
    const result = tickPetFollow({
      pet: { ...p, timeOnTarget: 5 }, // beyond dwell limit
      playerX: 0,
      playerZ: 0,
      playerMoving: false,
      doors: [{ x: 0, z: 0, radius: 1.0 }],
      dt: 0.1,
      seed: 1,
    });
    const dist = Math.hypot(result.pet.targetX, result.pet.targetZ);
    expect(dist).toBeGreaterThanOrEqual(1.0);
    // Pet position was also evicted from inside the door zone.
    const liveDist = Math.hypot(result.pet.x, result.pet.z);
    expect(liveDist).toBeGreaterThanOrEqual(1.0);
  });

  it('createNewSave seeds a Pixel the tide-cat pet that survives serialize/parse', () => {
    const save = createNewSave({ name: 'A', farmName: 'B' }, 0);
    expect(save.pet?.kind).toBe('tide-cat');
    expect(save.pet?.name).toBe('Pixel');
    const round = parseSave(serializeSave(save));
    expect(round.pet?.kind).toBe('tide-cat');
  });
});
