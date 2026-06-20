import { test, expect } from '@playwright/test';

interface NpcState {
  id: string;
  area: string | null;
  currentKind: string | null;
  traversed: string[];
  visited: string[];
  arrivals: number;
  pathLen: number;
}

declare global {
  interface Window {
    sturdyVolleyNav?: {
      meshCount: () => number;
      navPatches: () => string[];
      navLinks: () => Array<{ id: string; kind: string }>;
      npcs: () => NpcState[];
      tick: (n?: number) => void;
      talk: (npcId: string) => { available: boolean; facingAligned: boolean };
      traversedKinds: () => string[];
    };
  }
}

const boot = async (page: import('@playwright/test').Page, query = '') => {
  await page.goto(`/?scene=NavLab${query}`);
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyNav?.npcs));
};

test.describe('NPC navigation proving ground (WEF-07a)', () => {
  test('boots via ?scene=NavLab with a baked navmesh + 4 NPCs', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await boot(page);
    const patches = await page.evaluate(() => window.sturdyVolleyNav!.navPatches());
    expect(patches.sort()).toEqual(['house', 'ramp-top', 'upper', 'yard']);
    const links = await page.evaluate(() => window.sturdyVolleyNav!.navLinks());
    expect(links.map((l) => l.kind).sort()).toEqual(['door', 'slope', 'stair']);
    const npcs = await page.evaluate(() => window.sturdyVolleyNav!.npcs());
    expect(npcs.map((n) => n.id).sort()).toEqual(['bree', 'cas', 'mara', 'wren']);

    await page.waitForTimeout(300);
    const shot = await page.screenshot();
    await testInfo.attach(`nav-lab-${testInfo.project.name}`, { body: shot, contentType: 'image/png' });
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('the 4 NPCs traverse exterior / doorway / interior / stair-slope on the shared motor', async ({ page }) => {
    await boot(page);
    // Drive the schedule deterministically through the service.
    await page.evaluate(() => window.sturdyVolleyNav!.tick(2400));
    const npcs = await page.evaluate(() => window.sturdyVolleyNav!.npcs());
    const kinds = await page.evaluate(() => window.sturdyVolleyNav!.traversedKinds());

    // Every off-mesh link kind is exercised across the population.
    expect(kinds.sort(), `traversed kinds: ${kinds.join(',')}`).toEqual(['door', 'slope', 'stair']);

    // Exterior + interior are both visited; every NPC re-routed at least once
    // (a schedule transition that re-paths through the service).
    const allVisited = new Set(npcs.flatMap((n) => n.visited));
    expect(allVisited.has('exterior')).toBe(true);
    expect(allVisited.has('interior')).toBe(true);
    for (const n of npcs) {
      expect(n.arrivals, `${n.id} re-routed`).toBeGreaterThan(0);
    }

    // Mara's loop alone covers the doorway + interior + stair cases.
    const mara = npcs.find((n) => n.id === 'mara')!;
    expect(mara.traversed).toContain('door');
    expect(mara.traversed).toContain('stair');
    expect(mara.visited).toContain('interior');
    expect(mara.visited).toContain('exterior');
  });

  test('conversation alignment: an NPC faces the player when talked to', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.sturdyVolleyNav!.tick(60));
    const res = await page.evaluate(() => window.sturdyVolleyNav!.talk('bree'));
    expect(res.available).toBe(true);
    expect(res.facingAligned, 'bree turned to face the player').toBe(true);
  });

  test('the ?debug=nav view renders the navmesh + paths', async ({ page }) => {
    await boot(page, '&debug=nav');
    const withDebug = await page.evaluate(() => window.sturdyVolleyNav!.meshCount());
    await page.evaluate(() => window.sturdyVolleyNav!.tick(30));
    const afterTick = await page.evaluate(() => window.sturdyVolleyNav!.meshCount());
    // Debug adds the 4 patch quads + 3 link markers; path dots appear on tick.
    expect(withDebug).toBeGreaterThan(20);
    expect(afterTick).toBeGreaterThanOrEqual(withDebug);
  });
});
