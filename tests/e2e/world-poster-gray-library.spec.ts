import { expect, test } from '@playwright/test';

interface GrayLibrarySnapshot {
  count: number;
  meshCount: number;
  zones: string[];
  models: Array<{ id: string; family: string; dimensions: number[]; sourceRefs: string[]; policy: string; zone: string; meshCount: number }>;
}

declare global {
  interface Window {
    sturdyVolleyGrayLibrary?: { snapshot: () => GrayLibrarySnapshot };
  }
}

test.describe('GML-02 — World Poster Gray Library', () => {
  test('renders every first-gallery zone with traceable model telemetry', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/?scene=WorldPosterGrayLibrary');
    await expect(page.locator('#game-canvas')).toBeVisible();
    await page.waitForFunction(() => Boolean(window.sturdyVolleyGrayLibrary));
    const snapshot = await page.evaluate(() => window.sturdyVolleyGrayLibrary!.snapshot());

    expect(snapshot.count).toBeGreaterThanOrEqual(8);
    expect(snapshot.meshCount).toBeGreaterThan(35);
    expect(snapshot.zones.sort()).toEqual(['character-animal', 'coast', 'farm', 'prop', 'village', 'wilds']);
    expect(new Set(snapshot.models.map((model) => model.id)).size).toBe(snapshot.models.length);
    for (const model of snapshot.models) {
      expect(model.dimensions.every((value) => value > 0), model.id).toBe(true);
      expect(model.sourceRefs.length, model.id).toBeGreaterThan(0);
      expect(model.meshCount, model.id).toBeGreaterThan(0);
    }

    await page.waitForTimeout(400);
    const stats = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
      if (!canvas) return { distinct: 0, nonBlackRatio: 0 };
      const offscreen = document.createElement('canvas');
      offscreen.width = 48;
      offscreen.height = 48;
      const context = offscreen.getContext('2d');
      if (!context) return { distinct: 0, nonBlackRatio: 0 };
      context.drawImage(canvas, 0, 0, 48, 48);
      const data = context.getImageData(0, 0, 48, 48).data;
      const colors = new Set<string>();
      let nonBlack = 0;
      for (let index = 0; index < data.length; index += 4) {
        colors.add(`${data[index] >> 4},${data[index + 1] >> 4},${data[index + 2] >> 4}`);
        if (data[index] + data[index + 1] + data[index + 2] > 40) nonBlack += 1;
      }
      return { distinct: colors.size, nonBlackRatio: nonBlack / (48 * 48) };
    });
    expect(stats.distinct).toBeGreaterThan(4);
    expect(stats.nonBlackRatio).toBeGreaterThan(0.25);

    const screenshot = await page.screenshot();
    await testInfo.attach(`world-poster-gray-library-${testInfo.project.name}`, { body: screenshot, contentType: 'image/png' });
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });
});
