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
