import { test, expect } from '@playwright/test';

async function dismissCutscene(page: import('@playwright/test').Page): Promise<void> {
  const skip = page.getByTestId('cutscene-skip');
  try {
    await skip.waitFor({ state: 'visible', timeout: 4000 });
    await skip.click();
    await skip.waitFor({ state: 'hidden', timeout: 4000 });
  } catch {
    /* none */
  }
}

async function newGame(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('title-start').click();
  await page.getByTestId('field-name').fill('Trainee');
  await page.getByTestId('form-submit').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await dismissCutscene(page);
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.time));
}

test.describe('Prompt 027 — Skill professions panel', () => {
  test('pause-skills opens the Skills panel with all 8 skills', async ({ page }) => {
    await newGame(page);
    await page.getByTestId('hud-menu').click();
    await page.getByTestId('pause-skills').click();
    await expect(page.getByTestId('profession-panel')).toBeVisible();
    for (const id of ['cultivation', 'husbandry', 'foraging', 'angling', 'crafting', 'exploring', 'combat', 'rapport']) {
      await expect(page.getByTestId(`profession-row-${id}`)).toBeVisible();
    }
    await page.getByTestId('profession-close').click();
  });
});
