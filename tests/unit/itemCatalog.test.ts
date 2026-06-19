import { describe, it, expect } from 'vitest';
import { buildItemCatalog, getItem, lovedByNpcs, containerSellValue } from '../../src/engine/itemCatalog';
import { addItem, createContainer } from '../../src/engine/inventory';
import type { Item, Npc } from '../../src/data/schemas';

const ITEMS: Item[] = [
  { id: 'bell-peas', name: 'Bell Peas', description: 'x', category: 'crop', sellPrice: 24, stackable: true, tags: ['spring'] },
  { id: 'driftwood', name: 'Driftwood', description: 'x', category: 'material', sellPrice: 5, stackable: true, tags: [] },
];

const NPCS: Npc[] = [
  {
    id: 'mara',
    name: 'Mara',
    role: 'r',
    description: 'd',
    birthday: { season: 'summer', day: 14 },
    lovedGiftItemIds: ['bell-peas'],
    romanceable: true,
  },
  {
    id: 'sol',
    name: 'Sol',
    role: 'r',
    description: 'd',
    birthday: { season: 'spring', day: 5 },
    lovedGiftItemIds: ['bell-peas', 'driftwood'],
    romanceable: true,
  },
];

describe('item catalog', () => {
  const catalog = buildItemCatalog(ITEMS, NPCS);

  it('looks up items by id', () => {
    expect(getItem(catalog, 'bell-peas')?.name).toBe('Bell Peas');
    expect(getItem(catalog, 'nope')).toBeNull();
  });

  it('reports loved-by NPCs in catalog order', () => {
    expect(lovedByNpcs(catalog, 'bell-peas').map((n) => n.id)).toEqual(['mara', 'sol']);
    expect(lovedByNpcs(catalog, 'driftwood').map((n) => n.id)).toEqual(['sol']);
    expect(lovedByNpcs(catalog, 'nope')).toEqual([]);
  });

  it('sums quality-adjusted sell value across a container', () => {
    let c = createContainer(3);
    c = addItem(c, 'bell-peas', 4, 0).container;
    c = addItem(c, 'bell-peas', 2, 2).container; // quality 2 → 1.5×
    c = addItem(c, 'driftwood', 3, 0).container;
    // 4 * 24 + 2 * round(24 * 1.5) + 3 * 5 = 96 + 72 + 15 = 183
    expect(containerSellValue(c, catalog)).toBe(183);
  });
});
