/**
 * Pets + companion behaviors (Prompt 020). Pure. A single pet lives on
 * the player's farm: a `tide-cat` or `bay-dog`. The engine tracks
 * affection (0..1000), today's pet-water-bowl + petted flags, gift
 * memory, and a tiny follow-vs-idle state machine that the renderer
 * advances each frame.
 *
 * Acceptance criteria (Prompt 020):
 * - Pet follows or idles naturally — `tickPetFollow` chooses a target
 *   position behind the player when the player is moving and outside,
 *   and a randomly drifting idle pose otherwise.
 * - Pet never blocks doors permanently — `tickPetFollow` clears any
 *   target inside a `doorClearRadius` of one of the supplied door
 *   anchors after at most 2 seconds, so even if the pet drifts to a
 *   door the renderer pushes it away on the next tick.
 * - Max affection unlocks a useful but nonmandatory perk — the cat
 *   grants `'comfort'` (stamina regen +1/s while still), and the dog
 *   grants `'forage-sniff'` (one extra forage spawn per night).
 */
export type PetKind = 'tide-cat' | 'bay-dog';

export interface PetDefinition {
  kind: PetKind;
  name: string;
  description: string;
  /** The perk earned at max affection (1000). */
  maxAffectionPerk: 'comfort' | 'forage-sniff';
}

export const PET_DEFS: Record<PetKind, PetDefinition> = {
  'tide-cat': {
    kind: 'tide-cat',
    name: 'Tide Cat',
    description: 'A salt-fluffed cat that loves quiet corners of the porch.',
    maxAffectionPerk: 'comfort',
  },
  'bay-dog': {
    kind: 'bay-dog',
    name: 'Bay Dog',
    description: 'A friendly mutt with a soft bark and a nose for shells.',
    maxAffectionPerk: 'forage-sniff',
  },
};

export interface PetState {
  kind: PetKind;
  name: string;
  /** 0..1000. */
  affection: number;
  pettedToday: boolean;
  /** Player has refilled the water bowl today. */
  bowlFilledToday: boolean;
  /** Cosmetic collar id (`'red'` / `'kelp'` / `'shell'`) or null. */
  collar: 'red' | 'kelp' | 'shell' | null;
  /** Live position in the active scene. */
  x: number;
  z: number;
  /** Internal idle drift target. */
  targetX: number;
  targetZ: number;
  /** Seconds since the pet last picked a new target — used for natural idle. */
  timeOnTarget: number;
}

export function createPet(opts: { kind: PetKind; name: string; x?: number; z?: number }): PetState {
  const x = opts.x ?? 0;
  const z = opts.z ?? 0;
  return {
    kind: opts.kind,
    name: opts.name,
    affection: 100,
    pettedToday: false,
    bowlFilledToday: true,
    collar: null,
    x,
    z,
    targetX: x,
    targetZ: z,
    timeOnTarget: 0,
  };
}

export function petPet(pet: PetState): PetState {
  if (pet.pettedToday) return pet;
  return {
    ...pet,
    pettedToday: true,
    affection: Math.min(1000, pet.affection + 20),
  };
}

export function fillBowl(pet: PetState): PetState {
  if (pet.bowlFilledToday) return pet;
  return {
    ...pet,
    bowlFilledToday: true,
    affection: Math.min(1000, pet.affection + 10),
  };
}

/** Pet completes a fetch round — small affection bump. */
export function playFetch(pet: PetState): PetState {
  return { ...pet, affection: Math.min(1000, pet.affection + 8) };
}

/** A small gift item bump; the catalog of accepted ids is the renderer's job. */
export function giftToPet(pet: PetState, _itemId: string): PetState {
  return { ...pet, affection: Math.min(1000, pet.affection + 30) };
}

export function setCollar(pet: PetState, collar: PetState['collar']): PetState {
  return { ...pet, collar };
}

/**
 * Day-end pet tick. Drains affection a little when the bowl wasn't
 * filled today; resets per-day flags.
 */
export function tickPetDay(pet: PetState): PetState {
  let affection = pet.affection;
  if (pet.pettedToday) affection += 5;
  if (!pet.bowlFilledToday) affection -= 15;
  affection = Math.max(0, Math.min(1000, affection));
  return { ...pet, affection, pettedToday: false, bowlFilledToday: false };
}

/** Max-affection perk check; null until the pet hits 1000. */
export function unlockedPetPerk(pet: PetState): 'comfort' | 'forage-sniff' | null {
  if (pet.affection < 1000) return null;
  return PET_DEFS[pet.kind].maxAffectionPerk;
}

export interface PetTickInput {
  pet: PetState;
  /** Player position in the same scene. */
  playerX: number;
  playerZ: number;
  /** True when the player is walking right now (controller.speed > threshold). */
  playerMoving: boolean;
  /** Door anchors the pet is forbidden from camping on. */
  doors: Array<{ x: number; z: number; radius: number }>;
  /** dt in seconds. */
  dt: number;
  /** PRNG seed (advances each frame; deterministic for tests). */
  seed: number;
}

export interface PetTickResult {
  pet: PetState;
  /** True when the pet just picked a fresh target. */
  retargeted: boolean;
}

const FOLLOW_DISTANCE = 1.8;
const FOLLOW_SPEED = 2.4; // units / second
const IDLE_SPEED = 0.7;
const IDLE_RETARGET_AFTER_SECS = 3.0;
const DOOR_DWELL_LIMIT_SECS = 2.0;

/**
 * Per-frame mover for the pet. Returns the next pet state with `x`/`z`
 * advanced toward the current target plus any retarget that fired.
 * Pure; the renderer just paints whatever it returns.
 */
export function tickPetFollow(input: PetTickInput): PetTickResult {
  let { x, z, targetX, targetZ, timeOnTarget } = input.pet;
  let retargeted = false;
  timeOnTarget += input.dt;
  // Capture the pre-reset dwell so a long-dwelling pet still gets
  // evicted from a door zone even when the idle branch retargets.
  const dwellingTooLong = timeOnTarget > DOOR_DWELL_LIMIT_SECS;

  if (input.playerMoving) {
    // Follow: target is FOLLOW_DISTANCE behind the player.
    const dx = x - input.playerX;
    const dz = z - input.playerZ;
    const len = Math.max(0.0001, Math.hypot(dx, dz));
    targetX = input.playerX + (dx / len) * FOLLOW_DISTANCE;
    targetZ = input.playerZ + (dz / len) * FOLLOW_DISTANCE;
    timeOnTarget = 0;
  } else if (timeOnTarget >= IDLE_RETARGET_AFTER_SECS) {
    // Pick a fresh idle target in a small radius around the player.
    const angle = pseudoFloat(input.seed) * Math.PI * 2;
    const dist = 1.0 + pseudoFloat(input.seed + 17) * 1.6;
    targetX = input.playerX + Math.cos(angle) * dist;
    targetZ = input.playerZ + Math.sin(angle) * dist;
    timeOnTarget = 0;
    retargeted = true;
  }

  // Push targets out of door zones — keep the pet from blocking exits.
  for (const door of input.doors) {
    const dx = targetX - door.x;
    const dz = targetZ - door.z;
    const d = Math.hypot(dx, dz);
    if (d < door.radius) {
      // Move the target to the rim of the door zone.
      const inv = 1 / Math.max(0.0001, d);
      targetX = door.x + dx * inv * (door.radius + 0.2);
      targetZ = door.z + dz * inv * (door.radius + 0.2);
      retargeted = true;
    }
    // Same for the live position: if the pet itself was dwelling inside
    // the door for too long, evict it (pre-reset dwell, so an idle
    // retarget on the same tick can't smuggle a hostile pose past us).
    if (dwellingTooLong) {
      const dx2 = x - door.x;
      const dz2 = z - door.z;
      const d2 = Math.hypot(dx2, dz2);
      if (d2 < door.radius) {
        const inv2 = 1 / Math.max(0.0001, d2);
        x = door.x + dx2 * inv2 * (door.radius + 0.2);
        z = door.z + dz2 * inv2 * (door.radius + 0.2);
      }
    }
  }

  // Advance toward target.
  const speed = input.playerMoving ? FOLLOW_SPEED : IDLE_SPEED;
  const dx = targetX - x;
  const dz = targetZ - z;
  const dist = Math.hypot(dx, dz);
  if (dist > 0.02) {
    const step = Math.min(dist, speed * input.dt);
    x += (dx / dist) * step;
    z += (dz / dist) * step;
  }

  return {
    pet: { ...input.pet, x, z, targetX, targetZ, timeOnTarget },
    retargeted,
  };
}

/** Cheap, deterministic 0..1 floating-point hash for the idle picker. */
function pseudoFloat(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
