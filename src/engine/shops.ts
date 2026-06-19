import type { Item, Season, Shop } from '../data/schemas';

/**
 * Shops + economy (Prompt 016). Pure. A `ShopStock` is the runtime stock list
 * for one shop, restocked daily from the underlying `Shop` definition + season
 * + project flags. Buy / sell run through `transact` which routes the wallet
 * + inventory side-effects via callbacks.
 */
export interface ShopStockEntry {
  itemId: string;
  price: number; // gold cost per unit
  /** -1 = unlimited per day. */
  remaining: number;
}

export interface ShopStock {
  shopId: string;
  entries: ShopStockEntry[];
}

export interface RestockInput {
  shop: Shop;
  itemsById: ReadonlyMap<string, Item>;
  season: Season;
  /** Project flag map; some town projects open new shop stock. */
  flags: Record<string, boolean>;
  /** Multiplier applied to base sellPrice when computing the buy price. */
  buyMarkup?: number;
}

/**
 * Build today's stock for one shop. By default every item in the shop's
 * `stockItemIds` lists at 1.5× its sell price (the simple cozy markup).
 * Out-of-season items don't list. Project-gated items are filtered out unless
 * their flag is set on `input.flags`.
 */
export function restockShop(input: RestockInput): ShopStock {
  const markup = input.buyMarkup ?? 1.5;
  const entries: ShopStockEntry[] = [];
  for (const id of input.shop.stockItemIds) {
    const item = input.itemsById.get(id);
    if (!item) continue;
    if (isItemSeasonal(item) && !item.tags.includes(input.season)) continue;
    const flag = `unlock-${id}`;
    if (item.tags.includes('project-gated') && !input.flags[flag]) continue;
    entries.push({
      itemId: id,
      price: Math.max(1, Math.round(item.sellPrice * markup)),
      remaining: stockLimitFor(item),
    });
  }
  return { shopId: input.shop.id, entries };
}

function isItemSeasonal(item: Item): boolean {
  return item.tags.some((t) => t === 'spring' || t === 'summer' || t === 'fall' || t === 'winter');
}

function stockLimitFor(item: Item): number {
  // Cooked + artisan goods are limited; raw materials are unlimited.
  if (item.category === 'cooking' || item.category === 'artisan') return 3;
  return -1;
}

export interface BuyAttempt {
  wallet: number;
  qty: number;
  entry: ShopStockEntry;
}

export interface BuyResult {
  accepted: boolean;
  cost: number;
  nextEntry: ShopStockEntry;
  reason?: 'insufficient-funds' | 'out-of-stock';
}

export function buy(attempt: BuyAttempt): BuyResult {
  if (attempt.entry.remaining === 0) {
    return { accepted: false, cost: 0, nextEntry: attempt.entry, reason: 'out-of-stock' };
  }
  const requested =
    attempt.entry.remaining > 0
      ? Math.min(attempt.qty, attempt.entry.remaining)
      : attempt.qty;
  const cost = requested * attempt.entry.price;
  if (cost > attempt.wallet) {
    return { accepted: false, cost, nextEntry: attempt.entry, reason: 'insufficient-funds' };
  }
  const nextRemaining =
    attempt.entry.remaining > 0 ? attempt.entry.remaining - requested : -1;
  return {
    accepted: true,
    cost,
    nextEntry: { ...attempt.entry, remaining: nextRemaining },
  };
}

export interface SellInput {
  itemId: string;
  qty: number;
  quality: number;
  item: Item;
  priceMultiplier?: number;
}

export function sellValue(input: SellInput): number {
  const qMult = [1.0, 1.25, 1.5, 2.0][Math.max(0, Math.min(3, input.quality))] ?? 1;
  const priceMult = input.priceMultiplier ?? 1;
  return Math.max(0, Math.round(input.item.sellPrice * qMult * priceMult)) * input.qty;
}

/**
 * Opening hours model. A shop is open between `open` and `close`. During an
 * active festival, every shop is closed.
 */
export interface ShopHours {
  shopId: string;
  open: number; // minutes from midnight
  close: number;
}

export function isShopOpen(
  hours: ShopHours,
  minutes: number,
  festivalActive: boolean,
): boolean {
  if (festivalActive) return false;
  return minutes >= hours.open && minutes < hours.close;
}

/**
 * RF-15: per-building default hours table for the Ballast Bay storefronts.
 * Index keyed by the building id used in `TownScene.BUILDINGS`. A building
 * not in this table is treated as always-open.
 */
export const BALLAST_BAY_HOURS: Record<string, ShopHours> = {
  'market-bakery': { shopId: 'market-bakery', open: 6 * 60, close: 18 * 60 },
  'market-clinic': { shopId: 'market-clinic', open: 8 * 60, close: 19 * 60 },
  'market-library': { shopId: 'market-library', open: 10 * 60, close: 20 * 60 },
  'market-gear': { shopId: 'market-gear', open: 9 * 60, close: 18 * 60 },
  'fishmonger': { shopId: 'fishmonger', open: 5 * 60, close: 14 * 60 },
  'community-hall': { shopId: 'community-hall', open: 8 * 60, close: 22 * 60 },
  'schoolhouse': { shopId: 'schoolhouse', open: 8 * 60, close: 16 * 60 },
  'blacksmith': { shopId: 'blacksmith', open: 9 * 60, close: 17 * 60 },
  'apartments': { shopId: 'apartments', open: 0, close: 24 * 60 },
};

export function hoursFor(buildingId: string): ShopHours | null {
  return BALLAST_BAY_HOURS[buildingId] ?? null;
}
