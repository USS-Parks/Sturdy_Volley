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
  await page.getByTestId('field-name').fill('Shepherd');
  await page.getByTestId('form-submit').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await dismissCutscene(page);
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.animals));
}

test.describe('Prompt 019 — Animal husbandry', () => {
  test('fresh save seeds Pip the hen and Clover the goat', async ({ page }) => {
    await newGame(page);
    const animals = await page.evaluate(() => window.sturdyVolleyDebug!.animals());
    const ids = Object.keys(animals).sort();
    expect(ids).toEqual(['Farm:goat:1', 'Farm:hen:1']);
    expect(animals['Farm:hen:1']!.name).toBe('Pip');
    expect(animals['Farm:goat:1']!.name).toBe('Clover');
  });

  test('pet + feed flow surfaces in the Animals panel', async ({ page }) => {
    await newGame(page);
    await page.evaluate(() => window.sturdyVolleyDebug!.petAnimal('Farm:hen:1'));
    await page.evaluate(() => window.sturdyVolleyDebug!.feedAnimal('Farm:hen:1'));
    await page.evaluate(() => window.sturdyVolleyDebug!.openAnimalPanel());
    await expect(page.getByTestId('animal-panel')).toBeVisible();
    await expect(page.getByTestId('animal-row-Farm:hen:1')).toContainText('Pip');
    await expect(page.getByTestId('animal-row-Farm:hen:1')).toContainText('cared for today');
  });

  test('the Animals menu entry opens the panel from the pause menu', async ({ page }) => {
    await newGame(page);
    await page.getByTestId('hud-menu').click();
    await page.getByTestId('pause-animals').click();
    await expect(page.getByTestId('animal-panel')).toBeVisible();
    await page.getByTestId('animal-close').click();
  });
});
