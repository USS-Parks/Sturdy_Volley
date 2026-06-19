/**
 * Skills, professions, mastery (Prompt 027). Pure. The eight skills
 * are `cultivation`, `husbandry`, `foraging`, `angling`, `crafting`,
 * `exploring`, `combat`, `rapport` (from `src/data/content/skills.json`).
 * Each climbs a 10-level XP ladder; a branching profession choice
 * unlocks at level 5 and a second tier at level 10. After level 10
 * the skill enters a mastery track that grants stacking small perks.
 *
 * Numbers are deliberately new to Ballast Bay (no Stardew XP table
 * copied) — a five-tier triangular ladder: 40, 110, 220, 380, 600,
 * 880, 1240, 1700, 2300, 3100 XP for levels 1..10.
 */
export const SKILL_IDS = [
  'cultivation',
  'husbandry',
  'foraging',
  'angling',
  'crafting',
  'exploring',
  'combat',
  'rapport',
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export const LEVEL_XP_THRESHOLDS = [
  0, 40, 110, 220, 380, 600, 880, 1240, 1700, 2300, 3100,
] as const;
export const MAX_LEVEL = 10;

export function levelFromXp(xp: number): number {
  for (let i = LEVEL_XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_XP_THRESHOLDS[i]!) return i;
  }
  return 0;
}

export function xpToNextLevel(xp: number): number {
  const level = levelFromXp(xp);
  if (level >= MAX_LEVEL) return 0;
  return LEVEL_XP_THRESHOLDS[level + 1]! - xp;
}

/** Effect tokens consumed by feature surfaces (renderer / day-end). */
export type PerkEffect =
  | { kind: 'tool-stamina-mult'; value: number; tool?: string }
  | { kind: 'yield-bonus'; itemCategory: string; chance: number }
  | { kind: 'price-mult'; itemCategory: string; value: number }
  | { kind: 'hazard-resist'; value: number }
  | { kind: 'forage-extra-roll'; chance: number }
  | { kind: 'fish-bite-faster'; secondsOff: number }
  | { kind: 'cooking-buff-extension'; value: number }
  | { kind: 'gift-bonus'; value: number };

export interface ProfessionDef {
  id: string;
  name: string;
  description: string;
  effects: readonly PerkEffect[];
}

export interface SkillTree {
  id: SkillId;
  /** Two professions at level 5 — player picks one. */
  level5: readonly [ProfessionDef, ProfessionDef];
  /** Two professions at level 10 — branch from any of the level-5 picks. */
  level10: readonly [ProfessionDef, ProfessionDef];
}

export const SKILL_TREES: Record<SkillId, SkillTree> = {
  cultivation: {
    id: 'cultivation',
    level5: [
      { id: 'cultivation-tiller', name: 'Tiller', description: 'Crops sell for 20% more.', effects: [{ kind: 'price-mult', itemCategory: 'crop', value: 1.2 }] },
      { id: 'cultivation-rancher', name: 'Rancher', description: 'Animal products sell for 20% more.', effects: [{ kind: 'price-mult', itemCategory: 'animal', value: 1.2 }] },
    ],
    level10: [
      { id: 'cultivation-artisan', name: 'Artisan', description: 'Artisan goods sell for 40% more.', effects: [{ kind: 'price-mult', itemCategory: 'artisan', value: 1.4 }] },
      { id: 'cultivation-gardener', name: 'Gardener', description: '10% chance of an extra crop per harvest.', effects: [{ kind: 'yield-bonus', itemCategory: 'crop', chance: 0.1 }] },
    ],
  },
  husbandry: {
    id: 'husbandry',
    level5: [
      { id: 'husbandry-shepherd', name: 'Shepherd', description: 'Animal products sell for 15% more.', effects: [{ kind: 'price-mult', itemCategory: 'animal', value: 1.15 }] },
      { id: 'husbandry-coop-keeper', name: 'Coop Keeper', description: 'Eggs occasionally come paired (+10%).', effects: [{ kind: 'yield-bonus', itemCategory: 'animal', chance: 0.1 }] },
    ],
    level10: [
      { id: 'husbandry-pasture-master', name: 'Pasture Master', description: 'Animals stay sheltered in light rain.', effects: [{ kind: 'hazard-resist', value: 0.5 }] },
      { id: 'husbandry-friend', name: 'Animal Friend', description: 'Pet + petting yields more affection.', effects: [{ kind: 'gift-bonus', value: 0.2 }] },
    ],
  },
  foraging: {
    id: 'foraging',
    level5: [
      { id: 'foraging-gatherer', name: 'Gatherer', description: '20% chance of an extra forage drop.', effects: [{ kind: 'forage-extra-roll', chance: 0.2 }] },
      { id: 'foraging-lumberjack', name: 'Lumberjack', description: 'Trees yield extra driftwood.', effects: [{ kind: 'yield-bonus', itemCategory: 'material', chance: 0.25 }] },
    ],
    level10: [
      { id: 'foraging-botanist', name: 'Botanist', description: 'Forage sells for 30% more.', effects: [{ kind: 'price-mult', itemCategory: 'forage', value: 1.3 }] },
      { id: 'foraging-tracker', name: 'Tracker', description: 'Reef + beach yield extra rolls.', effects: [{ kind: 'forage-extra-roll', chance: 0.4 }] },
    ],
  },
  angling: {
    id: 'angling',
    level5: [
      { id: 'angling-fisher', name: 'Fisher', description: 'Fish bite 1 second faster.', effects: [{ kind: 'fish-bite-faster', secondsOff: 1 }] },
      { id: 'angling-trapper', name: 'Trapper', description: 'Crab pots yield extra catch.', effects: [{ kind: 'yield-bonus', itemCategory: 'fish', chance: 0.15 }] },
    ],
    level10: [
      { id: 'angling-mariner', name: 'Mariner', description: 'Fish bite 2 seconds faster.', effects: [{ kind: 'fish-bite-faster', secondsOff: 2 }] },
      { id: 'angling-pirate', name: 'Treasure Diver', description: 'Treasure rolls more often (+15%).', effects: [{ kind: 'yield-bonus', itemCategory: 'material', chance: 0.15 }] },
    ],
  },
  crafting: {
    id: 'crafting',
    level5: [
      { id: 'crafting-smith', name: 'Smith', description: 'Tool actions cost 25% less stamina.', effects: [{ kind: 'tool-stamina-mult', value: 0.75 }] },
      { id: 'crafting-prospector', name: 'Prospector', description: 'Pickaxe swings cost 50% less stamina.', effects: [{ kind: 'tool-stamina-mult', value: 0.5, tool: 'pick' }] },
    ],
    level10: [
      { id: 'crafting-blacksmith', name: 'Blacksmith', description: 'Tool upgrades cost 33% less.', effects: [{ kind: 'price-mult', itemCategory: 'gear', value: 0.67 }] },
      { id: 'crafting-spelunker', name: 'Spelunker', description: 'Hazards do half damage.', effects: [{ kind: 'hazard-resist', value: 0.5 }] },
    ],
  },
  exploring: {
    id: 'exploring',
    level5: [
      { id: 'exploring-scout', name: 'Scout', description: 'Hazards do 25% less damage.', effects: [{ kind: 'hazard-resist', value: 0.25 }] },
      { id: 'exploring-lanternkeeper', name: 'Lanternkeeper', description: 'Lantern fuel drains 30% slower.', effects: [{ kind: 'hazard-resist', value: 0.3 }] },
    ],
    level10: [
      { id: 'exploring-pathfinder', name: 'Pathfinder', description: 'Cave creature loot 20% more often.', effects: [{ kind: 'yield-bonus', itemCategory: 'mineral', chance: 0.2 }] },
      { id: 'exploring-archaeologist', name: 'Archaeologist', description: 'Geode-style rolls climb by 15%.', effects: [{ kind: 'yield-bonus', itemCategory: 'material', chance: 0.15 }] },
    ],
  },
  combat: {
    id: 'combat',
    level5: [
      { id: 'combat-bruiser', name: 'Bruiser', description: 'Weapon damage +15%.', effects: [{ kind: 'price-mult', itemCategory: 'gear', value: 1.15 }] },
      { id: 'combat-defender', name: 'Defender', description: 'Hazards + creatures do 25% less damage.', effects: [{ kind: 'hazard-resist', value: 0.25 }] },
    ],
    level10: [
      { id: 'combat-acrobat', name: 'Acrobat', description: 'I-frames 50% longer.', effects: [{ kind: 'hazard-resist', value: 0.5 }] },
      { id: 'combat-stalker', name: 'Stalker', description: 'Cave loot 25% more often.', effects: [{ kind: 'yield-bonus', itemCategory: 'mineral', chance: 0.25 }] },
    ],
  },
  rapport: {
    id: 'rapport',
    level5: [
      { id: 'rapport-pen-pal', name: 'Pen Pal', description: 'Gift bonus +10%.', effects: [{ kind: 'gift-bonus', value: 0.1 }] },
      { id: 'rapport-host', name: 'Host', description: 'Cooked buffs last 30% longer.', effects: [{ kind: 'cooking-buff-extension', value: 1.3 }] },
    ],
    level10: [
      { id: 'rapport-champion', name: 'Champion', description: 'Gift bonus +25%.', effects: [{ kind: 'gift-bonus', value: 0.25 }] },
      { id: 'rapport-confidant', name: 'Confidant', description: 'Friendships gain XP 50% faster.', effects: [{ kind: 'gift-bonus', value: 0.5 }] },
    ],
  },
};

/** Player-selected professions per skill. `professions[skillId]` = profession id. */
export type ProfessionMap = Record<string, string>;

export function professionOptionsFor(skill: SkillId, level: number): ProfessionDef[] {
  const tree = SKILL_TREES[skill];
  if (level >= 10) return [...tree.level10];
  if (level >= 5) return [...tree.level5];
  return [];
}

/* Mastery -------------------------------------------------------- */

export interface MasteryState {
  /** XP accumulated beyond level 10 in any skill. */
  totalMasteryXp: number;
  /** Per-skill mastery rank (0..5). */
  ranks: Partial<Record<SkillId, number>>;
}

export function createMastery(): MasteryState {
  return { totalMasteryXp: 0, ranks: {} };
}

const MASTERY_PER_RANK = 500;

export function awardMasteryXp(state: MasteryState, skill: SkillId, xp: number): MasteryState {
  if (xp <= 0) return state;
  const totalMasteryXp = state.totalMasteryXp + xp;
  const currentRank = state.ranks[skill] ?? 0;
  const newRank = Math.min(5, Math.floor(((currentRank * MASTERY_PER_RANK) + xp) / MASTERY_PER_RANK));
  return {
    totalMasteryXp,
    ranks: { ...state.ranks, [skill]: newRank },
  };
}

/* Effect aggregator --------------------------------------------- */

export interface AggregatedPerks {
  toolStaminaMult: number; // multiplies tool stamina cost
  hazardResist: number; // 0..1 fraction of damage absorbed
  cropPriceMult: number;
  animalPriceMult: number;
  artisanPriceMult: number;
  foragePriceMult: number;
  gearPriceMult: number;
  forageExtraChance: number;
  fishBiteSecondsOff: number;
  cookingBuffExtension: number;
  giftBonus: number;
}

export function emptyPerks(): AggregatedPerks {
  return {
    toolStaminaMult: 1,
    hazardResist: 0,
    cropPriceMult: 1,
    animalPriceMult: 1,
    artisanPriceMult: 1,
    foragePriceMult: 1,
    gearPriceMult: 1,
    forageExtraChance: 0,
    fishBiteSecondsOff: 0,
    cookingBuffExtension: 1,
    giftBonus: 0,
  };
}

export function aggregatePerks(professions: ProfessionMap): AggregatedPerks {
  const out = emptyPerks();
  const allDefs = Object.values(SKILL_TREES).flatMap((tree) => [...tree.level5, ...tree.level10]);
  for (const id of Object.values(professions)) {
    const def = allDefs.find((d) => d.id === id);
    if (!def) continue;
    for (const e of def.effects) {
      if (e.kind === 'tool-stamina-mult') out.toolStaminaMult *= e.value;
      else if (e.kind === 'hazard-resist') out.hazardResist = Math.min(0.9, out.hazardResist + e.value);
      else if (e.kind === 'price-mult') {
        if (e.itemCategory === 'crop') out.cropPriceMult *= e.value;
        else if (e.itemCategory === 'animal') out.animalPriceMult *= e.value;
        else if (e.itemCategory === 'artisan') out.artisanPriceMult *= e.value;
        else if (e.itemCategory === 'forage') out.foragePriceMult *= e.value;
        else if (e.itemCategory === 'gear') out.gearPriceMult *= e.value;
      } else if (e.kind === 'forage-extra-roll') {
        out.forageExtraChance = Math.min(0.9, out.forageExtraChance + e.chance);
      } else if (e.kind === 'fish-bite-faster') {
        out.fishBiteSecondsOff += e.secondsOff;
      } else if (e.kind === 'cooking-buff-extension') {
        out.cookingBuffExtension *= e.value;
      } else if (e.kind === 'gift-bonus') {
        out.giftBonus += e.value;
      }
    }
  }
  return out;
}
