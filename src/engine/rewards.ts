import type { QuestReward } from '../data/schemas';
import type { SaveData } from './saveModel';
import { addItem } from './inventory';
import { unlockRecipes } from './crafting';

/**
 * Apply a list of rewards to a save (mutates `save`). Shared by the quest
 * engine (Prompt 054) and the civic-project engine (Prompt 055) — both use the
 * same `questRewardSchema` reward shape (gold / item / recipe / relationship /
 * flag). Deterministic; not the economy-sensitive shipment path.
 */
export function grantRewards(save: SaveData, rewards: readonly QuestReward[]): void {
  for (const reward of rewards) {
    switch (reward.kind) {
      case 'gold':
        save.wallet.gold += reward.amount;
        break;
      case 'item': {
        const r = addItem(save.inventory, reward.itemId, reward.qty, reward.quality);
        save.inventory = r.container;
        break;
      }
      case 'recipe':
        save.knownRecipeIds = unlockRecipes(save.knownRecipeIds, [reward.recipeId]);
        break;
      case 'relationship':
        save.relationships[reward.npcId] = (save.relationships[reward.npcId] ?? 0) + reward.delta;
        break;
      case 'flag':
        save.flags[reward.flag] = reward.value;
        break;
    }
  }
}

/** Name resolvers for human-readable reward summaries. */
export interface RewardNameResolvers {
  item?: (id: string) => string;
  npc?: (id: string) => string;
  recipe?: (id: string) => string;
}

/** One reward as a short display string ("150 g", "5× Blush Radish Seeds", "+40 with Sol"). */
export function describeReward(reward: QuestReward, names: RewardNameResolvers = {}): string {
  switch (reward.kind) {
    case 'gold':
      return `${reward.amount} g`;
    case 'item':
      return `${reward.qty}× ${names.item?.(reward.itemId) ?? reward.itemId}`;
    case 'recipe':
      return `Recipe: ${names.recipe?.(reward.recipeId) ?? reward.recipeId}`;
    case 'relationship': {
      const who = names.npc?.(reward.npcId) ?? reward.npcId;
      return `${reward.delta >= 0 ? '+' : ''}${reward.delta} with ${who}`;
    }
    case 'flag':
      return 'Town progress';
  }
}

/** Join a list of rewards into a single " · "-separated summary ("No reward" if empty). */
export function summarizeRewards(rewards: readonly QuestReward[], names: RewardNameResolvers = {}): string {
  return rewards.map((r) => describeReward(r, names)).join(' · ') || 'No reward';
}
