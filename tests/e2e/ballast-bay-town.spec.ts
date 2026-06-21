import { test, expect } from '@playwright/test';

type TownLayer = 'render' | 'collision' | 'nav' | 'anchor' | 'volume';

declare global {
  interface Window {
    sturdyVolleyTown?: {
      region: () => string;
      meshCount: () => number;
      anchors: () => string[];
      chunkCount: () => number;
      layerCount: (l: TownLayer) => number;
      enabledCount: (l: TownLayer) => number;
      setLayer: (l: TownLayer, on: boolean) => void;
      player: () => { x: number; z: number; y: number; facing: number; medium: string };
      setPlayer: (x: number, z: number, facing?: number) => void;
      setMove: (x: number, z: number) => void;
      cameraState: () => { context: string; variant: string; activeVolumeId: string | null };
      townsfolk: () => Array<{ x: number; z: number; inLane: boolean }>;
      canopyAngles: () => number[];
      clockMinutes: () => number;
      npcToken: () => string;
      atGate: () => boolean;
      pressAction: () => boolean;
      tick: (n?: number) => void;
    };
    // `sturdyVolleyFarm` is declared canonically in breakpoint-farm.spec.ts; the
    // Farm↔Town round-trip below reuses that shared global (same tsc project).
  }
}

const bootTown = async (page: import('@playwright/test').Page) => {
  await page.goto('/?scene=BallastBayTown');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyTown?.region));
};

test.describe('Ballast Bay town district (WEF-10b)', () => {
  test('the town boots from the blockout with anchors + the 5×4 chunk grid', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await bootTown(page);
    expect(await page.evaluate(() => window.sturdyVolleyTown!.region())).toBe('ballast-bay-town');
    const anchors = await page.evaluate(() => window.sturdyVolleyTown!.anchors());
    expect(anchors).toEqual(expect.arrayContaining(['harbor-dock', 'community-hall-door', 'terrace-stair-base']));
    expect(await page.evaluate(() => window.sturdyVolleyTown!.chunkCount())).toBe(20);
    expect(await page.evaluate(() => window.sturdyVolleyTown!.meshCount())).toBeGreaterThan(80);

    await page.waitForTimeout(300);
    const shot = await page.screenshot();
    await testInfo.attach(`ballast-bay-town-${testInfo.project.name}`, { body: shot, contentType: 'image/png' });
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('every debug layer toggles independently', async ({ page }) => {
    await bootTown(page);
    for (const layer of ['collision', 'nav', 'anchor', 'volume'] as TownLayer[]) {
      expect(await page.evaluate((l) => window.sturdyVolleyTown!.enabledCount(l), layer)).toBe(0);
      const on = await page.evaluate((l) => {
        window.sturdyVolleyTown!.setLayer(l, true);
        return { on: window.sturdyVolleyTown!.enabledCount(l), count: window.sturdyVolleyTown!.layerCount(l) };
      }, layer);
      expect(on.count).toBeGreaterThan(0);
      expect(on.on).toBe(on.count);
      expect(await page.evaluate((l) => { window.sturdyVolleyTown!.setLayer(l, false); return window.sturdyVolleyTown!.enabledCount(l); }, layer)).toBe(0);
    }
    expect(await page.evaluate(() => window.sturdyVolleyTown!.layerCount('render'))).toBeGreaterThan(40);
  });

  test('the market-lane and harborfront authored volumes engage', async ({ page }) => {
    await bootTown(page);
    const lane = await page.evaluate(() => {
      window.sturdyVolleyTown!.setPlayer(80, 50);
      window.sturdyVolleyTown!.tick(5);
      return window.sturdyVolleyTown!.cameraState().activeVolumeId;
    });
    expect(lane).toBe('vol-market-lane');
    const harbor = await page.evaluate(() => {
      window.sturdyVolleyTown!.setPlayer(80, 16);
      window.sturdyVolleyTown!.tick(5);
      return window.sturdyVolleyTown!.cameraState().activeVolumeId;
    });
    expect(harbor).toBe('vol-harborfront');
  });

  test('elevation, harbor water, townsfolk and market canopies are live', async ({ page }) => {
    await bootTown(page);
    // Elevation + traversal: climb the terrace stairs.
    const top = await page.evaluate(() => {
      window.sturdyVolleyTown!.setPlayer(110, 72);
      window.sturdyVolleyTown!.setMove(0, 1);
      window.sturdyVolleyTown!.tick(140);
      return window.sturdyVolleyTown!.player();
    });
    expect(top.y, 'climbed onto the upper terrace').toBeGreaterThan(2);

    // Harbor water wade.
    const wade = await page.evaluate(() => {
      window.sturdyVolleyTown!.setMove(0, 0);
      window.sturdyVolleyTown!.setPlayer(60, 12);
      window.sturdyVolleyTown!.tick(3);
      return window.sturdyVolleyTown!.player().medium;
    });
    expect(wade).toBe('wade');

    // Townsfolk walk the market lane.
    const folk = await page.evaluate(() => {
      window.sturdyVolleyTown!.tick(300);
      return window.sturdyVolleyTown!.townsfolk();
    });
    expect(folk.length).toBe(2);
    expect(folk.every((f) => f.inLane), 'townsfolk stay in the market lane').toBe(true);

    // Market canopies luff (hanging flora sway, out of lockstep).
    const canopies = await page.evaluate(() => window.sturdyVolleyTown!.canopyAngles());
    const spread = Math.max(...canopies) - Math.min(...canopies);
    expect(spread, 'canopies sway').toBeGreaterThan(0.02);
  });

  test('the west gate round-trips Farm ↔ Town, preserving clock + NPC state', async ({ page }) => {
    // Boot the farm, walk to the town gate, transition to the town.
    await page.goto('/?scene=BreakpointFarm');
    await expect(page.locator('#game-canvas')).toBeVisible();
    await page.waitForFunction(() => Boolean(window.sturdyVolleyFarm?.region));
    const toTown = await page.evaluate(() => {
      window.sturdyVolleyFarm!.setPlayer(122, 64);
      const began = window.sturdyVolleyFarm!.pressAction();
      return { began, clock: window.sturdyVolleyFarm!.clockMinutes() };
    });
    expect(toTown.began).toBe(true);

    await page.waitForFunction(() => Boolean(window.sturdyVolleyTown?.region));
    const inTown = await page.evaluate(() => ({
      region: window.sturdyVolleyTown!.region(),
      clock: window.sturdyVolleyTown!.clockMinutes(),
      npc: window.sturdyVolleyTown!.npcToken(),
      player: window.sturdyVolleyTown!.player(),
      atGate: window.sturdyVolleyTown!.atGate(),
    }));
    expect(inTown.region).toBe('ballast-bay-town');
    expect(inTown.clock).toBe(9 * 60);
    expect(inTown.npc).toBe('npc-state-v1');
    expect(inTown.player.x, 'arrived at the town west gate').toBeCloseTo(6, 0);

    // The arrival pose is at the farm gate → press to go back.
    const toFarm = await page.evaluate(() => {
      const atGate = window.sturdyVolleyTown!.atGate();
      const began = window.sturdyVolleyTown!.pressAction();
      return { atGate, began };
    });
    expect(toFarm.atGate).toBe(true);
    expect(toFarm.began).toBe(true);

    await page.waitForFunction(() => Boolean(window.sturdyVolleyFarm?.region));
    const back = await page.evaluate(() => ({
      region: window.sturdyVolleyFarm!.region(),
      clock: window.sturdyVolleyFarm!.clockMinutes(),
      npc: window.sturdyVolleyFarm!.npcToken(),
      player: window.sturdyVolleyFarm!.player(),
    }));
    expect(back.region).toBe('breakpoint-farm');
    expect(back.player.x, 'returned to the farm town gate').toBeCloseTo(120, 0);
    expect(back.clock).toBe(9 * 60);
    expect(back.npc).toBe('npc-state-v1');
  });
});
