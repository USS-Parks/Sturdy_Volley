import type { Container } from './saveModel';
import { addItem, countItem, removeItem } from './inventory';

/**
 * Machines + artisan goods (Prompt 018). Pure. A machine is a placed prop
 * that converts one input stack into one output stack over an in-game
 * timer. The same engine drives every kind (brine barrel, herb dryer,
 * cheese drum, honey spinner, oil press); per-kind tunables live in the
 * `MACHINE_CATALOG`.
 *
 * Time is measured in absolute game minutes (the same axis as
 * `absoluteDay * 1440 + GameTime.minutes`). `tickMachine` is stateless —
 * pass it the current absolute minutes and the live state and it returns
 * whichever phase the machine should now be in.
 */
export type MachineKind =
  | 'brine-barrel'
  | 'herb-dryer'
  | 'cheese-drum'
  | 'honey-spinner'
  | 'oil-press';

export type MachineStatus = 'idle' | 'processing' | 'ready';

export interface MachineRecipe {
  /** Input item id required to start this recipe. */
  inputItemId: string;
  /** Input stack size consumed per craft. */
  inputQty: number;
  /** Output item id produced. */
  outputItemId: string;
  /** Output stack size produced. */
  outputQty: number;
  /** In-game minutes the recipe takes to finish (1 minute ≠ 1 real second). */
  processMinutes: number;
  /** Quality of the output (0..3). Most machines push to quality 1 by default. */
  outputQuality?: number;
  /** Optional fuel stack consumed each craft (e.g. salt for the brine barrel). */
  fuelItemId?: string;
  fuelQty?: number;
}

export interface MachineDefinition {
  kind: MachineKind;
  name: string;
  description: string;
  /** Only processes between sunrise and sundown (6 AM – 8 PM). */
  daylightOnly?: boolean;
  recipes: readonly MachineRecipe[];
}

export const MACHINE_CATALOG: Record<MachineKind, MachineDefinition> = {
  'brine-barrel': {
    kind: 'brine-barrel',
    name: 'Brine Barrel',
    description: 'Salt-tight oak barrel for pickles and preserves.',
    recipes: [
      {
        inputItemId: 'blush-radish',
        inputQty: 2,
        outputItemId: 'preserved-radish',
        outputQty: 1,
        processMinutes: 600,
        outputQuality: 1,
        fuelItemId: 'salt',
        fuelQty: 1,
      },
      {
        inputItemId: 'tide-shell',
        inputQty: 1,
        outputItemId: 'salt',
        outputQty: 2,
        processMinutes: 360,
      },
    ],
  },
  'herb-dryer': {
    kind: 'herb-dryer',
    name: 'Herb Dryer',
    description: 'A slatted rack that wicks sea air through cut herbs.',
    daylightOnly: true,
    recipes: [
      {
        inputItemId: 'harborlime',
        inputQty: 2,
        outputItemId: 'dried-harborlime',
        outputQty: 1,
        processMinutes: 480,
        outputQuality: 1,
      },
    ],
  },
  'cheese-drum': {
    kind: 'cheese-drum',
    name: 'Cheese Drum',
    description: 'A slow-turning drum that presses fresh milk into cheese.',
    recipes: [
      {
        inputItemId: 'bluff-goat-milk',
        inputQty: 1,
        outputItemId: 'goat-cheese',
        outputQty: 1,
        processMinutes: 720,
        outputQuality: 1,
      },
    ],
  },
  'honey-spinner': {
    kind: 'honey-spinner',
    name: 'Honey Spinner',
    description: 'A centrifuge that flings honey out of raw comb.',
    recipes: [
      {
        inputItemId: 'raw-honeycomb',
        inputQty: 1,
        outputItemId: 'honey-jar',
        outputQty: 1,
        processMinutes: 300,
        outputQuality: 1,
      },
    ],
  },
  'oil-press': {
    kind: 'oil-press',
    name: 'Oil Press',
    description: 'A hand-crank press that wrings oil out of melon seeds.',
    recipes: [
      {
        inputItemId: 'sunmelon',
        inputQty: 1,
        outputItemId: 'sunmelon-oil',
        outputQty: 1,
        processMinutes: 540,
        outputQuality: 1,
      },
    ],
  },
};

export interface MachineState {
  /** Stable id within a save — `${sceneKey}:${kind}:${index}`. */
  id: string;
  kind: MachineKind;
  sceneKey: string;
  x: number;
  z: number;
  /** When `processing`, the absolute game minute when input was loaded. */
  startMinutes: number | null;
  /** Index into the catalog's recipe list for the loaded input. */
  recipeIndex: number | null;
}

export function createMachine(opts: {
  id: string;
  kind: MachineKind;
  sceneKey: string;
  x: number;
  z: number;
}): MachineState {
  return {
    id: opts.id,
    kind: opts.kind,
    sceneKey: opts.sceneKey,
    x: opts.x,
    z: opts.z,
    startMinutes: null,
    recipeIndex: null,
  };
}

/**
 * Figure out where in the recipe table the player's input lands. Returns
 * `null` when the input doesn't match any recipe for this kind.
 */
export function findRecipeForInput(kind: MachineKind, itemId: string): number | null {
  const def = MACHINE_CATALOG[kind];
  for (let i = 0; i < def.recipes.length; i++) {
    if (def.recipes[i]!.inputItemId === itemId) return i;
  }
  return null;
}

export interface LoadInput {
  state: MachineState;
  container: Container;
  itemId: string;
  nowAbsoluteMinutes: number;
}

export interface LoadResult {
  accepted: boolean;
  reason?: 'busy' | 'unsupported-input' | 'missing-input' | 'missing-fuel' | 'after-dark';
  state: MachineState;
  container: Container;
}

export function loadMachine(input: LoadInput): LoadResult {
  const { state, container, itemId, nowAbsoluteMinutes } = input;
  if (state.startMinutes !== null) {
    return { accepted: false, reason: 'busy', state, container };
  }
  const def = MACHINE_CATALOG[state.kind];
  if (def.daylightOnly && !isDaylight(nowAbsoluteMinutes)) {
    return { accepted: false, reason: 'after-dark', state, container };
  }
  const recipeIndex = findRecipeForInput(state.kind, itemId);
  if (recipeIndex === null) {
    return { accepted: false, reason: 'unsupported-input', state, container };
  }
  const recipe = def.recipes[recipeIndex]!;
  if (countItem(container, recipe.inputItemId) < recipe.inputQty) {
    return { accepted: false, reason: 'missing-input', state, container };
  }
  if (recipe.fuelItemId && countItem(container, recipe.fuelItemId) < (recipe.fuelQty ?? 1)) {
    return { accepted: false, reason: 'missing-fuel', state, container };
  }
  let next = container;
  next = removeItem(next, recipe.inputItemId, recipe.inputQty).container;
  if (recipe.fuelItemId) {
    next = removeItem(next, recipe.fuelItemId, recipe.fuelQty ?? 1).container;
  }
  return {
    accepted: true,
    state: { ...state, startMinutes: nowAbsoluteMinutes, recipeIndex },
    container: next,
  };
}

export function statusOf(state: MachineState, nowAbsoluteMinutes: number): MachineStatus {
  if (state.startMinutes === null || state.recipeIndex === null) return 'idle';
  const def = MACHINE_CATALOG[state.kind];
  const recipe = def.recipes[state.recipeIndex];
  if (!recipe) return 'idle';
  const elapsed = nowAbsoluteMinutes - state.startMinutes;
  if (elapsed >= recipe.processMinutes) return 'ready';
  return 'processing';
}

export function remainingMinutes(state: MachineState, nowAbsoluteMinutes: number): number {
  if (state.startMinutes === null || state.recipeIndex === null) return 0;
  const def = MACHINE_CATALOG[state.kind];
  const recipe = def.recipes[state.recipeIndex];
  if (!recipe) return 0;
  return Math.max(0, recipe.processMinutes - (nowAbsoluteMinutes - state.startMinutes));
}

export interface CollectInput {
  state: MachineState;
  container: Container;
  nowAbsoluteMinutes: number;
}

export interface CollectResult {
  accepted: boolean;
  reason?: 'not-ready' | 'no-output-slot';
  state: MachineState;
  container: Container;
  output?: { itemId: string; qty: number; quality: number };
}

export function collectMachine(input: CollectInput): CollectResult {
  const { state, container, nowAbsoluteMinutes } = input;
  if (statusOf(state, nowAbsoluteMinutes) !== 'ready') {
    return { accepted: false, reason: 'not-ready', state, container };
  }
  const def = MACHINE_CATALOG[state.kind];
  const recipe = def.recipes[state.recipeIndex!]!;
  const added = addItem(container, recipe.outputItemId, recipe.outputQty, recipe.outputQuality ?? 0);
  if (added.overflow > 0) {
    return { accepted: false, reason: 'no-output-slot', state, container };
  }
  return {
    accepted: true,
    state: { ...state, startMinutes: null, recipeIndex: null },
    container: added.container,
    output: {
      itemId: recipe.outputItemId,
      qty: recipe.outputQty,
      quality: recipe.outputQuality ?? 0,
    },
  };
}

/** True between 06:00 and 20:00 in the day represented by the absolute clock. */
export function isDaylight(absoluteMinutes: number): boolean {
  const m = ((absoluteMinutes % 1440) + 1440) % 1440;
  return m >= 6 * 60 && m < 20 * 60;
}

/**
 * Determine which loaded machines transition `processing → ready` between
 * `fromMinutes` (the previous tick) and `toMinutes` (now). Useful for the
 * "ready" notification + audio chime — the renderer can compare the two
 * states it knows about and trigger the cue exactly once.
 */
export function newlyReady(
  machines: Iterable<MachineState>,
  fromMinutes: number,
  toMinutes: number,
): MachineState[] {
  const out: MachineState[] = [];
  for (const m of machines) {
    if (m.startMinutes === null || m.recipeIndex === null) continue;
    const before = statusOf(m, fromMinutes);
    const after = statusOf(m, toMinutes);
    if (before !== 'ready' && after === 'ready') out.push(m);
  }
  return out;
}
