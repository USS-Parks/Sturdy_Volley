import { loadGameContent } from '../data/content';
import { getActiveSave, persistActiveSave } from './gameState';
import { absoluteDay } from './timeSystem';
import { relationshipLevel } from './friendship';
import { countItem } from './inventory';
import {
  acceptQuest,
  applyQuestEvent,
  cancelQuest,
  grantQuestRewards,
  questJournalRows,
  reconcileQuests,
  type QuestEvent,
  type QuestJournalRow,
  type QuestNameResolvers,
  type QuestWorld,
} from './quests';
import type { Quest } from '../data/schemas';
import type { SaveData } from './saveModel';

/**
 * Runtime glue between scenes and the pure quest engine (`quests.ts`). Scenes
 * call these one-liners at action-resolution points; the engine stays pure and
 * unit-testable. Everything here reads/mutates the active save and persists.
 */

export function absoluteDayFor(save: SaveData): number {
  return absoluteDay({
    year: save.calendar.year,
    season: save.calendar.season,
    day: save.calendar.day,
  });
}

export function questWorldFor(save: SaveData): QuestWorld {
  return {
    relationshipLevel: (npcId: string) => relationshipLevel(save.relationships[npcId] ?? 0),
    itemCount: (itemId: string) => countItem(save.inventory, itemId),
  };
}

function nameResolvers(): QuestNameResolvers {
  const content = loadGameContent();
  const items = new Map(content.items.map((i) => [i.id, i.name] as const));
  const npcs = new Map(content.npcs.map((n) => [n.id, n.name] as const));
  const recipes = new Map(content.recipes.map((r) => [r.id, r.name] as const));
  return {
    item: (id) => items.get(id) ?? id,
    npc: (id) => npcs.get(id) ?? id,
    recipe: (id) => recipes.get(id) ?? id,
  };
}

/** Record one player action against the active save's quests. Returns completions. */
export function recordActiveQuestEvent(event: QuestEvent): Quest[] {
  const save = getActiveSave();
  if (!save) return [];
  const defs = loadGameContent().quests;
  const { record, completed } = applyQuestEvent(save.quests, defs, absoluteDayFor(save), event);
  save.quests = record;
  for (const quest of completed) grantQuestRewards(save, quest);
  persistActiveSave();
  return completed;
}

/**
 * Reconcile the active save's quests (seed states, promote on prerequisites,
 * refresh standing objectives, optionally expire timed quests, detect
 * completions). Grants rewards for completions and persists.
 */
export function reconcileActiveQuests(advanceDay = false): { completed: Quest[]; failed: Quest[] } {
  const save = getActiveSave();
  if (!save) return { completed: [], failed: [] };
  const defs = loadGameContent().quests;
  const { record, completed, failed } = reconcileQuests(save.quests, defs, {
    day: absoluteDayFor(save),
    world: questWorldFor(save),
    advanceDay,
  });
  save.quests = record;
  for (const quest of completed) grantQuestRewards(save, quest);
  persistActiveSave();
  return { completed, failed };
}

export function acceptActiveQuest(id: string): void {
  const save = getActiveSave();
  if (!save) return;
  const defs = loadGameContent().quests;
  save.quests = acceptQuest(save.quests, defs, id, absoluteDayFor(save));
  persistActiveSave();
}

export function cancelActiveQuest(id: string): void {
  const save = getActiveSave();
  if (!save) return;
  const defs = loadGameContent().quests;
  save.quests = cancelQuest(save.quests, defs, id);
  persistActiveSave();
}

/** Journal rows for the active save, with reward names resolved from content. */
export function activeQuestJournalRows(): QuestJournalRow[] {
  const save = getActiveSave();
  if (!save) return [];
  const defs = loadGameContent().quests;
  return questJournalRows(save.quests, defs, questWorldFor(save), absoluteDayFor(save), nameResolvers());
}
