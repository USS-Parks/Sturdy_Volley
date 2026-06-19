import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    sturdyVolleyDebug?: { player: () => { x: number; y: number } };
  }
}

test.describe('Breakpoint Farm', () => {
  test('player walks right when the arrow key is held', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('title-start').click();
    await page.getByTestId('field-name').fill('Wren');
    await page.getByTestId('form-submit').click();

    await expect(page.locator('#game-root canvas')).toBeVisible();
    await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug));

    const before = await page.evaluate(() => window.sturdyVolleyDebug!.player());

    // Focus the page, then hold ArrowRight.
    await page.locator('#game-root canvas').click();
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowRight');

    const after = await page.evaluate(() => window.sturdyVolleyDebug!.player());
    expect(after.x).toBeGreaterThan(before.x + 20);
  });
});
