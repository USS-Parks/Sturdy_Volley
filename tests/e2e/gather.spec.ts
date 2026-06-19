import { test, expect } from '@playwright/test';
// Reuses the Window.sturdyVolleyDebug type declared in farm.spec.ts.

async function newGame(page: import('@playwright/test').Page, name = 'Forager'): Promise<void> {
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
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.worldEntities));
}

async function pressInteract(page: import('@playwright/test').Page): Promise<void> {
  await page.keyboard.down('e');
  await page.waitForTimeout(180);
  await page.keyboard.up('e');
}

test.describe('VS-A2 — gather: visible forage + chop on the Farm', () => {
  test('a fresh save shows at least 4 forage / debris / tree entities on the Farm', async ({ page }) => {
    await newGame(page);
    const entities = await page.evaluate(() => window.sturdyVolleyDebug!.worldEntities());
    const farmKeys = Object.keys(entities).filter((k) => k.startsWith('Farm:'));
    expect(farmKeys.length, `found ${farmKeys.length} Farm entities`).toBeGreaterThanOrEqual(4);
    // At least one is forage and at least one is a tree.
    const kinds = farmKeys.map((k) => entities[k]?.kind ?? '');
    expect(kinds, kinds.join(', ')).toContain('forage');
    expect(kinds, kinds.join(', ')).toContain('tree');
  });

  test('walking onto a tide-shell forage and pressing E moves it into the hotbar', async ({ page }) => {
    await newGame(page);
    const warped = await page.evaluate(() =>
      window.sturdyVolleyDebug!.warpToEntity('forage-shell-a'),
    );
    expect(warped).toBe(true);
    // Give the controller a frame to settle, then interact.
    await page.waitForTimeout(150);
    await pressInteract(page);
    await page.waitForTimeout(200);

    const stillThere = await page.evaluate(
      () => window.sturdyVolleyDebug!.worldEntities()['Farm:forage-shell-a'],
    );
    expect(stillThere, 'shell entity should be consumed').toBeFalsy();

    const hotbar = await page.evaluate(() => window.sturdyVolleyDebug!.hotbarSlots());
    const shellStack = hotbar.find((s) => s?.itemId === 'tide-shell');
    expect(shellStack?.qty, 'tide-shell should land in the hotbar').toBe(1);
  });

  test('a tree resists pickup-tier hardness — sickle (tool slot 5) leaves it standing', async ({ page }) => {
    await newGame(page);
    // Make sure no seed is in the active hotbar slot so the tool gates the action.
    // The starter Bell Pea Seeds are in slot 0; pick a different slot (slot 5 is empty)
    // by pressing "6" so selectedHotbar advances.
    await page.keyboard.press('6');
    // Select the Sickle tool (slot 5 → index 4 in the TOOLS array).
    await page.keyboard.press('5');

    await page.evaluate(() => window.sturdyVolleyDebug!.warpToEntity('tree-a'));
    await page.waitForTimeout(150);
    await pressInteract(page);
    await page.waitForTimeout(200);

    const tree = await page.evaluate(
      () => window.sturdyVolleyDebug!.worldEntities()['Farm:tree-a'],
    );
    expect(tree?.kind, 'tree should still be standing after sickle hit').toBe('tree');
  });
});
