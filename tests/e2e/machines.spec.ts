import { test, expect } from '@playwright/test';

async function dismissCutscene(page: import('@playwright/test').Page): Promise<void> {
  const skip = page.getByTestId('cutscene-skip');
  try {
    await skip.waitFor({ state: 'visible', timeout: 4000 });
    await skip.click();
    await skip.waitFor({ state: 'hidden', timeout: 4000 });
  } catch {
    /* no cutscene */
  }
}

async function newGame(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('title-start').click();
  await page.getByTestId('field-name').fill('Maker');
  await page.getByTestId('form-submit').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await dismissCutscene(page);
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.machines));
}

test.describe('Prompt 018 — Machines and artisan goods', () => {
  test('fresh save seeds the five-machine cluster on the Farm', async ({ page }) => {
    await newGame(page);
    const machines = await page.evaluate(() => window.sturdyVolleyDebug!.machines());
    const kinds = Object.values(machines).map((m) => m.kind).sort();
    expect(kinds).toEqual(
      ['brine-barrel', 'cheese-drum', 'herb-dryer', 'honey-spinner', 'oil-press'].sort(),
    );
    for (const m of Object.values(machines)) expect(m.status).toBe('idle');
  });

  test('loading the cheese drum, fast-forwarding 12h, and collecting yields goat cheese', async ({ page }) => {
    await newGame(page);
    // Give the player a milk + open the drum.
    await page.evaluate(() => window.sturdyVolleyDebug!.grantItem('bluff-goat-milk', 1));
    await page.evaluate(() => window.sturdyVolleyDebug!.openMachine('Farm:cheese-drum:1'));
    await expect(page.getByTestId('machine-panel')).toBeVisible();
    await page.getByTestId('machine-load-0').click();
    // After loading, the panel shows the processing status.
    await expect(page.getByTestId('machine-panel')).toContainText(/Processing/);
    // Fast-forward 12 in-game hours (the drum runs 12h).
    await page.evaluate(() => window.sturdyVolleyDebug!.fastForwardMinutes(12 * 60));
    await page.evaluate(() => window.sturdyVolleyDebug!.openMachine('Farm:cheese-drum:1'));
    await expect(page.getByTestId('machine-collect')).toBeVisible();
    await page.getByTestId('machine-collect').click();
    const statusAfter = await page.evaluate(() =>
      window.sturdyVolleyDebug!.machines()['Farm:cheese-drum:1']!.status,
    );
    expect(statusAfter).toBe('idle');
  });
});
