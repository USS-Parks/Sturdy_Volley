import { test, expect } from '@playwright/test';
// Reuses the Window.sturdyVolleyDebug type declared in farm.spec.ts.

async function newGame(page: import('@playwright/test').Page, name = 'Sleeper'): Promise<void> {
  await page.goto('/');
  await page.getByTestId('title-start').click();
  await page.getByTestId('field-name').fill(name);
  await page.getByTestId('form-submit').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.time));
}

test.describe('RF-14 — First-morning cutscene', () => {
  test('plays on a fresh save; Skip applies the side-effects', async ({ page }) => {
    await newGame(page);
    // The cutscene mounts a fade + skip button on first enter of Day 1.
    await expect(page.getByTestId('cutscene-skip')).toBeVisible();
    await expect(page.getByTestId('cutscene-fade')).toBeVisible();

    // Hit Skip — should apply giveItem + setFlag side-effects before dismissing.
    await page.getByTestId('cutscene-skip').click();
    await expect(page.getByTestId('cutscene-skip')).not.toBeVisible({ timeout: 4000 });

    // Save reflects flag set + the bonus seeds delivered on top of the starter 5.
    const after = await page.evaluate(() => {
      const raw = localStorage.getItem('sturdy-volley:save:v1');
      return raw ? JSON.parse(raw) : null;
    });
    expect(after?.flags?.['first-morning-seen']).toBe(true);
    // Starter inventory seeded 5 Bell Pea Seeds at slot 0. The cutscene grants
    // another 5, which stack onto the same slot up to MAX_STACK = 99.
    const slot0 = after?.inventory?.slots?.[0];
    expect(slot0?.itemId).toBe('bell-pea-seeds');
    expect(slot0?.qty).toBe(10);
  });

  test('does not replay after Continue once the flag is set', async ({ page }) => {
    await newGame(page);
    await page.getByTestId('cutscene-skip').click();
    await expect(page.getByTestId('cutscene-skip')).not.toBeVisible({ timeout: 4000 });

    await page.reload();
    await page.getByTestId('title-continue').click();
    await expect(page.locator('#game-canvas')).toBeVisible();
    await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.time));
    // The cutscene's Skip button should NOT mount this time.
    await expect(page.getByTestId('cutscene-skip')).not.toBeVisible();
  });
});
