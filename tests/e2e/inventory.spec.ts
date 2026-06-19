import { test, expect } from '@playwright/test';
// Reuses the Window.sturdyVolleyDebug type declared in farm.spec.ts.

async function newGame(page: import('@playwright/test').Page, name = 'Crate'): Promise<void> {
  await page.goto('/');
  await page.getByTestId('title-start').click();
  await page.getByTestId('field-name').fill(name);
  await page.getByTestId('form-submit').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.openInventory));
}

test.describe('Inventory + shipping bin', () => {
  test('hotbar renders the starter Bell Pea Seeds in slot 1', async ({ page }) => {
    await newGame(page);
    const slot0 = await page.evaluate(() => window.sturdyVolleyDebug!.hotbarSlots()[0]);
    expect(slot0).toEqual({ itemId: 'bell-pea-seeds', qty: 5, quality: 0 });
    await expect(page.getByTestId('hotbar-slot-0')).toContainText('Bell Pea Seeds');
    await expect(page.getByTestId('hotbar-slot-0')).toContainText('×5');
  });

  test('I opens the inventory panel; Close returns to play', async ({ page }) => {
    await newGame(page);
    await page.keyboard.down('i');
    await page.waitForTimeout(150);
    await page.keyboard.up('i');
    await expect(page.getByTestId('inventory-panel')).toBeVisible();
    await expect(page.getByTestId('inventory-player')).toBeVisible();
    await page.getByTestId('inventory-close').click();
    await expect(page.getByTestId('inventory-panel')).not.toBeVisible();
  });

  test('shipping bin sells overnight; day summary names the shipment', async ({ page }) => {
    await newGame(page);
    // Place the starter Bell Pea Seeds in the shipping bin via the debug shortcut.
    await page.evaluate(() => window.sturdyVolleyDebug!.shipPrototypeSeeds());
    const bin0 = await page.evaluate(() => window.sturdyVolleyDebug!.shippingBinSlots()[0]);
    expect(bin0).toEqual({ itemId: 'bell-pea-seeds', qty: 5, quality: 0 });

    await page.getByTestId('hud-menu').click();
    await page.getByTestId('pause-sleep').click();
    await expect(page.getByTestId('day-summary')).toBeVisible();
    // 5 seeds × 8 g each = 40 g.
    await expect(page.getByTestId('day-summary-notices')).toContainText("shipment earned 40 g");

    await page.getByTestId('day-summary-continue').click();
    // Bin is empty after the roll.
    const after = await page.evaluate(() =>
      window.sturdyVolleyDebug!.shippingBinSlots().every((s) => s === null),
    );
    expect(after).toBe(true);
  });
});
