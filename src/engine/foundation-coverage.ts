/**
 * Foundation-gate coverage manifest (WEF-12, master Prompt 052). The single
 * source listing what the foundation gate tours — every environment, transition,
 * camera context, traversal type, interaction target type, NPC state, animal
 * family, and simulation tier — each cross-referenced to the Playwright spec that
 * proves it. The gate test (`tests/unit/foundation-gate.test.ts`) asserts this
 * manifest is **complete** against the real source enums (camera contexts, animal
 * families, budget environments), so a new context/family/environment can't ship
 * untoured.
 */
import { foundationEnvironments } from './foundation-budget';

export interface FoundationTour {
  environments: string[];
  transitions: string[];
  cameraContexts: string[];
  traversalTypes: string[];
  targetTypes: string[];
  npcStates: string[];
  animalFamilies: string[];
  simTiers: string[];
}

export const FOUNDATION_TOUR: FoundationTour = {
  environments: foundationEnvironments(),
  transitions: ['farm↔farmhouse', 'farm↔town', 'farm↔river', 'town↔cavern', 'river→town'],
  cameraContexts: ['exterior', 'farm', 'smallInterior', 'largeInterior', 'cave', 'water', 'mounted'],
  traversalTypes: ['walk', 'wade', 'ford', 'bridge', 'stair', 'ledge-link', 'mount-dismount'],
  targetTypes: ['door', 'gate', 'well', 'crop', 'interaction-anchor', 'ledge'],
  npcStates: ['idle', 'wander', 'schedule'],
  animalFamilies: ['small-quadruped-pet', 'grazing-livestock', 'poultry', 'bird', 'shoreline-crawler', 'swimming-fauna', 'cave-creature', 'rideable-mount'],
  simTiers: ['active', 'abstract'],
};

/** Each tour category → the spec(s) that exercise it (audit trail). */
export const TOUR_SPECS: Record<keyof FoundationTour, string[]> = {
  environments: ['breakpoint-farm.spec.ts', 'ballast-bay-town.spec.ts', 'klamity-river.spec.ts', 'rainhall-cavern.spec.ts'],
  transitions: ['breakpoint-farm.spec.ts', 'ballast-bay-town.spec.ts', 'klamity-river.spec.ts', 'rainhall-cavern.spec.ts'],
  cameraContexts: ['camera-lab.spec.ts', 'breakpoint-farm.spec.ts', 'ballast-bay-town.spec.ts', 'rainhall-cavern.spec.ts', 'mount-lab.spec.ts'],
  traversalTypes: ['breakpoint-farm.spec.ts', 'klamity-river.spec.ts', 'rainhall-cavern.spec.ts', 'mount-lab.spec.ts'],
  targetTypes: ['breakpoint-farm.spec.ts', 'ballast-bay-town.spec.ts', 'rainhall-cavern.spec.ts', 'interaction'],
  npcStates: ['fauna-lab.spec.ts', 'ballast-bay-town.spec.ts', 'nav-lab.spec.ts'],
  animalFamilies: ['fauna-lab.spec.ts', 'wild-lab.spec.ts', 'mount-lab.spec.ts'],
  simTiers: ['wild-lab.spec.ts', 'streaming-lab.spec.ts'],
};
