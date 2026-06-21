import { test, expect } from '@playwright/test';

type RiverLayer = 'render' | 'collision' | 'nav' | 'anchor' | 'volume';

declare global {
  interface Window {
    sturdyVolleyRiver?: {
      region: () => string;
      meshCount: () => number;
      anchors: () => string[];
      layerCount: (l: RiverLayer) => number;
      enabledCount: (l: RiverLayer) => number;
      setLayer: (l: RiverLayer, on: boolean) => void;
      state: () => { phase: string; ridden: boolean; cameraContext: string; speed: number; horse: { x: number; z: number }; player: { x: number; z: number; y: number; grounded: boolean }; riderGap: number };
      cameraState: () => { context: string };
      setPlayer: (x: number, z: number, facing?: number) => void;
      setMove: (x: number, z: number) => void;
      setThrottle: (t: number) => void;
      pressAction: () => boolean;
      clockMinutes: () => number;
      npcToken: () => string;
      forded: () => boolean;
      crossedSeam: () => boolean;
      tunneled: () => boolean;
      minRiderY: () => number;
      finite: () => boolean;
      atGate: (id: string) => boolean;
      tick: (n?: number) => void;
    };
    // sturdyVolleyFarm / sturdyVolleyTown are declared canonically in their own
    // specs; reused here for the cross-region transitions (same tsc project).
  }
}

const bootRiver = async (page: import('@playwright/test').Page) => {
  await page.goto('/?scene=KlamityRiver');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyRiver?.region));
};

/** Mount the corridor horse deterministically inside one evaluate. */
const mountUp = async (page: import('@playwright/test').Page) => {
  await page.evaluate(() => {
    const r = window.sturdyVolleyRiver!;
    r.setPlayer(64, 103); // beside the hitching-post horse at (64,104)
    r.pressAction();
    r.tick(20); // complete the mount blend
  });
};

test.describe('Klam-ity River corridor + mounted traversal (WEF-10c-i)', () => {
  test('the corridor boots with anchors and the riverbank vocabulary', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await bootRiver(page);
    expect(await page.evaluate(() => window.sturdyVolleyRiver!.region())).toBe('klam-ity-river');
    const anchors = await page.evaluate(() => window.sturdyVolleyRiver!.anchors());
    expect(anchors).toEqual(expect.arrayContaining(['horse-hitch', 'river-ford', 'river-bridge', 'ballast-bay-gate', 'willa-crick-gate']));
    expect(await page.evaluate(() => window.sturdyVolleyRiver!.meshCount())).toBeGreaterThan(40);

    await page.waitForTimeout(300);
    const shot = await page.screenshot();
    await testInfo.attach(`klamity-river-${testInfo.project.name}`, { body: shot, contentType: 'image/png' });
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('every debug layer toggles independently', async ({ page }) => {
    await bootRiver(page);
    for (const layer of ['collision', 'nav', 'anchor', 'volume'] as RiverLayer[]) {
      expect(await page.evaluate((l) => window.sturdyVolleyRiver!.enabledCount(l), layer)).toBe(0);
      const on = await page.evaluate((l) => { window.sturdyVolleyRiver!.setLayer(l, true); return { on: window.sturdyVolleyRiver!.enabledCount(l), count: window.sturdyVolleyRiver!.layerCount(l) }; }, layer);
      expect(on.count).toBeGreaterThan(0);
      expect(on.on).toBe(on.count);
      expect(await page.evaluate((l) => { window.sturdyVolleyRiver!.setLayer(l, false); return window.sturdyVolleyRiver!.enabledCount(l); }, layer)).toBe(0);
    }
  });

  test('mounted traversal fords the river and crosses the community seam without tunnelling', async ({ page }) => {
    await bootRiver(page);
    await mountUp(page);
    const mounted = await page.evaluate(() => window.sturdyVolleyRiver!.state());
    expect(mounted.ridden, 'mounted the horse').toBe(true);
    expect(mounted.cameraContext, 'camera handed to the mounted context').toBe('mounted');

    const before = await page.evaluate(() => window.sturdyVolleyRiver!.state().horse.z);
    await page.evaluate(() => {
      const r = window.sturdyVolleyRiver!;
      r.setMove(0, -1); // ride south toward the coast
      r.setThrottle(1); // gallop
      r.tick(220);
    });
    const after = await page.evaluate(() => window.sturdyVolleyRiver!.state());
    const proofs = await page.evaluate(() => ({
      forded: window.sturdyVolleyRiver!.forded(),
      seam: window.sturdyVolleyRiver!.crossedSeam(),
      tunneled: window.sturdyVolleyRiver!.tunneled(),
      minRiderY: window.sturdyVolleyRiver!.minRiderY(),
      finite: window.sturdyVolleyRiver!.finite(),
    }));
    expect(after.horse.z, 'rode south down the corridor').toBeLessThan(before - 40);
    expect(proofs.forded, 'waded the river ford').toBe(true);
    expect(proofs.seam, 'crossed the inland → coastal seam').toBe(true);
    expect(proofs.tunneled, 'never tunnels into collision').toBe(false);
    expect(proofs.minRiderY, 'rider never sinks below ground').toBeGreaterThan(0.5);
    expect(proofs.finite).toBe(true);
    expect(after.cameraContext, 'camera stayed mounted across the ford + seam').toBe('mounted');
  });

  test('dismount at the coast returns a valid grounded pose and reverts the camera', async ({ page }) => {
    await bootRiver(page);
    await mountUp(page);
    await page.evaluate(() => {
      const r = window.sturdyVolleyRiver!;
      r.setMove(0, -1); r.setThrottle(1); r.tick(140); // ride toward the coast
      r.setMove(0, 0); r.setThrottle(0); r.tick(12); // halt
      r.pressAction(); // dismount
      r.tick(20);
    });
    const s = await page.evaluate(() => window.sturdyVolleyRiver!.state());
    expect(s.phase).toBe('free');
    expect(s.ridden).toBe(false);
    expect(s.cameraContext).toBe('exterior');
    expect(s.player.grounded).toBe(true);
    expect(s.riderGap, 'dismounted beside the horse').toBeGreaterThan(0.5);
  });

  test('the coastal gate transitions to Ballast Bay Town preserving clock + NPC', async ({ page }) => {
    await bootRiver(page);
    const began = await page.evaluate(() => {
      const r = window.sturdyVolleyRiver!;
      r.setPlayer(64, 12); // the Ballast Bay gate
      const atGate = r.atGate('ballast-bay-gate');
      const ok = r.pressAction();
      return { atGate, ok };
    });
    expect(began.atGate).toBe(true);
    expect(began.ok).toBe(true);
    await page.waitForFunction(() => Boolean(window.sturdyVolleyTown?.region));
    const town = await page.evaluate(() => ({ region: window.sturdyVolleyTown!.region(), clock: window.sturdyVolleyTown!.clockMinutes(), npc: window.sturdyVolleyTown!.npcToken() }));
    expect(town.region).toBe('ballast-bay-town');
    expect(town.clock).toBe(9 * 60);
    expect(town.npc).toBe('npc-state-v1');
  });

  test('the corridor is reachable from Breakpoint Farm via the river gate', async ({ page }) => {
    await page.goto('/?scene=BreakpointFarm');
    await expect(page.locator('#game-canvas')).toBeVisible();
    await page.waitForFunction(() => Boolean(window.sturdyVolleyFarm?.region));
    const began = await page.evaluate(() => {
      window.sturdyVolleyFarm!.setPlayer(64, 6); // beside the farm-gate-river anchor (64,4)
      return window.sturdyVolleyFarm!.pressAction();
    });
    expect(began).toBe(true);
    await page.waitForFunction(() => Boolean(window.sturdyVolleyRiver?.region));
    const river = await page.evaluate(() => ({ region: window.sturdyVolleyRiver!.region(), clock: window.sturdyVolleyRiver!.clockMinutes(), player: window.sturdyVolleyRiver!.state().player }));
    expect(river.region).toBe('klam-ity-river');
    expect(river.clock).toBe(9 * 60);
    expect(river.player.z, 'arrived at the corridor farm anchor').toBeCloseTo(90, 0);
  });
});
