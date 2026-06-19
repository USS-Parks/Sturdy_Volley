import { test, expect } from '@playwright/test';
// Reuses the Window.sturdyVolleyDebug type declared in farm.spec.ts.

async function newGame(page: import('@playwright/test').Page, name = 'Crate'): Promise<void> {
  await page.goto('/');
  await page.getByTestId('title-start').click();
  await page.getByTestId('field-name').fill(name);
  await page.getByTestId('form-submit').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  const skip = page.getByTestId('cutscene-skip');
  try {
    await skip.waitFor({ state: 'visible', timeout: 4000 });
    await skip.click();
    await skip.waitFor({ state: 'hidden', timeout: 4000 });
  } catch { /* cutscene already gone */ }
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.openInventory));
}

test.describe('Inventory + shipping bin', () => {
  test('hotbar renders the starter Bell Pea Seeds in slot 1', async ({ page }) => {
    await newGame(page);
    // RF-14: the first-morning cutscene grants 5 more Bell Pea Seeds, so the
    // post-skip total in hotbar slot 0 is 10.
    const slot0 = await page.evaluate(() => window.sturdyVolleyDebug!.hotbarSlots()[0]);
    expect(slot0).toEqual({ itemId: 'bell-pea-seeds', qty: 10, quality: 0 });
    await expect(page.getByTestId('hotbar-slot-0')).toContainText('Bell Pea Seeds');
    await expect(page.getByTestId('hotbar-slot-0')).toContainText('×10');
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
    // RF-14 grants 5 more seeds in the cutscene → 10 total in slot 0 → bin gets 10.
    await page.evaluate(() => window.sturdyVolleyDebug!.shipPrototypeSeeds());
    const bin0 = await page.evaluate(() => window.sturdyVolleyDebug!.shippingBinSlots()[0]);
    expect(bin0).toEqual({ itemId: 'bell-pea-seeds', qty: 10, quality: 0 });

    await page.getByTestId('hud-menu').click();
    await page.getByTestId('pause-sleep').click();
    await expect(page.getByTestId('day-summary')).toBeVisible();
    // 10 seeds × 8 g each = 80 g.
    await expect(page.getByTestId('day-summary-notices')).toContainText("shipment earned 80 g");

    await page.getByTestId('day-summary-continue').click();
    // Bin is empty after the roll.
    const after = await page.evaluate(() =>
      window.sturdyVolleyDebug!.shippingBinSlots().every((s) => s === null),
    );
    expect(after).toBe(true);
  });
});
