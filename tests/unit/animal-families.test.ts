import { describe, it, expect } from 'vitest';
import {
  ANIMAL_FAMILIES,
  familyCanEnterWater,
  familyCanWalkSlope,
  familyForAnimalKind,
  familyForPetKind,
  familyOf,
  gaitSpeed,
} from '../../src/engine/animal-families';

describe('animal families — definitions', () => {
  it('defines the three domestic families with all required per-family fields', () => {
    for (const fam of Object.values(ANIMAL_FAMILIES)) {
      expect(fam.scale).toBeGreaterThan(0);
      expect(fam.bodyProxyRadius).toBeGreaterThan(0);
      expect(fam.gaits.length, `${fam.id} gait bands`).toBeGreaterThanOrEqual(2);
      expect(fam.gaits[0].speed, `${fam.id} idle`).toBe(0);
      expect(fam.turnRate).toBeGreaterThan(0);
      expect(fam.slopeLimitDeg).toBeGreaterThan(0);
      expect(fam.interactionDistance).toBeGreaterThan(0);
      expect(fam.animationClips.length).toBeGreaterThan(0);
      expect(fam.lodTiers.length).toBeGreaterThan(0);
      expect(fam.activationRadius).toBeGreaterThan(0);
      expect(['full', 'position-anchor']).toContain(fam.saveAuthority);
    }
  });

  it('families are genuinely distinct (not one generic mover)', () => {
    const pet = ANIMAL_FAMILIES['small-quadruped-pet'];
    const goat = ANIMAL_FAMILIES['grazing-livestock'];
    const hen = ANIMAL_FAMILIES.poultry;
    // Scale + body proxy + top speed differ across families.
    expect(pet.scale).not.toBe(goat.scale);
    expect(goat.bodyProxyRadius).toBeGreaterThan(hen.bodyProxyRadius);
    expect(gaitSpeed(pet, 'run')).toBeGreaterThan(gaitSpeed(goat, 'trot'));
    // The pet saves a full pose (affection/collar); livestock saves an anchor.
    expect(pet.saveAuthority).toBe('full');
    expect(goat.saveAuthority).toBe('position-anchor');
  });
});

describe('animal families — kind mapping', () => {
  it('maps farm-animal kinds to families', () => {
    expect(familyForAnimalKind('mooncalf-hen')).toBe('poultry');
    expect(familyForAnimalKind('bluff-goat')).toBe('grazing-livestock');
  });

  it('maps pet kinds to the small-quadruped family', () => {
    expect(familyForPetKind('tide-cat')).toBe('small-quadruped-pet');
    expect(familyForPetKind('bay-dog')).toBe('small-quadruped-pet');
  });
});

describe('animal families — capability helpers', () => {
  it('gaitSpeed returns the band, falling back to the fastest gait', () => {
    const goat = familyOf('grazing-livestock');
    expect(gaitSpeed(goat, 'graze')).toBe(0.4);
    expect(gaitSpeed(goat, 'gallop')).toBe(gaitSpeed(goat, 'trot')); // unknown → fastest
  });

  it('water capability gates pond entry (domestic animals stay dry)', () => {
    for (const fam of Object.values(ANIMAL_FAMILIES)) {
      expect(familyCanEnterWater(fam)).toBe(false);
    }
  });

  it('slope capability follows the family slope limit (goats climb steeper than hens)', () => {
    const goat = familyOf('grazing-livestock');
    const hen = familyOf('poultry');
    expect(familyCanWalkSlope(goat, 48)).toBe(true);
    expect(familyCanWalkSlope(hen, 48)).toBe(false);
  });
});
