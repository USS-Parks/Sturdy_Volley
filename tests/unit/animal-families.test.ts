import { describe, it, expect } from 'vitest';
import {
  ANIMAL_FAMILIES,
  familyCanEnterWater,
  familyCanWalkSlope,
  familyForAnimalKind,
  familyForPetKind,
  familyOf,
  gaitSpeed,
  isRideableFamily,
  rideableFamilies,
} from '../../src/engine/animal-families';

const DOMESTIC = Object.values(ANIMAL_FAMILIES).filter((f) => !f.wild);

describe('animal families — definitions', () => {
  it('defines the four domestic families with all required per-family fields', () => {
    // small-quadruped-pet, grazing-livestock, poultry, rideable-mount (Prompt 044).
    expect(DOMESTIC.length).toBe(4);
    for (const fam of DOMESTIC) {
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

  it('water capability gates pond entry (domestic farm animals stay dry)', () => {
    // The rideable mount fords shallow water (asserted separately); the pet +
    // farm animals never enter the pond.
    for (const fam of DOMESTIC.filter((f) => !f.rideable)) {
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

describe('animal families — rideable mount (Prompt 044)', () => {
  const horse = familyOf('rideable-mount');

  it('is the rideable family, with a mount-anchor socket', () => {
    expect(isRideableFamily(horse)).toBe(true);
    expect(rideableFamilies().map((f) => f.id)).toEqual(['rideable-mount']);
    expect(horse.mountAnchor).toBeDefined();
    expect(horse.mountAnchor!.y).toBeGreaterThan(1); // saddle sits above the body
  });

  it('is the largest animal body and fords shallow water', () => {
    const goat = familyOf('grazing-livestock');
    // Larger proxy + scale than the grazing livestock it extends.
    expect(horse.bodyProxyRadius).toBeGreaterThan(goat.bodyProxyRadius);
    expect(horse.scale).toBeGreaterThan(goat.scale);
    // Ford capability (shallow water), and a full save (location + ownership).
    expect(familyCanEnterWater(horse)).toBe(true);
    expect(horse.saveAuthority).toBe('full');
  });

  it('carries free / riderless gait bands (the ridden bands live in mount.ts)', () => {
    expect(horse.gaits[0].speed).toBe(0); // graze/halt at rest
    expect(gaitSpeed(horse, 'trot')).toBeGreaterThan(gaitSpeed(horse, 'amble'));
  });

  it('is not a wild family', () => {
    expect(horse.wild).not.toBe(true);
  });
});
