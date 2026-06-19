import type { Container, SaveData } from './saveModel';
import { addItem } from './inventory';
import type { Animal, Weather } from '../data/schemas';

/**
 * Animal husbandry (Prompt 019). Pure. Each animal instance carries a
 * stable id, a kind (`mooncalf-hen` / `bluff-goat` for the Prompt 019
 * scope), an affection counter (0..1000), per-day "fed" + "petted" flags,
 * and a `daysSinceProduce` counter that ticks down each morning. The day
 * tick rewards fed + sheltered animals with their product item; lonely or
 * exposed animals lose affection.
 */
export type AnimalKind = 'mooncalf-hen' | 'bluff-goat';

export type AnimalMood = 'happy' | 'content' | 'lonely' | 'cold';

export interface AnimalInstance {
  id: string;
  kind: AnimalKind;
  name: string;
  habitat: 'coop' | 'barn' | 'pasture';
  /** 0..1000. Hearts are levels at 200, 400, 600, 800, 1000. */
  affection: number;
  /** Days the player has fed the animal in a row up to today. */
  fedToday: boolean;
  pettedToday: boolean;
  /** Days since the animal last yielded its product. */
  daysSinceProduce: number;
  /** Days since the animal was last petted (used for the lonely band). */
  daysSincePetted: number;
  /** Whether the animal is currently outside its building. */
  outside: boolean;
}

export interface AnimalDefinition extends Animal {
  /** Heart threshold to start yielding produce (affection / 100). */
  produceMinHearts: number;
  /** Default affection floor for new instances. */
  startingAffection: number;
}

export const ANIMAL_DEFS: Record<AnimalKind, AnimalDefinition> = {
  'mooncalf-hen': {
    id: 'mooncalf-hen',
    name: 'Mooncalf Hen',
    species: 'hen',
    habitat: 'coop',
    produceItemId: 'mooncalf-egg',
    daysToMature: 1,
    produceMinHearts: 0,
    startingAffection: 100,
  },
  'bluff-goat': {
    id: 'bluff-goat',
    name: 'Bluff Goat',
    species: 'goat',
    habitat: 'barn',
    produceItemId: 'bluff-goat-milk',
    daysToMature: 2,
    produceMinHearts: 2,
    startingAffection: 100,
  },
};

export function createAnimal(opts: {
  id: string;
  kind: AnimalKind;
  name: string;
}): AnimalInstance {
  const def = ANIMAL_DEFS[opts.kind];
  return {
    id: opts.id,
    kind: opts.kind,
    name: opts.name,
    habitat: def.habitat,
    affection: def.startingAffection,
    fedToday: true, // start fed so Day 1 isn't a sad face
    pettedToday: false,
    daysSinceProduce: def.daysToMature,
    daysSincePetted: 0,
    outside: false,
  };
}

export function heartsOf(animal: AnimalInstance): number {
  return Math.floor(animal.affection / 200);
}

export interface MoodInput {
  animal: AnimalInstance;
  weather: Weather | null;
  /** True when the animal is presently inside its building. */
  sheltered: boolean;
}

/**
 * Live mood derivation. Cold beats lonely beats content; a happy animal
 * needs both today's pet *and* today's feed.
 */
export function moodOf(input: MoodInput): AnimalMood {
  const exposedRain = input.weather?.id === 'windstorm' || input.weather?.id === 'rain';
  if (exposedRain && !input.sheltered) return 'cold';
  if (input.animal.daysSincePetted >= 3) return 'lonely';
  if (input.animal.pettedToday && input.animal.fedToday) return 'happy';
  return 'content';
}

export interface FeedResult {
  accepted: boolean;
  reason?: 'already-fed' | 'no-feed';
  animal: AnimalInstance;
  container: Container;
}

const HAY_ITEM_ID = 'hay';
export const FEED_ITEM_ID = HAY_ITEM_ID;

export function feedAnimal(input: {
  animal: AnimalInstance;
  container: Container;
}): FeedResult {
  if (input.animal.fedToday) {
    return { accepted: false, reason: 'already-fed', animal: input.animal, container: input.container };
  }
  // Look for hay in the player's inventory.
  let removed = 0;
  const next: Container = {
    slots: input.container.slots.map((s) => (s ? { ...s } : null)),
    capacity: input.container.capacity,
  };
  for (let i = 0; i < next.slots.length && removed < 1; i++) {
    const slot = next.slots[i];
    if (!slot || slot.itemId !== HAY_ITEM_ID) continue;
    slot.qty -= 1;
    removed = 1;
    if (slot.qty <= 0) next.slots[i] = null;
  }
  if (removed === 0) {
    return { accepted: false, reason: 'no-feed', animal: input.animal, container: input.container };
  }
  return {
    accepted: true,
    animal: { ...input.animal, fedToday: true, affection: Math.min(1000, input.animal.affection + 5) },
    container: next,
  };
}

export function petAnimal(animal: AnimalInstance): AnimalInstance {
  if (animal.pettedToday) return animal;
  return {
    ...animal,
    pettedToday: true,
    daysSincePetted: 0,
    affection: Math.min(1000, animal.affection + 15),
  };
}

export interface AnimalDayTickInput {
  animal: AnimalInstance;
  weather: Weather | null;
  sheltered: boolean;
}

export interface AnimalDayTickResult {
  animal: AnimalInstance;
  /** Product to drop into the collection bin, when the animal produced one. */
  product?: { itemId: string; qty: number; quality: number };
  /** Mood at the end of the day — used in summary notes. */
  mood: AnimalMood;
}

export function tickAnimalDay(input: AnimalDayTickInput): AnimalDayTickResult {
  const def = ANIMAL_DEFS[input.animal.kind];
  const exposed = (input.weather?.id === 'windstorm' || input.weather?.id === 'rain') && !input.sheltered;

  let affection = input.animal.affection;
  if (input.animal.pettedToday) affection += 5;
  if (!input.animal.fedToday) affection -= 25;
  if (exposed) affection -= 15;
  affection = Math.max(0, Math.min(1000, affection));

  const matured = input.animal.fedToday && input.animal.daysSinceProduce + 1 >= def.daysToMature;
  const hearts = Math.floor(affection / 200);
  const canProduce = matured && hearts >= def.produceMinHearts && !exposed;
  const quality = hearts >= 4 ? 2 : hearts >= 2 ? 1 : 0;

  const next: AnimalInstance = {
    ...input.animal,
    affection,
    fedToday: false,
    pettedToday: false,
    daysSincePetted: input.animal.pettedToday ? 0 : input.animal.daysSincePetted + 1,
    daysSinceProduce: canProduce ? 0 : input.animal.daysSinceProduce + 1,
    outside: false,
  };

  // Mood reflects the day that JUST ended (pre-reset flags), not the
  // fresh-state of `next` which is already cleared for tomorrow.
  const endOfDayMood = moodOf({ animal: input.animal, weather: input.weather, sheltered: input.sheltered });
  return {
    animal: next,
    product: canProduce ? { itemId: def.produceItemId, qty: 1, quality } : undefined,
    mood: endOfDayMood,
  };
}

/**
 * Day-end pass that runs every animal in the save through `tickAnimalDay`,
 * dropping products into the supplied container (the building's collection
 * bin or the player's inventory). Mutates `save.animals` in place.
 */
export interface ResolveAnimalsInput {
  save: SaveData;
  weather: Weather | null;
  /** Map from animal id to whether that animal is currently sheltered. */
  shelteredById: Record<string, boolean>;
  /** Container to receive produced items (typically the shipping bin). */
  bin: Container;
}

export interface ResolveAnimalsResult {
  bin: Container;
  produced: Array<{ itemId: string; qty: number; quality: number }>;
  moodCounts: Record<AnimalMood, number>;
}

export function resolveAnimalsDay(input: ResolveAnimalsInput): ResolveAnimalsResult {
  const moodCounts: Record<AnimalMood, number> = { happy: 0, content: 0, lonely: 0, cold: 0 };
  const produced: Array<{ itemId: string; qty: number; quality: number }> = [];
  let bin = input.bin;
  for (const animal of Object.values(input.save.animals ?? {})) {
    const result = tickAnimalDay({
      animal,
      weather: input.weather,
      sheltered: input.shelteredById[animal.id] ?? true,
    });
    input.save.animals![animal.id] = result.animal;
    moodCounts[result.mood] += 1;
    if (result.product) {
      const add = addItem(bin, result.product.itemId, result.product.qty, result.product.quality);
      bin = add.container;
      if (add.added > 0) produced.push(result.product);
    }
  }
  return { bin, produced, moodCounts };
}

/** Daylight rule: animals path outdoors between 7 AM and 6 PM in good weather. */
export function shouldBeOutside(timeMinutes: number, weather: Weather | null): boolean {
  if (
    weather?.id === 'windstorm' ||
    weather?.id === 'rain' ||
    weather?.id === 'sea-fog'
  ) {
    return false;
  }
  return timeMinutes >= 7 * 60 && timeMinutes < 18 * 60;
}
