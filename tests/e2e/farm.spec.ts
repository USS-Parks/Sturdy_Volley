import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    sturdyVolleyDebug?: { player: () => { x: number; z: number } };
  }
}

test.describe('Breakpoint Farm (3D)', () => {
  test('player walks on the farm with the keyboard', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('title-start').click();
    await page.getByTestId('field-name').fill('Wren');
    await page.getByTestId('form-submit').click();

    await expect(page.locator('#game-canvas')).toBeVisible();
    await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug));

    const before = await page.evaluate(() => window.sturdyVolleyDebug!.player());
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowUp');
    const after = await page.evaluate(() => window.sturdyVolleyDebug!.player());

    const dist = Math.hypot(after.x - before.x, after.z - before.z);
    expect(dist, `player should move; moved ${dist.toFixed(2)} units`).toBeGreaterThan(0.5);
  });
});
