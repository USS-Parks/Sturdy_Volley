import { describe, it, expect } from 'vitest';
import {
  createContainer,
  addItem,
  removeItem,
  swapSlots,
  placeOrMerge,
  splitStack,
  moveBetween,
  countItem,
  findFirstEmpty,
  findStack,
  isEmpty,
  qualityMultiplier,
  sellValueOf,
  MAX_STACK,
} from '../../src/engine/inventory';

describe('quality multiplier', () => {
  it('returns Stardew-adjacent factors clamped to 0..3', () => {
    expect(qualityMultiplier(0)).toBe(1);
    expect(qualityMultiplier(1)).toBe(1.25);
    expect(qualityMultiplier(2)).toBe(1.5);
    expect(qualityMultiplier(3)).toBe(2);
    expect(qualityMultiplier(99)).toBe(2);
    expect(qualityMultiplier(-1)).toBe(1);
  });
});

describe('sellValueOf', () => {
  it('multiplies base price by quality and quantity', () => {
    expect(sellValueOf({ itemId: 'x', qty: 4, quality: 0 }, 25)).toBe(100);
    expect(sellValueOf({ itemId: 'x', qty: 2, quality: 2 }, 30)).toBe(2 * Math.round(30 * 1.5));
  });
});

describe('addItem', () => {
  it('fills an empty slot then merges into matching stacks', () => {
    const c = createContainer(4);
    const r1 = addItem(c, 'bell-peas', 10);
    expect(r1.container.slots[0]).toEqual({ itemId: 'bell-peas', qty: 10, quality: 0 });
    expect(r1.added).toBe(10);
    expect(r1.overflow).toBe(0);

    const r2 = addItem(r1.container, 'bell-peas', 5);
    expect(r2.container.slots[0]?.qty).toBe(15);
    expect(r2.container.slots[1]).toBeNull();
  });

  it('respects MAX_STACK and spills overflow into the next slot', () => {
    const c = createContainer(2);
    const r = addItem(c, 'bell-peas', MAX_STACK + 5);
    expect(r.container.slots[0]?.qty).toBe(MAX_STACK);
    expect(r.container.slots[1]?.qty).toBe(5);
    expect(r.overflow).toBe(0);
  });

  it('reports overflow when the container is full', () => {
    const c = createContainer(1);
    const r = addItem(c, 'bell-peas', MAX_STACK + 10);
    expect(r.added).toBe(MAX_STACK);
    expect(r.overflow).toBe(10);
  });

  it('treats different qualities as distinct stacks', () => {
    const c = addItem(createContainer(3), 'bell-peas', 5, 0).container;
    const r = addItem(c, 'bell-peas', 3, 2);
    expect(r.container.slots[0]).toEqual({ itemId: 'bell-peas', qty: 5, quality: 0 });
    expect(r.container.slots[1]).toEqual({ itemId: 'bell-peas', qty: 3, quality: 2 });
  });

  it('non-stackable items take one slot per unit', () => {
    const c = createContainer(3);
    const r = addItem(c, 'driftwood', 3, 0, { stackable: false });
    expect(r.container.slots.every((s) => s?.qty === 1)).toBe(true);
  });
});

describe('removeItem', () => {
  it('removes lowest-quality matches first and clears emptied slots', () => {
    let c = createContainer(3);
    c = addItem(c, 'bell-peas', 5, 0).container;
    c = addItem(c, 'bell-peas', 3, 2).container;
    const r = removeItem(c, 'bell-peas', 6);
    expect(r.removed).toBe(6);
    expect(r.container.slots[0]).toBeNull(); // ate the 5 lower-quality first
    expect(r.container.slots[1]?.qty).toBe(2); // then 1 from the silver stack
  });

  it('returns how many were actually removed when short', () => {
    const c = addItem(createContainer(2), 'bell-peas', 4).container;
    const r = removeItem(c, 'bell-peas', 10);
    expect(r.removed).toBe(4);
  });
});

describe('counts + queries', () => {
  it('counts across stacks, finds first empty, finds matching stacks', () => {
    let c = createContainer(3);
    c = addItem(c, 'bell-peas', 4).container;
    c = addItem(c, 'bell-peas', 3, 2).container;
    expect(countItem(c, 'bell-peas')).toBe(7);
    expect(findFirstEmpty(c)).toBe(2);
    expect(findStack(c, 'bell-peas', 2)).toBe(1);
    expect(findStack(c, 'bell-peas', 9)).toBe(-1);
    expect(isEmpty(c)).toBe(false);
    expect(isEmpty(createContainer(2))).toBe(true);
  });
});

describe('swap / placeOrMerge / split', () => {
  it('swaps two slots', () => {
    const c = addItem(addItem(createContainer(3), 'a', 2).container, 'b', 4).container;
    const out = swapSlots(c, 0, 1);
    expect(out.slots[0]?.itemId).toBe('b');
    expect(out.slots[1]?.itemId).toBe('a');
  });

  it('placeOrMerge stacks identical items, swaps incompatible ones', () => {
    let c = createContainer(2);
    c = addItem(c, 'bell-peas', 5).container;
    c = addItem(c, 'bell-peas', 3).container; // merges into [0]
    expect(c.slots[0]?.qty).toBe(8);

    let d = createContainer(2);
    d = addItem(d, 'bell-peas', 5).container;
    d = addItem(d, 'driftwood', 1).container;
    const swapped = placeOrMerge(d, 0, 1);
    expect(swapped.slots[0]?.itemId).toBe('driftwood');
    expect(swapped.slots[1]?.itemId).toBe('bell-peas');
  });

  it('splits a stack into an empty slot rounding up to the mover', () => {
    const c = addItem(createContainer(2), 'bell-peas', 5).container;
    const r = splitStack(c, 0, 1);
    expect(r.slots[1]?.qty).toBe(3); // ceil(5/2)
    expect(r.slots[0]?.qty).toBe(2);
  });

  it('refuses to split into an occupied slot', () => {
    let c = createContainer(2);
    c = addItem(c, 'a', 4).container;
    c = addItem(c, 'b', 1).container;
    const r = splitStack(c, 0, 1);
    expect(r.slots[1]?.itemId).toBe('b');
    expect(r.slots[0]?.qty).toBe(4);
  });
});

describe('moveBetween', () => {
  it('moves a slot into an empty target by default', () => {
    const from = addItem(createContainer(2), 'bell-peas', 5).container;
    const to = createContainer(2);
    const r = moveBetween(from, to, 0);
    expect(r.from.slots[0]).toBeNull();
    expect(r.to.slots[0]).toEqual({ itemId: 'bell-peas', qty: 5, quality: 0 });
  });

  it('merges into a matching destination slot', () => {
    const from = addItem(createContainer(2), 'bell-peas', 5).container;
    let to = createContainer(2);
    to = addItem(to, 'bell-peas', 2).container;
    const r = moveBetween(from, to, 0, 0);
    expect(r.to.slots[0]?.qty).toBe(7);
    expect(r.from.slots[0]).toBeNull();
  });

  it('swaps when the destination is incompatible', () => {
    const from = addItem(createContainer(1), 'bell-peas', 5).container;
    const to = addItem(createContainer(1), 'driftwood', 1).container;
    const r = moveBetween(from, to, 0, 0);
    expect(r.from.slots[0]?.itemId).toBe('driftwood');
    expect(r.to.slots[0]?.itemId).toBe('bell-peas');
  });
});
