import type { InventoryStack } from './saveModel';

/**
 * Renderer-agnostic inventory engine (Prompt 007). Containers are fixed-length
 * arrays of nullable stacks — the same shape powers the player inventory, the
 * hotbar (the first N slots), chests, and the shipping bin. All mutations
 * return a fresh container so the renderer can diff cleanly.
 *
 * Item *identity* is the (itemId, quality) pair: a "common" turnip and a
 * "silver" turnip stack the same way real produce baskets do — not at all.
 */
export const MAX_STACK = 99;
export const DEFAULT_INVENTORY_CAPACITY = 24;
export const DEFAULT_HOTBAR_SIZE = 8;
export const DEFAULT_CHEST_CAPACITY = 24;
export const DEFAULT_SHIPPING_BIN_CAPACITY = 16;

export const QUALITY_LABEL = ['Common', 'Silver', 'Gold', 'Iridium'] as const;
export type QualityTier = 0 | 1 | 2 | 3;

const QUALITY_MULTIPLIER = [1.0, 1.25, 1.5, 2.0] as const;

export function qualityMultiplier(quality: number): number {
  const q = Math.max(0, Math.min(3, Math.floor(quality)));
  return QUALITY_MULTIPLIER[q]!;
}

/** Per-unit sell value for one stack, snapped to a whole gold piece. */
export function sellValueOf(stack: InventoryStack, basePrice: number): number {
  return Math.max(0, Math.round(basePrice * qualityMultiplier(stack.quality))) * stack.qty;
}

export type Slot = InventoryStack | null;

export interface Container {
  slots: Slot[];
  capacity: number;
}

export function createContainer(capacity: number): Container {
  return { slots: new Array<Slot>(capacity).fill(null), capacity };
}

function cloneSlots(slots: Slot[]): Slot[] {
  return slots.map((s) => (s ? { ...s } : null));
}

function cloneContainer(c: Container): Container {
  return { slots: cloneSlots(c.slots), capacity: c.capacity };
}

function matches(a: InventoryStack, b: { itemId: string; quality: number }): boolean {
  return a.itemId === b.itemId && a.quality === b.quality;
}

export function findFirstEmpty(c: Container): number {
  return c.slots.findIndex((s) => s === null);
}

export function countItem(c: Container, itemId: string): number {
  let total = 0;
  for (const slot of c.slots) {
    if (slot && slot.itemId === itemId) total += slot.qty;
  }
  return total;
}

export function findStack(
  c: Container,
  itemId: string,
  quality: number,
  startAt = 0,
): number {
  for (let i = startAt; i < c.slots.length; i++) {
    const s = c.slots[i];
    if (s && matches(s, { itemId, quality })) return i;
  }
  return -1;
}

export interface AddItemResult {
  container: Container;
  added: number;
  overflow: number;
}

/**
 * Add `qty` of an item, auto-stacking onto existing identical (id+quality)
 * stacks first, then spilling into empty slots. Stackable items respect
 * MAX_STACK; non-stackable items take one slot per unit.
 */
export function addItem(
  c: Container,
  itemId: string,
  qty: number,
  quality: number = 0,
  options: { stackable?: boolean } = {},
): AddItemResult {
  const stackable = options.stackable ?? true;
  if (qty <= 0) return { container: cloneContainer(c), added: 0, overflow: 0 };
  const cap = stackable ? MAX_STACK : 1;
  const out = cloneContainer(c);
  let remaining = qty;

  if (stackable) {
    for (let i = 0; i < out.slots.length && remaining > 0; i++) {
      const slot = out.slots[i];
      if (!slot || !matches(slot, { itemId, quality })) continue;
      const room = cap - slot.qty;
      if (room <= 0) continue;
      const take = Math.min(remaining, room);
      slot.qty += take;
      remaining -= take;
    }
  }

  for (let i = 0; i < out.slots.length && remaining > 0; i++) {
    if (out.slots[i] !== null) continue;
    const take = Math.min(remaining, cap);
    out.slots[i] = { itemId, qty: take, quality };
    remaining -= take;
  }

  return { container: out, added: qty - remaining, overflow: remaining };
}

/** Remove up to `qty` of an itemId from the container, lowest-quality first. */
export function removeItem(c: Container, itemId: string, qty: number): {
  container: Container;
  removed: number;
} {
  if (qty <= 0) return { container: cloneContainer(c), removed: 0 };
  const out = cloneContainer(c);
  let remaining = qty;
  for (let i = 0; i < out.slots.length && remaining > 0; i++) {
    const slot = out.slots[i];
    if (!slot || slot.itemId !== itemId) continue;
    const take = Math.min(remaining, slot.qty);
    slot.qty -= take;
    remaining -= take;
    if (slot.qty <= 0) out.slots[i] = null;
  }
  return { container: out, removed: qty - remaining };
}

export function clearSlot(c: Container, index: number): Container {
  const out = cloneContainer(c);
  out.slots[index] = null;
  return out;
}

export function swapSlots(c: Container, a: number, b: number): Container {
  if (a === b) return cloneContainer(c);
  const out = cloneContainer(c);
  const tmp = out.slots[a] ?? null;
  out.slots[a] = out.slots[b] ?? null;
  out.slots[b] = tmp;
  return out;
}

/** Try to merge B into A (same id+quality) up to MAX_STACK; otherwise swap. */
export function placeOrMerge(c: Container, from: number, to: number): Container {
  if (from === to) return cloneContainer(c);
  const out = cloneContainer(c);
  const src = out.slots[from] ?? null;
  const dst = out.slots[to] ?? null;
  if (!src) return out;
  if (!dst) {
    out.slots[to] = src;
    out.slots[from] = null;
    return out;
  }
  if (matches(src, dst)) {
    const room = MAX_STACK - dst.qty;
    if (room > 0) {
      const take = Math.min(room, src.qty);
      dst.qty += take;
      src.qty -= take;
      if (src.qty <= 0) out.slots[from] = null;
      return out;
    }
  }
  out.slots[to] = src;
  out.slots[from] = dst;
  return out;
}

/** Split half of `from` into an empty `to` slot (rounding up to the mover). */
export function splitStack(c: Container, from: number, to: number): Container {
  const out = cloneContainer(c);
  const src = out.slots[from] ?? null;
  if (!src || src.qty < 2 || out.slots[to]) return out;
  const moved = Math.ceil(src.qty / 2);
  out.slots[to] = { itemId: src.itemId, qty: moved, quality: src.quality };
  src.qty -= moved;
  if (src.qty <= 0) out.slots[from] = null;
  return out;
}

export interface MoveBetweenResult {
  from: Container;
  to: Container;
}

/**
 * Move (or merge) a slot from container A into container B. If `toIndex` is
 * given the move targets that slot; otherwise the engine picks the best fit.
 */
export function moveBetween(
  fromC: Container,
  to: Container,
  fromIndex: number,
  toIndex?: number,
): MoveBetweenResult {
  const fromOut = cloneContainer(fromC);
  const toOut = cloneContainer(to);
  const src = fromOut.slots[fromIndex] ?? null;
  if (!src) return { from: fromOut, to: toOut };

  if (toIndex === undefined) {
    const result = addItem(toOut, src.itemId, src.qty, src.quality);
    fromOut.slots[fromIndex] = result.overflow > 0
      ? { itemId: src.itemId, qty: result.overflow, quality: src.quality }
      : null;
    return { from: fromOut, to: result.container };
  }

  const dst = toOut.slots[toIndex] ?? null;
  if (!dst) {
    toOut.slots[toIndex] = src;
    fromOut.slots[fromIndex] = null;
    return { from: fromOut, to: toOut };
  }
  if (matches(src, dst)) {
    const room = MAX_STACK - dst.qty;
    const take = Math.min(room, src.qty);
    if (take > 0) {
      dst.qty += take;
      src.qty -= take;
      if (src.qty <= 0) fromOut.slots[fromIndex] = null;
      return { from: fromOut, to: toOut };
    }
  }
  // Swap when the target is occupied and unmergeable.
  toOut.slots[toIndex] = src;
  fromOut.slots[fromIndex] = dst;
  return { from: fromOut, to: toOut };
}

export function isEmpty(c: Container): boolean {
  return c.slots.every((s) => s === null);
}
