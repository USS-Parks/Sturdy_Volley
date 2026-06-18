import { test, expect } from '@playwright/test';

// Runs on both the desktop-chromium and mobile-chromium projects.
test.describe('Title screen', () => {
  test('loads cleanly and shows the main menu', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Sturdy Volley' })).toBeVisible();
    await expect(page.getByTestId('title-start')).toBeEnabled();
    await expect(page.getByTestId('title-continue')).toBeDisabled();
    await expect(page.getByTestId('title-settings')).toBeVisible();
    await expect(page.getByTestId('title-credits')).toBeVisible();

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Credits opens a panel and Back returns to the menu', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('title-credits').click();
    await expect(page.getByRole('heading', { name: 'Credits' })).toBeVisible();
    await page.getByTestId('panel-back').click();
    await expect(page.getByTestId('title-start')).toBeVisible();
  });

  test('canvas mounts inside #game-root', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#game-root canvas')).toBeVisible();
  });
});
