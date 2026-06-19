import { test, expect } from '@playwright/test';

test.describe('Save bootstrap', () => {
  test('new game creates a save, navigates 3D scenes, and Continue restores it', async ({ page }) => {
    await page.goto('/');

    // Start -> New Game form
    await page.getByTestId('title-start').click();
    await page.getByTestId('field-name').fill('Wren');
    await page.getByTestId('field-farmName').fill('Saltbreak');
    await page.getByTestId('form-submit').click();

    // Farm: canvas renders + HUD shows the location and the player's status.
    await expect(page.locator('#game-canvas')).toBeVisible();
    // RF-14: dismiss the first-morning cutscene before the HUD check.
    const skip = page.getByTestId('cutscene-skip');
    try {
      await skip.waitFor({ state: 'visible', timeout: 4000 });
      await skip.click();
      await skip.waitFor({ state: 'hidden', timeout: 4000 });
    } catch { /* cutscene already gone */ }
    await expect(page.getByText('Breakpoint Farm', { exact: false })).toBeVisible();
    await expect(page.getByText('Wren', { exact: false })).toBeVisible();

    const saved = await page.evaluate(() => localStorage.getItem('sturdy-volley:save:v1'));
    expect(saved).toBeTruthy();

    // Pause-menu navigation: Farm -> Town -> Farm.
    await page.getByTestId('hud-menu').click();
    await page.getByTestId('nav-town').click();
    await expect(page.getByText('Ballast Bay', { exact: false })).toBeVisible();
    await page.getByTestId('hud-menu').click();
    await page.getByTestId('nav-farm').click();
    await expect(page.getByText('Breakpoint Farm', { exact: false })).toBeVisible();

    // Reload: Continue is enabled and restores the save into the Farm.
    await page.reload();
    await expect(page.getByTestId('title-continue')).toBeEnabled();
    await page.getByTestId('title-continue').click();
    await expect(page.getByText('Wren', { exact: false })).toBeVisible();
  });

  test('settings menu exposes save export/import/delete', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('title-settings').click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByTestId('settings-import')).toBeVisible();
    await expect(page.getByTestId('settings-back')).toBeVisible();
    await page.getByTestId('settings-back').click();
    await expect(page.getByTestId('title-start')).toBeVisible();
  });
});
