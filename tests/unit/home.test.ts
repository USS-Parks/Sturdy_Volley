import { describe, it, expect } from 'vitest';
import {
  getHomeState,
  setSurface,
  purchaseRenovation,
  hasRenovation,
  RENOVATIONS,
  buildDecorateRows,
  buildRenovationRows,
  buildSurfaceRows,
  loadFurnitureFromContent,
  furnitureById,
  earnedTrophies,
  DEFAULT_WALLPAPER,
  DEFAULT_FLOORING,
} from '../../src/engine/home';
import { createNewSave, parseSave, serializeSave } from '../../src/engine/saveModel';
import { loadGameContent } from '../../src/data/content';

describe('home surfaces (Prompt 060)', () => {
  it('a fresh save reads the default wall + floor finish and no renovations', () => {
    const save = createNewSave({ name: 'Pat', farmName: 'Tide' }, 0);
    expect(getHomeState(save, 'Interior')).toEqual({
      wallpaper: DEFAULT_WALLPAPER,
      flooring: DEFAULT_FLOORING,
      renovations: [],
    });
  });

  it('setSurface switches a known finish and rejects an unknown id', () => {
    const save = createNewSave({ name: 'Pat', farmName: 'Tide' }, 0);
    expect(setSurface(save, 'Interior', 'wallpaper', 'sage-wash')).toBe(true);
    expect(getHomeState(save, 'Interior').wallpaper).toBe('sage-wash');
    expect(setSurface(save, 'Interior', 'flooring', 'no-such-floor')).toBe(false);
    expect(getHomeState(save, 'Interior').flooring).toBe(DEFAULT_FLOORING);
  });

  it('home customization survives a save round-trip', () => {
    const save = createNewSave({ name: 'Pat', farmName: 'Tide' }, 0);
    save.wallet.gold = 2000;
    setSurface(save, 'Interior', 'wallpaper', 'navy-panel');
    purchaseRenovation(save, 'Interior', 'loft-shelf');
    const round = parseSave(serializeSave(save));
    expect(getHomeState(round, 'Interior')).toEqual(getHomeState(save, 'Interior'));
  });
});

describe('home renovations (Prompt 060)', () => {
  it('purchase deducts gold once, records it, and refuses a repeat', () => {
    const save = createNewSave({ name: 'Pat', farmName: 'Tide' }, 0);
    const reno = RENOVATIONS[0]!;
    save.wallet.gold = reno.price + 50;
    const first = purchaseRenovation(save, 'Interior', reno.id);
    expect(first.accepted).toBe(true);
    expect(save.wallet.gold).toBe(50);
    expect(hasRenovation(save, 'Interior', reno.id)).toBe(true);
    const second = purchaseRenovation(save, 'Interior', reno.id);
    expect(second).toEqual({ accepted: false, reason: 'already-built' });
  });

  it('purchase refuses when gold is short or the id is unknown', () => {
    const save = createNewSave({ name: 'Pat', farmName: 'Tide' }, 0);
    save.wallet.gold = 0;
    expect(purchaseRenovation(save, 'Interior', RENOVATIONS[0]!.id)).toEqual({
      accepted: false,
      reason: 'cant-afford',
    });
    expect(purchaseRenovation(save, 'Interior', 'no-such-reno')).toEqual({
      accepted: false,
      reason: 'unknown',
    });
  });

  it('buildRenovationRows flags owned + affordability', () => {
    const save = createNewSave({ name: 'Pat', farmName: 'Tide' }, 0);
    save.wallet.gold = RENOVATIONS[0]!.price;
    purchaseRenovation(save, 'Interior', RENOVATIONS[0]!.id);
    const rows = buildRenovationRows(save, 'Interior');
    const owned = rows.find((r) => r.id === RENOVATIONS[0]!.id)!;
    expect(owned.owned).toBe(true);
    // Spent everything, so other renovations are now unaffordable.
    expect(rows.filter((r) => !r.owned).every((r) => r.affordable === false)).toBe(true);
  });
});

describe('home furniture catalog (Prompt 060)', () => {
  it('the bundled furniture catalog loads with the expected categories', () => {
    const content = loadGameContent();
    const furniture = loadFurnitureFromContent(content);
    expect(furniture.length).toBeGreaterThanOrEqual(10);
    const cats = new Set(furniture.map((f) => f.category));
    for (const c of ['seat', 'table', 'shelf', 'banner', 'trophy-shelf', 'curio'] as const) {
      expect(cats.has(c), `missing category ${c}`).toBe(true);
    }
    expect(furnitureById(content).get('rush-stool')?.name).toBe('Rush Stool');
  });

  it('buildDecorateRows marks affordability against the wallet', () => {
    const content = loadGameContent();
    const furniture = loadFurnitureFromContent(content);
    const rows = buildDecorateRows(furniture, 100);
    const stool = rows.find((r) => r.id === 'rush-stool')!;
    expect(stool.affordable).toBe(true); // 90 g ≤ 100
    const armchair = rows.find((r) => r.id === 'driftwood-armchair')!;
    expect(armchair.affordable).toBe(false); // 320 g > 100
  });

  it('buildSurfaceRows marks the active finish', () => {
    const rows = buildSurfaceRows('wallpaper', 'sky-wash');
    expect(rows.find((r) => r.active)!.id).toBe('sky-wash');
    expect(rows.filter((r) => r.active)).toHaveLength(1);
  });
});

describe('trophy milestones (Prompt 060)', () => {
  it('a fresh save has earned no trophies, and a milestone lights one up', () => {
    const save = createNewSave({ name: 'Pat', farmName: 'Tide' }, 0);
    expect(earnedTrophies(save)).toHaveLength(0);
    save.wallet.gold = 2000;
    expect(earnedTrophies(save).some((t) => t.id === 'saver')).toBe(true);
  });
});
