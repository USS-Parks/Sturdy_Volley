/**
 * Animal family framework (WEF-08a, master Prompt 042).
 *
 * Pure data — no Babylon. Defines movement/physics **families** (not one generic
 * mover): each family declares scale, body proxy, gait bands, turning,
 * slope/water capability, obstacle policy, interaction distance, animation
 * needs, LOD/throttle, and save authority. The existing pets + farm animals are
 * mapped to a family and migrated onto the shared foundation (navigation +
 * motor + avoidance + sim tiers) parameterised by these values — while their
 * husbandry data (affection / feeding / produce, in `pets.ts` + `animals.ts`)
 * is untouched.
 *
 * Scale + body proxies follow the friendly-animal base meshes
 * (`sv_theme_03_004_shape_language.png` panel 8) and the chicken/goat scale in
 * `sv_style_007_camera_scale_guide.png` (≈ 1.7–1.8 m human reference).
 */
import type { AnimalKind } from './animals';
import type { PetKind } from './pets';

export type AnimalFamilyId =
  | 'small-quadruped-pet'
  | 'grazing-livestock'
  | 'poultry'
  // Wild families (WEF-08b, Prompt 043).
  | 'bird'
  | 'shoreline-crawler'
  | 'swimming-fauna'
  | 'cave-creature'
  // Rideable mount (Prompt 044) — the horse body; the ridden layer is mount.ts.
  | 'rideable-mount';

/** The behaviours a family exhibits (assembled from `fauna-behavior.ts`). */
export type FaunaBehavior = 'patrol' | 'forage' | 'flee' | 'flock' | 'swim';

export interface GaitBand {
  name: string;
  /** Planar speed (m/s). */
  speed: number;
}

export interface AnimalFamily {
  id: AnimalFamilyId;
  label: string;
  /** Visual scale relative to the ~1.8 m human reference. */
  scale: number;
  /** Collision/avoidance body proxy radius (m). */
  bodyProxyRadius: number;
  /** Body proxy height (m). */
  bodyProxyHeight: number;
  /** Gait bands idle→fastest. */
  gaits: GaitBand[];
  /** Turn rate (rad/s). */
  turnRate: number;
  /** Maximum walkable slope (deg). */
  slopeLimitDeg: number;
  /** Whether the family may enter water (wade/swim). */
  waterCapable: boolean;
  /** How the family treats blockers: steer around, or stop and wait. */
  obstaclePolicy: 'avoid' | 'stop';
  /** Pet/feed/interaction reach (m). */
  interactionDistance: number;
  /** Animation clips the family needs (graybox uses none; real rig honours). */
  animationClips: string[];
  /** LOD swap distances (m), near→far. */
  lodTiers: number[];
  /** Sim-tier active radius (m) from the player. */
  activationRadius: number;
  /** What persists across save: full pose+state, or just a semantic anchor. */
  saveAuthority: 'full' | 'position-anchor';
  /** Whether this is a wild family (vs. a domestic one, Prompt 042). */
  wild?: boolean;
  /** Behaviours this family exhibits (wild families, Prompt 043). */
  behaviors?: FaunaBehavior[];
  /** Whether the player can ride this family (Prompt 044). */
  rideable?: boolean;
  /** Rider seat socket, local offset from the body origin (m). Rideable only. */
  mountAnchor?: { x: number; y: number; z: number };
}

export const ANIMAL_FAMILIES: Record<AnimalFamilyId, AnimalFamily> = {
  'small-quadruped-pet': {
    id: 'small-quadruped-pet',
    label: 'Small quadruped pet',
    scale: 0.45,
    bodyProxyRadius: 0.3,
    bodyProxyHeight: 0.5,
    gaits: [
      { name: 'idle', speed: 0 },
      { name: 'walk', speed: 0.7 },
      { name: 'trot', speed: 2.4 },
      { name: 'run', speed: 3.5 },
    ],
    turnRate: 6,
    slopeLimitDeg: 45,
    waterCapable: false,
    obstaclePolicy: 'avoid',
    interactionDistance: 1.2,
    animationClips: ['idle', 'walk', 'trot', 'sit'],
    lodTiers: [12, 24],
    activationRadius: 24,
    saveAuthority: 'full',
  },
  'grazing-livestock': {
    id: 'grazing-livestock',
    label: 'Grazing livestock',
    scale: 0.55,
    bodyProxyRadius: 0.5,
    bodyProxyHeight: 0.9,
    gaits: [
      { name: 'idle', speed: 0 },
      { name: 'graze', speed: 0.4 },
      { name: 'walk', speed: 1.2 },
      { name: 'trot', speed: 2.0 },
    ],
    turnRate: 3,
    slopeLimitDeg: 50,
    waterCapable: false,
    obstaclePolicy: 'avoid',
    interactionDistance: 1.5,
    animationClips: ['idle', 'graze', 'walk'],
    lodTiers: [16, 32],
    activationRadius: 28,
    saveAuthority: 'position-anchor',
  },
  poultry: {
    id: 'poultry',
    label: 'Poultry',
    scale: 0.3,
    bodyProxyRadius: 0.25,
    bodyProxyHeight: 0.4,
    gaits: [
      { name: 'idle', speed: 0 },
      { name: 'peck', speed: 0.3 },
      { name: 'walk', speed: 0.8 },
    ],
    turnRate: 8,
    slopeLimitDeg: 30,
    waterCapable: false,
    obstaclePolicy: 'avoid',
    interactionDistance: 1.0,
    animationClips: ['idle', 'peck', 'walk'],
    lodTiers: [10, 20],
    activationRadius: 20,
    saveAuthority: 'position-anchor',
  },
  // --- Wild families (WEF-08b) ----------------------------------------------
  bird: {
    id: 'bird',
    label: 'Bird (flocking)',
    scale: 0.2,
    bodyProxyRadius: 0.2,
    bodyProxyHeight: 0.3,
    gaits: [
      { name: 'perch', speed: 0 },
      { name: 'glide', speed: 2.4 },
      { name: 'flush', speed: 4.5 },
    ],
    turnRate: 10,
    slopeLimitDeg: 90,
    waterCapable: false,
    obstaclePolicy: 'avoid',
    interactionDistance: 0,
    animationClips: ['glide', 'flush', 'perch'],
    lodTiers: [20, 40],
    activationRadius: 36,
    saveAuthority: 'position-anchor',
    wild: true,
    behaviors: ['flock', 'flee'],
  },
  'shoreline-crawler': {
    id: 'shoreline-crawler',
    label: 'Shoreline crawler',
    scale: 0.18,
    bodyProxyRadius: 0.22,
    bodyProxyHeight: 0.2,
    gaits: [
      { name: 'still', speed: 0 },
      { name: 'scuttle', speed: 0.9 },
      { name: 'dart', speed: 2.2 },
    ],
    turnRate: 9,
    slopeLimitDeg: 40,
    waterCapable: true,
    obstaclePolicy: 'avoid',
    interactionDistance: 0.8,
    animationClips: ['still', 'scuttle'],
    lodTiers: [8, 16],
    activationRadius: 18,
    saveAuthority: 'position-anchor',
    wild: true,
    behaviors: ['forage', 'flee'],
  },
  'swimming-fauna': {
    id: 'swimming-fauna',
    label: 'Swimming fauna (schooling)',
    scale: 0.22,
    bodyProxyRadius: 0.2,
    bodyProxyHeight: 0.25,
    gaits: [
      { name: 'drift', speed: 0.6 },
      { name: 'swim', speed: 1.8 },
      { name: 'dash', speed: 3.4 },
    ],
    turnRate: 7,
    slopeLimitDeg: 90,
    waterCapable: true,
    obstaclePolicy: 'avoid',
    interactionDistance: 0,
    animationClips: ['swim', 'dash'],
    lodTiers: [14, 28],
    activationRadius: 24,
    saveAuthority: 'position-anchor',
    wild: true,
    behaviors: ['flock', 'swim', 'flee'],
  },
  'cave-creature': {
    id: 'cave-creature',
    label: 'Cave creature',
    scale: 0.4,
    bodyProxyRadius: 0.35,
    bodyProxyHeight: 0.6,
    gaits: [
      { name: 'lurk', speed: 0 },
      { name: 'creep', speed: 0.8 },
      { name: 'skitter', speed: 2.6 },
    ],
    turnRate: 5,
    slopeLimitDeg: 55,
    waterCapable: false,
    obstaclePolicy: 'avoid',
    interactionDistance: 1.0,
    animationClips: ['lurk', 'creep', 'skitter'],
    lodTiers: [10, 20],
    activationRadius: 20,
    saveAuthority: 'position-anchor',
    wild: true,
    behaviors: ['patrol', 'flee'],
  },
  // --- Rideable mount (Prompt 044) ------------------------------------------
  // The horse body — the largest animal, extending the domestic quadruped line
  // (grazing-livestock) with a larger proxy, ford capability, a rider socket,
  // and full save authority (location + tame/ownership). `gaits` here are the
  // **free / riderless** bands; the **ridden** gait bands + ridden motor profile
  // live in `mount.ts`. Silhouette + economy follow the OoT-era low-poly horse
  // (`sv_theme_03_004_shape_language.png` panel 11) sized against the 1.7–1.8 m
  // human in `sv_style_007_camera_scale_guide.png` (withers ≈ 1.6 m).
  'rideable-mount': {
    id: 'rideable-mount',
    label: 'Rideable mount (horse)',
    scale: 1.0,
    bodyProxyRadius: 0.7,
    bodyProxyHeight: 1.7,
    gaits: [
      { name: 'graze', speed: 0 },
      { name: 'amble', speed: 1.0 },
      { name: 'trot', speed: 3.0 },
    ],
    turnRate: 2.2,
    slopeLimitDeg: 40,
    waterCapable: true, // fords shallow water (the ridden layer wades it)
    obstaclePolicy: 'avoid',
    interactionDistance: 2.0, // mount reach
    animationClips: ['idle', 'graze', 'walk', 'trot', 'canter', 'gallop'],
    lodTiers: [24, 48],
    activationRadius: 40, // visible/usable from far — horse-speed traversal
    saveAuthority: 'full', // location + tame/ownership
    rideable: true,
    mountAnchor: { x: 0, y: 1.5, z: 0 }, // saddle seat above the body
  },
};

/** Family for a farm-animal kind (`animals.ts`). */
export function familyForAnimalKind(kind: AnimalKind): AnimalFamilyId {
  return kind === 'mooncalf-hen' ? 'poultry' : 'grazing-livestock';
}

/** Family for a pet kind (`pets.ts`). */
export function familyForPetKind(_kind: PetKind): AnimalFamilyId {
  return 'small-quadruped-pet';
}

export function familyOf(id: AnimalFamilyId): AnimalFamily {
  return ANIMAL_FAMILIES[id];
}

/** Speed (m/s) for a named gait, or the fastest gait if the name is unknown. */
export function gaitSpeed(family: AnimalFamily, gaitName: string): number {
  const band = family.gaits.find((g) => g.name === gaitName);
  if (band) return band.speed;
  return family.gaits.reduce((m, g) => Math.max(m, g.speed), 0);
}

export function familyCanEnterWater(family: AnimalFamily): boolean {
  return family.waterCapable;
}

export function familyCanWalkSlope(family: AnimalFamily, deg: number): boolean {
  return deg <= family.slopeLimitDeg + 1e-9;
}

/** All wild families (Prompt 043). */
export function wildFamilies(): AnimalFamily[] {
  return Object.values(ANIMAL_FAMILIES).filter((f) => f.wild === true);
}

/** Whether a family can be ridden (Prompt 044). */
export function isRideableFamily(family: AnimalFamily): boolean {
  return family.rideable === true;
}

/** All rideable families (Prompt 044). */
export function rideableFamilies(): AnimalFamily[] {
  return Object.values(ANIMAL_FAMILIES).filter((f) => f.rideable === true);
}

/** Whether a family exhibits a given behaviour. */
export function familyHasBehavior(family: AnimalFamily, behavior: FaunaBehavior): boolean {
  return family.behaviors?.includes(behavior) ?? false;
}
