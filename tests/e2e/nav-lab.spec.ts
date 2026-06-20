import { test, expect } from '@playwright/test';

interface NpcState {
  id: string;
  area: string | null;
  currentKind: string | null;
  traversed: string[];
  visited: string[];
  arrivals: number;
  pathLen: number;
  tier: 'active' | 'abstract';
  recoveryReason: string;
  lastRecovery: string;
  waiting: boolean;
  pos: { x: number; z: number };
  desiredSpeed: number;
  avoidSpeed: number;
}

declare global {
  interface Window {
    sturdyVolleyNav?: {
      meshCount: () => number;
      population: () => number;
      navPatches: () => string[];
      navLinks: () => Array<{ id: string; kind: string }>;
      npcs: () => NpcState[];
      activeCount: () => number;
      minActiveSeparation: () => number;
      minPlayerDistance: () => number;
      player: () => { x: number; z: number };
      setPlayer: (x: number, z: number) => void;
      displace: (npcId: string, x: number, z: number) => boolean;
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
    const ids = npcs.map((n) => n.id);
    // The four named NPCs plus a town crowd.
    for (const named of ['bree', 'cas', 'mara', 'wren']) expect(ids).toContain(named);
    expect(npcs.length).toBeGreaterThanOrEqual(18);

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

    // Exterior + interior are both visited; the named (always-active) NPCs each
    // re-routed (a schedule transition that re-paths through the service).
    const allVisited = new Set(npcs.flatMap((n) => n.visited));
    expect(allVisited.has('exterior')).toBe(true);
    expect(allVisited.has('interior')).toBe(true);
    for (const id of ['mara', 'wren', 'bree', 'cas']) {
      const n = npcs.find((x) => x.id === id)!;
      expect(n.arrivals, `${id} re-routed`).toBeGreaterThan(0);
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

  // --- WEF-07b: avoidance, throttle, recovery, offscreen sim -----------------

  test('a town population stays within the active-agent throttle (mobile budget)', async ({ page }) => {
    await boot(page);
    const pop = await page.evaluate(() => window.sturdyVolleyNav!.population());
    expect(pop, 'representative town population').toBeGreaterThanOrEqual(18);
    await page.evaluate(() => window.sturdyVolleyNav!.tick(120));
    const active = await page.evaluate(() => window.sturdyVolleyNav!.activeCount());
    expect(active, 'active agents capped by the throttle').toBeLessThanOrEqual(12);
    // Some NPCs are abstracted (no physics body) — the throttle actually engaged.
    expect(active).toBeLessThan(pop);
  });

  test('NPCs avoid each other and the player without overlapping (no deadlock)', async ({ page }) => {
    await boot(page);
    // Drop the player into the crowd so NPCs must steer around them.
    await page.evaluate(() => window.sturdyVolleyNav!.setPlayer(-4, 0));
    await page.evaluate(() => window.sturdyVolleyNav!.tick(300));
    const sep = await page.evaluate(() => window.sturdyVolleyNav!.minActiveSeparation());
    expect(sep, 'active NPCs never stack on each other').toBeGreaterThan(0.3);
    const playerDist = await page.evaluate(() => window.sturdyVolleyNav!.minPlayerDistance());
    expect(playerDist, 'NPCs yield to the player, never overlapping them').toBeGreaterThan(0.3);
    // The crowd is still moving (not deadlocked): at least one NPC has nonzero speed.
    const npcs = await page.evaluate(() => window.sturdyVolleyNav!.npcs());
    expect(npcs.some((n) => n.tier === 'active' && n.avoidSpeed > 0.1), 'crowd keeps moving').toBe(true);
  });

  test('offscreen NPCs abstract to a semantic anchor (no physics body) and rejoin', async ({ page }) => {
    await boot(page);
    // Park the player far from the yard → distant NPCs go abstract.
    await page.evaluate(() => window.sturdyVolleyNav!.setPlayer(-19, -19));
    await page.evaluate(() => window.sturdyVolleyNav!.tick(60));
    let npcs = await page.evaluate(() => window.sturdyVolleyNav!.npcs());
    const abstracted = npcs.filter((n) => n.tier === 'abstract');
    expect(abstracted.length, 'some NPCs abstracted offscreen').toBeGreaterThan(0);
    // An abstract NPC holds its scheduled anchor with zero desired speed.
    expect(abstracted.every((n) => n.desiredSpeed === 0)).toBe(true);

    // Bring the player back → they rejoin active simulation with a valid path.
    await page.evaluate(() => window.sturdyVolleyNav!.setPlayer(-4, 0));
    await page.evaluate(() => window.sturdyVolleyNav!.tick(30));
    npcs = await page.evaluate(() => window.sturdyVolleyNav!.npcs());
    expect(npcs.filter((n) => n.tier === 'active').length, 'NPCs rejoined').toBeGreaterThan(abstracted.length === 0 ? 99 : 0);
  });

  test('an off-mesh NPC recovers onto the navmesh', async ({ page }) => {
    await boot(page);
    // cas is a pinned (always-active) named NPC, so recovery runs regardless.
    await page.evaluate(() => window.sturdyVolleyNav!.displace('cas', 30, -5)); // off every patch
    await page.evaluate(() => window.sturdyVolleyNav!.tick(2));
    const cas = (await page.evaluate(() => window.sturdyVolleyNav!.npcs())).find((n) => n.id === 'cas')!;
    // The latched reason is race-free (the render loop may step between calls).
    expect(cas.lastRecovery, 'off-mesh recovery recorded').toBe('off-mesh');
    expect(cas.area, 'recovered back onto a patch').not.toBeNull();
  });
});
