import { loadGameContent } from '../data/content';
import { getActiveSave, persistActiveSave } from './gameState';
import { relationshipLevel } from './friendship';
import { countItem, removeItem } from './inventory';
import { absoluteDayFor } from './quest-tracking';
import {
  completedProjectFlags,
  contribute,
  grantProjectRewards,
  projectBoardRows,
  reconcileProjects,
  remainingForRequirement,
  type CivicWorld,
  type ProjectBoardRow,
} from './civic';
import type { CivicProject } from '../data/schemas';
import type { SaveData } from './saveModel';

/**
 * Runtime glue between TownScene and the pure civic-project engine. Reads/mutates
 * the active save, removes the contributed items/gold, persists, and surfaces
 * completions for the ceremony + map/schedule changes.
 */

export function civicWorldFor(save: SaveData): CivicWorld {
  return { relationshipLevel: (npcId: string) => relationshipLevel(save.relationships[npcId] ?? 0) };
}

function nameResolvers() {
  const content = loadGameContent();
  const items = new Map(content.items.map((i) => [i.id, i.name] as const));
  const npcs = new Map(content.npcs.map((n) => [n.id, n.name] as const));
  const recipes = new Map(content.recipes.map((r) => [r.id, r.name] as const));
  return {
    item: (id: string) => items.get(id) ?? id,
    npc: (id: string) => npcs.get(id) ?? id,
    recipe: (id: string) => recipes.get(id) ?? id,
  };
}

/** Seed/advance projects on the active save (e.g. a relationship gate now met). Grants + persists. */
export function reconcileActiveProjects(): CivicProject[] {
  const save = getActiveSave();
  if (!save) return [];
  const defs = loadGameContent().projects;
  const { record, completed } = reconcileProjects(save.projects, defs, civicWorldFor(save), absoluteDayFor(save));
  save.projects = record;
  for (const project of completed) grantProjectRewards(save, project);
  persistActiveSave();
  return completed;
}

export interface ContributeActiveResult {
  accepted: number;
  completed: CivicProject | null;
}

/**
 * Contribute as much as the player can spare toward one requirement of a
 * project's current phase: removes the items (or gold) from the active save and
 * records it. Returns how much was accepted + the project if it just completed.
 */
export function contributeActive(projectId: string, reqIndex: number): ContributeActiveResult {
  const save = getActiveSave();
  if (!save) return { accepted: 0, completed: null };
  const defs = loadGameContent().projects;
  const state = save.projects[projectId];
  const def = defs.find((p) => p.id === projectId);
  if (!def || !state || state.complete) return { accepted: 0, completed: null };
  const req = def.phases[state.phase]?.requirements[reqIndex];
  if (!req || req.kind === 'relationship') return { accepted: 0, completed: null };

  const remaining = remainingForRequirement(save.projects, defs, projectId, reqIndex);
  if (remaining <= 0) return { accepted: 0, completed: null };

  const have = req.kind === 'item' ? countItem(save.inventory, req.itemId) : save.wallet.gold;
  const give = Math.min(remaining, have);
  if (give <= 0) return { accepted: 0, completed: null };

  const result = contribute(save.projects, defs, civicWorldFor(save), projectId, reqIndex, give, absoluteDayFor(save));
  if (result.accepted <= 0) return { accepted: 0, completed: null };

  // Remove exactly what was accepted.
  if (req.kind === 'item') {
    save.inventory = removeItem(save.inventory, req.itemId, result.accepted).container;
  } else {
    save.wallet.gold -= result.accepted;
  }
  save.projects = result.record;
  if (result.completed) grantProjectRewards(save, result.completed);
  persistActiveSave();
  return { accepted: result.accepted, completed: result.completed };
}

/** Board rows for the active save, with names resolved from content. */
export function activeProjectBoardRows(): ProjectBoardRow[] {
  const save = getActiveSave();
  if (!save) return [];
  const defs = loadGameContent().projects;
  return projectBoardRows(save.projects, defs, civicWorldFor(save), nameResolvers());
}

/** `civic:<id>` flags for completed projects on the active save (mesh toggles + schedule layers). */
export function activeCompletedProjectFlags(): string[] {
  const save = getActiveSave();
  if (!save) return [];
  return completedProjectFlags(save.projects);
}
