import { describe, it, expect } from 'vitest';
import {
  buy,
  isShopOpen,
  restockShop,
  sellValue,
  type ShopStockEntry,
} from '../../src/engine/shops';
import type { Item, Shop } from '../../src/data/schemas';

const ITEMS: Item[] = [
  { id: 'bell-pea-seeds', name: 'Bell Pea Seeds', description: 'a', category: 'seed', sellPrice: 8, stackable: true, tags: ['spring'] },
  { id: 'sunmelon-seeds', name: 'Sunmelon Seeds', description: 'a', category: 'seed', sellPrice: 20, stackable: true, tags: ['summer'] },
  { id: 'goat-cheese', name: 'Goat Cheese', description: 'a', category: 'artisan', sellPrice: 95, stackable: true, tags: ['artisan'] },
];
const BY_ID = new Map(ITEMS.map((i) => [i.id, i] as const));

const SHOP: Shop = {
  id: 'general',
  name: 'General',
  npcId: null,
  stockItemIds: ['bell-pea-seeds', 'sunmelon-seeds', 'goat-cheese'],
};

describe('restockShop', () => {
  it('filters out out-of-season seeds and applies the buy markup', () => {
    const stock = restockShop({ shop: SHOP, itemsById: BY_ID, season: 'spring', flags: {} });
    expect(stock.entries.map((e) => e.itemId)).toEqual(['bell-pea-seeds', 'goat-cheese']);
    const bp = stock.entries.find((e) => e.itemId === 'bell-pea-seeds')!;
    expect(bp.price).toBe(12); // round(8 * 1.5)
  });

  it('limits artisan stock per day', () => {
    const stock = restockShop({ shop: SHOP, itemsById: BY_ID, season: 'spring', flags: {} });
    expect(stock.entries.find((e) => e.itemId === 'goat-cheese')?.remaining).toBe(3);
    expect(stock.entries.find((e) => e.itemId === 'bell-pea-seeds')?.remaining).toBe(-1);
  });

  it('summer brings sunmelon seeds and drops bell peas', () => {
    const stock = restockShop({ shop: SHOP, itemsById: BY_ID, season: 'summer', flags: {} });
    expect(stock.entries.map((e) => e.itemId)).toEqual(['sunmelon-seeds', 'goat-cheese']);
  });
});

describe('buy', () => {
  const unlimited: ShopStockEntry = { itemId: 'bell-pea-seeds', price: 10, remaining: -1 };

  it('charges price × qty and leaves unlimited stock unchanged', () => {
    const r = buy({ wallet: 500, qty: 5, entry: unlimited });
    expect(r.accepted).toBe(true);
    expect(r.cost).toBe(50);
    expect(r.nextEntry.remaining).toBe(-1);
  });

  it('decrements limited stock and clamps qty to remaining', () => {
    const limited: ShopStockEntry = { itemId: 'goat-cheese', price: 95, remaining: 2 };
    const r = buy({ wallet: 1000, qty: 5, entry: limited });
    expect(r.cost).toBe(95 * 2);
    expect(r.nextEntry.remaining).toBe(0);
  });

  it('rejects when the wallet is short', () => {
    const r = buy({ wallet: 10, qty: 5, entry: unlimited });
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('insufficient-funds');
  });

  it('rejects when the stack is out of stock', () => {
    const dry: ShopStockEntry = { itemId: 'goat-cheese', price: 95, remaining: 0 };
    const r = buy({ wallet: 1000, qty: 1, entry: dry });
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('out-of-stock');
  });
});

describe('sellValue', () => {
  it('applies the quality multiplier and an optional price modifier', () => {
    const item = ITEMS[0]!;
    expect(sellValue({ itemId: 'x', qty: 4, quality: 0, item })).toBe(32);
    expect(sellValue({ itemId: 'x', qty: 4, quality: 2, item })).toBe(48);
    expect(sellValue({ itemId: 'x', qty: 1, quality: 0, item, priceMultiplier: 1.2 }).valueOf()).toBe(10);
  });
});

describe('isShopOpen', () => {
  it('respects opening hours and festival closures', () => {
    const hours = { shopId: 's', open: 9 * 60, close: 18 * 60 };
    expect(isShopOpen(hours, 9 * 60, false)).toBe(true);
    expect(isShopOpen(hours, 8 * 60 + 59, false)).toBe(false);
    expect(isShopOpen(hours, 18 * 60, false)).toBe(false);
    expect(isShopOpen(hours, 12 * 60, true)).toBe(false);
  });
});

describe('RF-15: BALLAST_BAY_HOURS + hoursFor', () => {
  it('returns hours for every Ballast Bay building', async () => {
    const { BALLAST_BAY_HOURS, hoursFor } = await import('../../src/engine/shops');
    expect(Object.keys(BALLAST_BAY_HOURS).length).toBeGreaterThan(5);
    expect(hoursFor('market-bakery')?.open).toBe(6 * 60);
    expect(hoursFor('fishmonger')?.close).toBe(14 * 60);
    expect(hoursFor('unknown-building')).toBeNull();
  });

  it('apartments are open 24/7 (open = close = full day boundary)', async () => {
    const { hoursFor, isShopOpen } = await import('../../src/engine/shops');
    const apt = hoursFor('apartments')!;
    expect(isShopOpen(apt, 0, false)).toBe(true);
    expect(isShopOpen(apt, 23 * 60, false)).toBe(true);
  });
});
