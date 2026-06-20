import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    sturdyVolleyLab?: {
      kit: () => string[];
      meshCount: () => number;
      focus: (id: string) => boolean;
    };
  }
}

/** Every station the proving-ground kit must stand up (master Prompt 028). */
const EXPECTED_KIT = [
  'open-ground',
  'farm-grid',
  'narrow-lane',
  'small-room',
  'large-room',
  'roof',
  'tree-canopy',
  'wall-corner',
  'slope',
  'stairs',
  'cliff',
  'shallow-water',
  'doorway',
  'npc-capsule',
  'animal-body',
  'interaction-prop',
  'cave-corridor',
];

test.describe('Camera Lab proving ground (WEF-01a)', () => {
  test('boots via ?scene=CameraLab and renders the full geometry kit', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    // Direct-boot route — works in the production preview build (no dev menu).
    await page.goto('/?scene=CameraLab');
    await expect(page.locator('#game-canvas')).toBeVisible();
    await page.waitForFunction(() => Boolean(window.sturdyVolleyLab?.kit));

    // The kit stands up every required station.
    const kit = await page.evaluate(() => window.sturdyVolleyLab!.kit());
    expect(kit.sort(), 'camera-lab kit stations').toEqual([...EXPECTED_KIT].sort());

    const meshCount = await page.evaluate(() => window.sturdyVolleyLab!.meshCount());
    expect(meshCount, 'kit builds many primitive meshes at scale').toBeGreaterThan(40);

    // Canvas-pixel check: the proving ground actually rendered (not blank).
    await page.waitForTimeout(500);
    const stats = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
      if (!canvas) return { distinct: 0, nonBlackRatio: 0 };
      const off = document.createElement('canvas');
      off.width = 48;
      off.height = 48;
      const ctx = off.getContext('2d');
      if (!ctx) return { distinct: 0, nonBlackRatio: 0 };
      ctx.drawImage(canvas, 0, 0, 48, 48);
      const data = ctx.getImageData(0, 0, 48, 48).data;
      const colors = new Set<string>();
      let nonBlack = 0;
      for (let i = 0; i < data.length; i += 4) {
        colors.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`);
        if (data[i] + data[i + 1] + data[i + 2] > 40) nonBlack += 1;
      }
      return { distinct: colors.size, nonBlackRatio: nonBlack / (48 * 48) };
    });
    expect(stats.distinct, 'distinct colors in proving-ground canvas').toBeGreaterThan(4);
    expect(stats.nonBlackRatio, 'non-black pixel ratio').toBeGreaterThan(0.25);

    // Reproducible screenshot route: one labelled capture per Playwright project
    // (desktop-chromium + mobile-chromium / Pixel 5), attached to the report.
    const shot = await page.screenshot();
    await testInfo.attach(`camera-lab-${testInfo.project.name}`, { body: shot, contentType: 'image/png' });

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('focus() reframes the camera onto a named station', async ({ page }) => {
    await page.goto('/?scene=CameraLab');
    await page.waitForFunction(() => Boolean(window.sturdyVolleyLab?.focus));
    const ok = await page.evaluate(() => window.sturdyVolleyLab!.focus('farm-grid'));
    expect(ok, 'focus a known station').toBe(true);
    const miss = await page.evaluate(() => window.sturdyVolleyLab!.focus('nope'));
    expect(miss, 'focus an unknown station fails cleanly').toBe(false);
  });
});
