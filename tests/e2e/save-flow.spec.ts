import { test, expect } from '@playwright/test';

test.describe('Save bootstrap', () => {
  test('new game creates a save, navigates, and Continue restores after reload', async ({ page }) => {
    await page.goto('/');

    // Start -> New Game form
    await page.getByTestId('title-start').click();
    await page.getByTestId('field-name').fill('Wren');
    await page.getByTestId('field-farmName').fill('Saltbreak');
    await page.getByTestId('form-submit').click();

    // Lands on the Farm with the player's status line.
    await expect(page.getByRole('heading', { name: 'Breakpoint Farm' })).toBeVisible();
    await expect(page.getByText('Wren', { exact: false })).toBeVisible();

    // A save now exists.
    const saved = await page.evaluate(() => localStorage.getItem('sturdy-volley:save:v1'));
    expect(saved).toBeTruthy();

    // Scene transitions: Farm -> Town -> Farm.
    await page.getByTestId('nav-town').click();
    await expect(page.getByRole('heading', { name: 'Ballast Bay' })).toBeVisible();
    await page.getByTestId('nav-farm').click();
    await expect(page.getByRole('heading', { name: 'Breakpoint Farm' })).toBeVisible();

    // Reload: Continue is enabled and restores the save.
    await page.reload();
    await expect(page.getByTestId('title-continue')).toBeEnabled();
    await page.getByTestId('title-continue').click();
    await expect(page.getByRole('heading', { name: 'Breakpoint Farm' })).toBeVisible();
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
