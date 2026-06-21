import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    sturdyVolleyFlora?: {
      meshCount: () => number;
      families: () => string[];
      instanceCount: () => number;
      windNow: () => number;
      tierCounts: () => { full: number; reduced: number; billboard: number };
      activeDeforming: () => number;
      activeCap: () => number;
      anglesFor: (familyId: string) => number[];
      maxAbsAngleAmbient: () => number;
      nearestInteractiveBend: () => number;
      cropGrowthSum: () => number;
      setPlayer: (x: number, z: number) => void;
      setReducedMotion: (on: boolean) => void;
      tick: (n?: number) => void;
    };
  }
}

const boot = async (page: import('@playwright/test').Page) => {
  await page.goto('/?scene=FloraLab');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyFlora?.families));
};

test.describe('Flora & environment motion proving ground (WEF-09)', () => {
  test('boots with the nine motion families and a populated field', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await boot(page);
    const fams = await page.evaluate(() => window.sturdyVolleyFlora!.families());
    expect(fams.length).toBe(9);
    const n = await page.evaluate(() => window.sturdyVolleyFlora!.instanceCount());
    expect(n).toBeGreaterThan(150);

    await page.waitForTimeout(300);
    const shot = await page.screenshot();
    await testInfo.attach(`flora-lab-${testInfo.project.name}`, { body: shot, contentType: 'image/png' });
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('wind drives a coherent, gusting sway with no lockstep across repeats', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.sturdyVolleyFlora!.tick(40));
    const ambient = await page.evaluate(() => window.sturdyVolleyFlora!.maxAbsAngleAmbient());
    expect(ambient, 'flora is actually swaying').toBeGreaterThan(0.05);
    // A field of one family spans a range of bends (per-instance phase, not lockstep).
    const angles = await page.evaluate(() => window.sturdyVolleyFlora!.anglesFor('grass'));
    const spread = Math.max(...angles) - Math.min(...angles);
    expect(spread, 'grass instances are out of lockstep').toBeGreaterThan(0.05);
  });

  test('distance tiers downgrade and the active-deformation ceiling holds', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.sturdyVolleyFlora!.tick(2));
    const counts = await page.evaluate(() => window.sturdyVolleyFlora!.tierCounts());
    const active = await page.evaluate(() => window.sturdyVolleyFlora!.activeDeforming());
    const cap = await page.evaluate(() => window.sturdyVolleyFlora!.activeCap());
    expect(active, 'never exceeds the active-deformation ceiling').toBeLessThanOrEqual(cap);
    expect(counts.billboard, 'distant flora downgrades to billboards').toBeGreaterThan(0);
  });

  test('reduced motion stills the ambient sway but preserves the interaction cue', async ({ page }) => {
    await boot(page);
    const full = await page.evaluate(() => {
      const f = window.sturdyVolleyFlora!;
      f.setPlayer(0, -4);
      f.setReducedMotion(false);
      f.tick(40);
      return f.maxAbsAngleAmbient();
    });
    const reduced = await page.evaluate(() => {
      const f = window.sturdyVolleyFlora!;
      f.setReducedMotion(true);
      f.tick(40);
      return f.maxAbsAngleAmbient();
    });
    expect(reduced).toBeLessThan(full);
    expect(reduced, 'reduced motion is near-still ambient').toBeLessThan(0.06);

    // The interaction bend (a gameplay cue) survives reduced motion.
    const bend = await page.evaluate(() => {
      const f = window.sturdyVolleyFlora!;
      f.setPlayer(0, 3.4); // into the grass field
      f.tick(2);
      return f.nearestInteractiveBend();
    });
    expect(bend, 'pushing through flora still bends it under reduced motion').toBeGreaterThan(0.1);
  });

  test('the motion layer never alters deterministic crop state', async ({ page }) => {
    await boot(page);
    const before = await page.evaluate(() => window.sturdyVolleyFlora!.cropGrowthSum());
    await page.evaluate(() => {
      const f = window.sturdyVolleyFlora!;
      f.setPlayer(10, 1); // stand in the crop row
      f.tick(300);
    });
    const after = await page.evaluate(() => window.sturdyVolleyFlora!.cropGrowthSum());
    expect(after, 'sway/interaction never writes crop growth').toBe(before);
  });
});
