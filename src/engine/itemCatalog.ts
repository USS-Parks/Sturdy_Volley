import type { Item, Npc } from '../data/schemas';
import type { Container } from './saveModel';
import { sellValueOf } from './inventory';

/**
 * Static lookups over the content item set. Pure: feed it the catalog you
 * already loaded via loadGameContent() and it answers id → item, item → loved
 * NPCs, and container → total sell value.
 */
export interface ItemCatalog {
  byId: ReadonlyMap<string, Item>;
  /** itemId → NPCs whose lovedGiftItemIds list contains it. */
  lovedBy: ReadonlyMap<string, readonly Npc[]>;
}

export function buildItemCatalog(items: readonly Item[], npcs: readonly Npc[]): ItemCatalog {
  const byId = new Map<string, Item>();
  for (const it of items) byId.set(it.id, it);
  const lovedBy = new Map<string, Npc[]>();
  for (const n of npcs) {
    for (const id of n.lovedGiftItemIds) {
      const list = lovedBy.get(id) ?? [];
      list.push(n);
      lovedBy.set(id, list);
    }
  }
  return { byId, lovedBy };
}

export function getItem(catalog: ItemCatalog, id: string): Item | null {
  return catalog.byId.get(id) ?? null;
}

export function lovedByNpcs(catalog: ItemCatalog, id: string): readonly Npc[] {
  return catalog.lovedBy.get(id) ?? [];
}

/** Quality-adjusted total sell value of every stack in a container. */
export function containerSellValue(container: Container, catalog: ItemCatalog): number {
  let total = 0;
  for (const slot of container.slots) {
    if (!slot) continue;
    const item = catalog.byId.get(slot.itemId);
    if (!item) continue;
    total += sellValueOf(slot, item.sellPrice);
  }
  return total;
}
