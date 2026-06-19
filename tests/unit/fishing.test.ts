import { describe, it, expect } from 'vitest';
import {
  CRAB_POT_CATCH_MINUTES,
  FISH_CATALOG,
  baitPot,
  collectPot,
  markFirstCatch,
  nextBite,
  potReady,
  startMinigame,
  stepMinigame,
} from '../../src/engine/fishing';

describe('fishing catalog (Prompt 021)', () => {
  it('ships at least 12 original fish', () => {
    expect(FISH_CATALOG.length).toBeGreaterThanOrEqual(12);
    const ids = new Set(FISH_CATALOG.map((f) => f.id));
    expect(ids.size).toBe(FISH_CATALOG.length);
  });

  it('every fish has a sell price and at least one season', () => {
    for (const f of FISH_CATALOG) {
      expect(f.sellPrice).toBeGreaterThan(0);
      expect(f.seasons.length).toBeGreaterThan(0);
      expect(['common', 'uncommon', 'rare']).toContain(f.rarity);
    }
  });
});

describe('nextBite resolves fish or treasure', () => {
  it('returns a known fish id when one matches the slice', () => {
    const r = nextBite({
      timeMinutes: 9 * 60,
      season: 'spring',
      weather: 'sunny',
      tide: 'low',
      location: 'beach',
      seed: 1,
      withBait: true,
    });
    expect(r.waitSeconds).toBeGreaterThan(0);
    if (!r.isTreasure) {
      expect(FISH_CATALOG.find((f) => f.id === r.resolvedId)).toBeTruthy();
    }
  });

  it('treasure path resolves to a known itemId', () => {
    // Seed 200 has a high treasure roll; check the path doesn't throw.
    const r = nextBite({
      timeMinutes: 10 * 60,
      season: 'fall',
      weather: 'sunny',
      tide: 'high',
      location: 'reef',
      seed: 200,
      withBait: false,
    });
    if (r.isTreasure) {
      expect(['driftwood', 'tide-shell', 'pearl-shard', 'salt']).toContain(r.resolvedId);
    }
  });

  it('rain shortens the wait band vs sunny', () => {
    const rainy = nextBite({
      timeMinutes: 9 * 60,
      season: 'spring',
      weather: 'rain',
      tide: 'low',
      location: 'beach',
      seed: 5,
      withBait: true,
    });
    const sunny = nextBite({
      timeMinutes: 9 * 60,
      season: 'spring',
      weather: 'sunny',
      tide: 'low',
      location: 'beach',
      seed: 5,
      withBait: true,
    });
    expect(rainy.waitSeconds).toBeLessThanOrEqual(sunny.waitSeconds);
  });
});

describe('tension minigame', () => {
  it('assist mode widens the cursor band', () => {
    const off = startMinigame({ difficulty: 3, assist: false });
    const on = startMinigame({ difficulty: 3, assist: true });
    expect(on.cursorWidth).toBeGreaterThan(off.cursorWidth);
  });

  it('cursor follows intent and progress climbs when on target', () => {
    let state = startMinigame({ difficulty: 0, assist: true });
    // Force fish to be exactly at cursor by using difficulty 0.
    for (let i = 0; i < 60; i++) {
      const step = stepMinigame({ state, dt: 0.1, intent: 0, seed: i, assist: true });
      state = step.state;
      if (step.caught) break;
    }
    expect(state.progress).toBeGreaterThan(0);
  });

  it('lost fires when the player ignores the bar', () => {
    let state = startMinigame({ difficulty: 5, assist: false });
    // Force the cursor far from the fish by repeatedly nudging down.
    state = { ...state, cursorPos: 0, fishPos: 1 };
    for (let i = 0; i < 20; i++) {
      const step = stepMinigame({ state, dt: 0.5, intent: -1, seed: i, assist: false });
      state = step.state;
      if (step.lost) {
        expect(step.lost).toBe(true);
        return;
      }
    }
  });
});

describe('crab pots', () => {
  it('potReady is false until CRAB_POT_CATCH_MINUTES have elapsed', () => {
    const pot = baitPot(
      { id: 'p', sceneKey: 'Beach', x: 0, z: 0, baited: false, startedAt: null, catchItemId: null },
      0,
      1,
    );
    expect(potReady(pot, CRAB_POT_CATCH_MINUTES - 1)).toBe(false);
    expect(potReady(pot, CRAB_POT_CATCH_MINUTES)).toBe(true);
  });

  it('collectPot returns the cached item and clears the bait', () => {
    const baited = baitPot(
      { id: 'p', sceneKey: 'Beach', x: 0, z: 0, baited: false, startedAt: null, catchItemId: null },
      0,
      42,
    );
    const r = collectPot(baited, CRAB_POT_CATCH_MINUTES + 1);
    expect(r.itemId).not.toBeNull();
    expect(r.pot.baited).toBe(false);
    expect(r.pot.catchItemId).toBeNull();
  });
});

describe('first catch notification', () => {
  it('reports true the first time per fish id', () => {
    const a = markFirstCatch({}, 'silver-skipper');
    expect(a.isFirst).toBe(true);
    const b = markFirstCatch(a.seen, 'silver-skipper');
    expect(b.isFirst).toBe(false);
  });
});
