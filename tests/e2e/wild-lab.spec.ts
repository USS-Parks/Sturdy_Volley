import { test, expect } from '@playwright/test';

interface FaunaState {
  id: string;
  family: string;
  behavior: string;
  tier: 'active' | 'abstract';
  skinned: boolean;
  pos: { x: number; z: number };
  enteredForbiddenWater: boolean;
}

declare global {
  interface Window {
    sturdyVolleyWild?: {
      meshCount: () => number;
      population: () => number;
      fauna: () => FaunaState[];
      activeCount: () => number;
      activeSkinnedCount: () => number;
      maxActiveSkinned: () => number;
      setPlayer: (x: number, z: number) => void;
      tick: (n?: number) => void;
      groupGap: (prefix: string) => number;
      groupMinDist: (prefix: string) => number;
      groupSpread: (prefix: string) => number;
      fishAllInWater: () => boolean;
      caveAllInCave: () => boolean;
      birdsOverShore: () => boolean;
    };
  }
}

const boot = async (page: import('@playwright/test').Page) => {
  await page.goto('/?scene=WildLab');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyWild?.fauna));
};

test.describe('Wild-fauna proving ground (WEF-08b)', () => {
  test('boots with the four wild families', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await boot(page);
    const fauna = await page.evaluate(() => window.sturdyVolleyWild!.fauna());
    const families = new Set(fauna.map((f) => f.family));
    expect(families).toEqual(new Set(['bird', 'shoreline-crawler', 'swimming-fauna', 'cave-creature']));
    expect(fauna.length).toBeGreaterThanOrEqual(20);

    await page.waitForTimeout(300);
    const shot = await page.screenshot();
    await testInfo.attach(`wild-lab-${testInfo.project.name}`, { body: shot, contentType: 'image/png' });
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('flocking fauna cohere (birds + fish stay grouped, not dispersing)', async ({ page }) => {
    await boot(page);
    // Player far away so flee never fires; pure flocking.
    await page.evaluate(() => {
      window.sturdyVolleyWild!.setPlayer(60, 60);
      window.sturdyVolleyWild!.tick(400);
    });
    const birdSpread = await page.evaluate(() => window.sturdyVolleyWild!.groupSpread('bird'));
    const fishSpread = await page.evaluate(() => window.sturdyVolleyWild!.groupSpread('fish'));
    // They stay a school, not scattered across the whole 40 m domain.
    expect(birdSpread, 'birds stay flocked').toBeLessThan(20);
    expect(fishSpread, 'fish stay schooled').toBeLessThan(20);
  });

  test('fauna flee from an approaching player', async ({ page }) => {
    await boot(page);
    // Drop the player into the crab forage line; they should scatter away.
    await page.evaluate(() => {
      window.sturdyVolleyWild!.setPlayer(0, 4);
      window.sturdyVolleyWild!.tick(2);
    });
    // The nearest crab to the player flees outward (the group scatters around them).
    const before = await page.evaluate(() => window.sturdyVolleyWild!.groupMinDist('crab'));
    await page.evaluate(() => window.sturdyVolleyWild!.tick(120));
    const after = await page.evaluate(() => window.sturdyVolleyWild!.groupMinDist('crab'));
    expect(after, `crabs fled (nearest ${before.toFixed(1)} → ${after.toFixed(1)})`).toBeGreaterThan(before + 0.5);
  });

  test('families respect water eligibility, cliffs, and their domains', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      window.sturdyVolleyWild!.setPlayer(0, 8); // mild pressure on the shore
      window.sturdyVolleyWild!.tick(900);
    });
    expect(await page.evaluate(() => window.sturdyVolleyWild!.fishAllInWater()), 'fish stay in the sea').toBe(true);
    expect(await page.evaluate(() => window.sturdyVolleyWild!.caveAllInCave()), 'cave creatures stay in the cave').toBe(true);
    expect(await page.evaluate(() => window.sturdyVolleyWild!.birdsOverShore()), 'birds stay over the shore (not the open sea)').toBe(true);
    // No non-water family ever ends up in the sea.
    const fauna = await page.evaluate(() => window.sturdyVolleyWild!.fauna());
    expect(fauna.some((f) => f.enteredForbiddenWater)).toBe(false);
  });

  test('distant fauna downgrade tiers and the active-skinned-body ceiling holds', async ({ page }) => {
    await boot(page);
    const pop = await page.evaluate(() => window.sturdyVolleyWild!.population());
    expect(pop).toBeGreaterThanOrEqual(20);
    await page.evaluate(() => {
      window.sturdyVolleyWild!.setPlayer(0, 8);
      window.sturdyVolleyWild!.tick(60);
    });
    const skinned = await page.evaluate(() => window.sturdyVolleyWild!.activeSkinnedCount());
    const cap = await page.evaluate(() => window.sturdyVolleyWild!.maxActiveSkinned());
    expect(skinned, 'active skinned bodies capped').toBeLessThanOrEqual(cap);
    // Some fauna are abstracted (tier downgrade is real, not all active).
    const fauna = await page.evaluate(() => window.sturdyVolleyWild!.fauna());
    expect(fauna.some((f) => f.tier === 'abstract'), 'distant fauna downgraded').toBe(true);
    expect(fauna.filter((f) => f.skinned).length).toBe(skinned);
  });
});
