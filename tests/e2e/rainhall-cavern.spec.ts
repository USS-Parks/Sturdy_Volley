import { test, expect } from '@playwright/test';

type CaveLayer = 'render' | 'collision' | 'nav' | 'anchor' | 'volume';

declare global {
  interface Window {
    sturdyVolleyCave?: {
      region: () => string;
      meshCount: () => number;
      anchors: () => string[];
      layerCount: (l: CaveLayer) => number;
      enabledCount: (l: CaveLayer) => number;
      setLayer: (l: CaveLayer, on: boolean) => void;
      player: () => { x: number; z: number; y: number; facing: number; medium: string; traversing: boolean };
      setPlayer: (x: number, z: number, facing?: number) => void;
      setMove: (x: number, z: number) => void;
      cameraState: () => { context: string; variant: string };
      creatureCount: () => number;
      climbLedge: () => boolean;
      atAnchor: (id: string) => boolean;
      pressAction: () => boolean;
      clockMinutes: () => number;
      npcToken: () => string;
      tick: (n?: number) => void;
    };
    // sturdyVolleyTown declared canonically in ballast-bay-town.spec.ts.
  }
}

const bootCave = async (page: import('@playwright/test').Page) => {
  await page.goto('/?scene=RainhallCavern');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyCave?.region));
};

test.describe('Rainhall Caverns — cave slice (WEF-10c-ii)', () => {
  test('the cavern boots with anchors and the cave vocabulary', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await bootCave(page);
    expect(await page.evaluate(() => window.sturdyVolleyCave!.region())).toBe('rainhall-caverns');
    const anchors = await page.evaluate(() => window.sturdyVolleyCave!.anchors());
    expect(anchors).toEqual(expect.arrayContaining(['cave-entrance', 'mineral-pool', 'stair-base', 'ledge-link-base', 'cave-mouth']));
    expect(await page.evaluate(() => window.sturdyVolleyCave!.meshCount())).toBeGreaterThan(40);
    expect(await page.evaluate(() => window.sturdyVolleyCave!.creatureCount())).toBe(2);

    await page.waitForTimeout(300);
    const shot = await page.screenshot();
    await testInfo.attach(`rainhall-cavern-${testInfo.project.name}`, { body: shot, contentType: 'image/png' });
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('every debug layer toggles independently', async ({ page }) => {
    await bootCave(page);
    for (const layer of ['collision', 'nav', 'anchor', 'volume'] as CaveLayer[]) {
      expect(await page.evaluate((l) => window.sturdyVolleyCave!.enabledCount(l), layer)).toBe(0);
      const on = await page.evaluate((l) => { window.sturdyVolleyCave!.setLayer(l, true); return { on: window.sturdyVolleyCave!.enabledCount(l), count: window.sturdyVolleyCave!.layerCount(l) }; }, layer);
      expect(on.count).toBeGreaterThan(0);
      expect(on.on).toBe(on.count);
      expect(await page.evaluate((l) => { window.sturdyVolleyCave!.setLayer(l, false); return window.sturdyVolleyCave!.enabledCount(l); }, layer)).toBe(0);
    }
  });

  test('the cave camera tightens in the entrance passage and opens in the chamber', async ({ page }) => {
    await bootCave(page);
    const tight = await page.evaluate(() => { window.sturdyVolleyCave!.setPlayer(32, 8); window.sturdyVolleyCave!.tick(5); return window.sturdyVolleyCave!.cameraState(); });
    expect(tight.context).toBe('cave');
    expect(tight.variant, 'tight passage framing').toBe('near');
    const open = await page.evaluate(() => { window.sturdyVolleyCave!.setPlayer(30, 40); window.sturdyVolleyCave!.tick(5); return window.sturdyVolleyCave!.cameraState(); });
    expect(open.context).toBe('cave');
    expect(open.variant, 'open chamber framing').toBe('standard');
  });

  test('slope/stair, the authored ledge-link, and the mineral-pool wade are live', async ({ page }) => {
    await bootCave(page);
    // Slope/stair: climb the stair flight onto the ledge.
    const stairTop = await page.evaluate(() => {
      window.sturdyVolleyCave!.setPlayer(50, 34);
      window.sturdyVolleyCave!.setMove(0, 1);
      window.sturdyVolleyCave!.tick(120);
      return window.sturdyVolleyCave!.player();
    });
    expect(stairTop.y, 'climbed the stairs onto the ledge').toBeGreaterThan(2);

    // Ledge-link: the authored climb (no free jump) lifts the player to the ledge.
    const climbed = await page.evaluate(() => {
      window.sturdyVolleyCave!.setMove(0, 0);
      window.sturdyVolleyCave!.setPlayer(44, 38);
      const began = window.sturdyVolleyCave!.climbLedge();
      window.sturdyVolleyCave!.tick(28);
      return { began, player: window.sturdyVolleyCave!.player() };
    });
    expect(climbed.began).toBe(true);
    expect(climbed.player.y, 'ledge-link lifted the player').toBeGreaterThan(2);
    expect(climbed.player.traversing, 'traversal completed').toBe(false);

    // Mineral-spring pool wade.
    const wade = await page.evaluate(() => {
      window.sturdyVolleyCave!.setPlayer(28, 27);
      window.sturdyVolleyCave!.tick(3);
      return window.sturdyVolleyCave!.player().medium;
    });
    expect(wade).toBe('wade');
  });

  test('the cave mouth transitions to Ballast Bay Town preserving clock + NPC', async ({ page }) => {
    await bootCave(page);
    const began = await page.evaluate(() => {
      window.sturdyVolleyCave!.setPlayer(60, 25);
      const at = window.sturdyVolleyCave!.atAnchor('cave-mouth');
      const ok = window.sturdyVolleyCave!.pressAction();
      return { at, ok };
    });
    expect(began.at).toBe(true);
    expect(began.ok).toBe(true);
    await page.waitForFunction(() => Boolean(window.sturdyVolleyTown?.region));
    const town = await page.evaluate(() => ({ region: window.sturdyVolleyTown!.region(), clock: window.sturdyVolleyTown!.clockMinutes(), npc: window.sturdyVolleyTown!.npcToken() }));
    expect(town.region).toBe('ballast-bay-town');
    expect(town.clock).toBe(9 * 60);
    expect(town.npc).toBe('npc-state-v1');
  });

  test('the cavern is reachable from Ballast Bay Town via the terrace cave mouth', async ({ page }) => {
    await page.goto('/?scene=BallastBayTown');
    await expect(page.locator('#game-canvas')).toBeVisible();
    await page.waitForFunction(() => Boolean(window.sturdyVolleyTown?.region));
    const began = await page.evaluate(() => {
      window.sturdyVolleyTown!.setPlayer(110, 86); // the terrace-stair-top cave mouth
      return window.sturdyVolleyTown!.pressAction();
    });
    expect(began).toBe(true);
    await page.waitForFunction(() => Boolean(window.sturdyVolleyCave?.region));
    const cave = await page.evaluate(() => ({ region: window.sturdyVolleyCave!.region(), clock: window.sturdyVolleyCave!.clockMinutes(), player: window.sturdyVolleyCave!.player() }));
    expect(cave.region).toBe('rainhall-caverns');
    expect(cave.clock).toBe(9 * 60);
    expect(cave.player.x, 'arrived at the cave entrance').toBeCloseTo(32, 0);
  });
});
