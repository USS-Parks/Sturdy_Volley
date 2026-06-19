/**
 * Tool definitions, upgrade levels, and stamina costs (Prompt 009). Pure.
 * Real rigs / hand sockets / impact frames land with the Theme 3 art track
 * (A03–A06); the data + cost / AOE model lives here.
 */
export type ToolId =
  | 'hoe'
  | 'watering-can'
  | 'axe'
  | 'pick'
  | 'sickle'
  | 'fishing-rod'
  | 'defender-blade';

export const TOOL_ORDER: readonly ToolId[] = [
  'hoe',
  'watering-can',
  'axe',
  'pick',
  'sickle',
  'fishing-rod',
  'defender-blade',
];

export interface ToolDef {
  id: ToolId;
  displayName: string;
  baseStamina: number;
  /** AOE per upgrade level: tiles affected per single action. */
  aoeByLevel: readonly number[];
  /** Whether holding the action key charges a power swing. */
  chargeable: boolean;
  /** Hardness threshold per level — only objects ≤ this break / chop / mine. */
  hardnessByLevel: readonly number[];
}

export const TOOL_DEFS: Record<ToolId, ToolDef> = {
  hoe: {
    id: 'hoe',
    displayName: 'Hoe',
    baseStamina: 2,
    aoeByLevel: [1, 3, 5, 9],
    chargeable: true,
    hardnessByLevel: [1, 1, 1, 1],
  },
  'watering-can': {
    id: 'watering-can',
    displayName: 'Watering Can',
    baseStamina: 2,
    aoeByLevel: [1, 3, 5, 9],
    chargeable: true,
    hardnessByLevel: [1, 1, 1, 1],
  },
  axe: {
    id: 'axe',
    displayName: 'Axe',
    baseStamina: 4,
    aoeByLevel: [1, 1, 1, 1],
    chargeable: false,
    hardnessByLevel: [1, 2, 3, 4],
  },
  pick: {
    id: 'pick',
    displayName: 'Pick',
    baseStamina: 4,
    aoeByLevel: [1, 1, 1, 1],
    chargeable: false,
    hardnessByLevel: [1, 2, 3, 4],
  },
  sickle: {
    id: 'sickle',
    displayName: 'Sickle',
    baseStamina: 1,
    aoeByLevel: [1, 3, 5, 9],
    chargeable: false,
    hardnessByLevel: [1, 1, 2, 2],
  },
  'fishing-rod': {
    id: 'fishing-rod',
    displayName: 'Fishing Rod',
    baseStamina: 2,
    aoeByLevel: [1, 1, 1, 1],
    chargeable: true,
    hardnessByLevel: [1, 2, 3, 4],
  },
  'defender-blade': {
    id: 'defender-blade',
    displayName: 'Defender Blade',
    baseStamina: 3,
    aoeByLevel: [1, 1, 2, 2],
    chargeable: true,
    hardnessByLevel: [1, 2, 3, 4],
  },
};

export const MAX_TOOL_LEVEL = 3;

/**
 * Stamina cost for a single tool action at the given upgrade level. Higher
 * levels reduce the per-action cost so a maxed tool feels light in the hand.
 */
export function staminaCost(toolId: ToolId, level: number): number {
  const def = TOOL_DEFS[toolId];
  if (!def) return 0;
  const clamped = Math.max(0, Math.min(MAX_TOOL_LEVEL, level));
  const reduction = clamped * 0.15; // 0%, 15%, 30%, 45%
  return Math.max(1, Math.round(def.baseStamina * (1 - reduction)));
}

/** Tile count affected by one swing of the tool at the given upgrade level. */
export function aoeAt(toolId: ToolId, level: number): number {
  const def = TOOL_DEFS[toolId];
  if (!def) return 1;
  return def.aoeByLevel[Math.max(0, Math.min(MAX_TOOL_LEVEL, level))] ?? 1;
}

/** Max hardness an object can have to break / chop / mine with this tool/level. */
export function hardnessReach(toolId: ToolId, level: number): number {
  const def = TOOL_DEFS[toolId];
  if (!def) return 1;
  return def.hardnessByLevel[Math.max(0, Math.min(MAX_TOOL_LEVEL, level))] ?? 1;
}

/**
 * The shape of one tool's AOE relative to the player's facing cell. Returns
 * (col, row) offsets to apply. AOE 1 = single tile; 3 = a 3-tile line in front;
 * 5 = a 3×3 minus corners; 9 = a full 3×3.
 */
export function aoeOffsets(aoe: number): Array<{ dc: number; dr: number }> {
  if (aoe <= 1) return [{ dc: 0, dr: 0 }];
  if (aoe <= 3) return [-1, 0, 1].map((d) => ({ dc: d, dr: 0 }));
  if (aoe <= 5) {
    return [
      { dc: 0, dr: 0 },
      { dc: -1, dr: 0 },
      { dc: 1, dr: 0 },
      { dc: 0, dr: -1 },
      { dc: 0, dr: 1 },
    ];
  }
  const out: Array<{ dc: number; dr: number }> = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) out.push({ dc, dr });
  return out;
}

/** Charge swings beyond level 0 multiply the AOE by 1, 1.5, 2 at thresholds. */
export function chargedAoe(toolId: ToolId, level: number, chargeSeconds: number): number {
  const def = TOOL_DEFS[toolId];
  if (!def || !def.chargeable) return aoeAt(toolId, level);
  const base = aoeAt(toolId, level);
  if (chargeSeconds < 0.6) return base;
  if (chargeSeconds < 1.4) return Math.min(9, Math.round(base * 1.5));
  return Math.min(9, base * 2);
}
