import { test, expect } from '@playwright/test';
// Shares the augmented Window.sturdyVolleyDebug declared in farm.spec.ts.

async function newGame(page: import('@playwright/test').Page, name = 'Tide'): Promise<void> {
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
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.time));
}

test.describe('Time, calendar, and day resolution', () => {
  test('clock advances during play and pauses with the menu', async ({ page }) => {
    await newGame(page);
    await page.evaluate(() => window.sturdyVolleyDebug!.setTimeScale(20));
    const before = await page.evaluate(() => window.sturdyVolleyDebug!.time().minutes);
    await page.waitForTimeout(700);
    const advanced = await page.evaluate(() => window.sturdyVolleyDebug!.time().minutes);
    expect(advanced, `time should advance (before ${before}, after ${advanced})`).toBeGreaterThan(before);

    await page.getByTestId('hud-menu').click();
    const paused = await page.evaluate(() => window.sturdyVolleyDebug!.time().minutes);
    await page.waitForTimeout(500);
    const stillPaused = await page.evaluate(() => window.sturdyVolleyDebug!.time().minutes);
    expect(stillPaused).toBe(paused);
    await page.getByTestId('pause-resume').click();
  });

  test('sleeping shows the day-summary panel and advances to the next day', async ({ page }) => {
    await newGame(page);
    await page.getByTestId('hud-menu').click();
    await page.getByTestId('pause-sleep').click();
    await expect(page.getByTestId('day-summary')).toBeVisible();
    await page.getByTestId('day-summary-continue').click();
    // Day 1 → Day 2 after the summary continues.
    await expect(page.getByText('Spring 2', { exact: false })).toBeVisible();
  });

  test('collapsing past 2 AM triggers the day-summary with a collapse notice', async ({ page }) => {
    await newGame(page);
    // Crank scale so the day reaches 2 AM within a few real seconds.
    await page.evaluate(() => window.sturdyVolleyDebug!.setTimeScale(120));
    await expect(page.getByTestId('day-summary')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('day-summary-notices')).toContainText('collapsed');
  });
});
