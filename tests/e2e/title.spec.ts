import { test, expect } from '@playwright/test';

test.describe('Title screen', () => {
  test('loads cleanly with the menu and a rendered 3D diorama', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Sturdy Volley' })).toBeVisible();
    await expect(page.getByTestId('title-start')).toBeEnabled();
    await expect(page.getByTestId('title-continue')).toBeDisabled();
    await expect(page.getByTestId('title-settings')).toBeVisible();
    await expect(page.getByTestId('title-credits')).toBeVisible();
    await expect(page.locator('#game-canvas')).toBeVisible();

    // Canvas-pixel check: the 3D title scene is rendered (not blank / not uniform).
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
    expect(stats.distinct, 'distinct colors in title canvas').toBeGreaterThan(4);
    expect(stats.nonBlackRatio, 'non-black pixel ratio').toBeGreaterThan(0.25);

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Credits opens a panel and Back returns to the menu', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('title-credits').click();
    await expect(page.getByRole('heading', { name: 'Credits' })).toBeVisible();
    await page.getByTestId('panel-back').click();
    await expect(page.getByTestId('title-start')).toBeVisible();
  });
});
