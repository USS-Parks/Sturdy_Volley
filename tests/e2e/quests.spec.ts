import { test, expect, type Page } from '@playwright/test';
// Reuses the Window.sturdyVolleyDebug type declared in farm.spec.ts.

async function newGame(page: Page, name = 'Quester'): Promise<void> {
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
  } catch {
    /* cutscene already gone */
  }
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.quests));
}

async function pressInteract(page: Page): Promise<void> {
  await page.keyboard.down('e');
  await page.waitForTimeout(180);
  await page.keyboard.up('e');
}

function questStatus(page: Page, id: string): Promise<string | undefined> {
  return page.evaluate((qid) => window.sturdyVolleyDebug!.quests().find((q) => q.id === qid)?.status, id);
}

test.describe('Prompt 054 — quest system', () => {
  test('the pause menu opens a touch-friendly journal listing the quest catalogue', async ({ page }) => {
    await newGame(page);

    // Open the journal through the real pause-menu path.
    await page.getByTestId('hud-menu').click();
    await page.getByTestId('pause-quests').click();

    await expect(page.getByTestId('quest-panel')).toBeVisible();
    const rows = page.locator('[data-testid^="quest-row-"]');
    expect(await rows.count(), 'journal should list at least 12 quests').toBeGreaterThanOrEqual(12);

    // The tutorial story quest is active from a fresh save.
    await expect(page.getByTestId('quest-status-first-harvest')).toHaveText('Active');

    await page.getByTestId('quest-close').click();
    await expect(page.getByTestId('quest-panel')).toBeHidden();
  });

  test('accepting a request, then foraging in-world, advances and completes it', async ({ page }) => {
    await newGame(page);

    // Accept the foraging request through the journal's Accept button.
    await page.evaluate(() => window.sturdyVolleyDebug!.openQuestPanel());
    await page.getByTestId('quest-accept-tide-forager').click();
    expect(await questStatus(page, 'tide-forager')).toBe('active');
    // The panel re-renders with a Cancel button now that it's active.
    await expect(page.getByTestId('quest-cancel-tide-forager')).toBeVisible();
    await page.getByTestId('quest-close').click();

    // Genuine in-world forage of a tide-shell advances the objective (proves the
    // FarmScene emit is wired, not just the debug shortcut).
    const warped = await page.evaluate(() => window.sturdyVolleyDebug!.warpToEntity('forage-shell-a'));
    expect(warped).toBe(true);
    await page.waitForTimeout(150);
    await pressInteract(page);
    await page.waitForTimeout(200);

    const afterForage = await page.evaluate(
      () => window.sturdyVolleyDebug!.quests().find((q) => q.id === 'tide-forager')?.objectives[0]?.current ?? 0,
    );
    expect(afterForage, 'foraging a shell should advance the objective').toBeGreaterThanOrEqual(1);

    // Finish the remaining shells deterministically; it should complete.
    const completed = await page.evaluate(() => window.sturdyVolleyDebug!.recordQuestEvent('forage', 'tide-shell', 4));
    expect(completed).toContain('tide-forager');
    expect(await questStatus(page, 'tide-forager')).toBe('complete');
  });

  test('abandoning a cancellable quest returns it to available', async ({ page }) => {
    await newGame(page);

    await page.evaluate(() => window.sturdyVolleyDebug!.openQuestPanel());
    await page.getByTestId('quest-accept-tide-forager').click();
    expect(await questStatus(page, 'tide-forager')).toBe('active');

    await page.getByTestId('quest-cancel-tide-forager').click();
    expect(await questStatus(page, 'tide-forager')).toBe('available');
    // Accept is offered again after abandoning.
    await expect(page.getByTestId('quest-accept-tide-forager')).toBeVisible();
  });

  test('a missed timed request fails without breaking the story quest', async ({ page }) => {
    await newGame(page);

    // Accept a request with a 4-day deadline, then sleep past it.
    await page.evaluate(() => window.sturdyVolleyDebug!.acceptQuest('tide-forager'));
    expect(await questStatus(page, 'tide-forager')).toBe('active');

    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.sturdyVolleyDebug!.sleep());
      const cont = page.getByTestId('day-summary-continue');
      await cont.waitFor({ state: 'visible', timeout: 5000 });
      await cont.click();
      await cont.waitFor({ state: 'hidden', timeout: 5000 });
    }

    // The timed request expired...
    expect(await questStatus(page, 'tide-forager')).toBe('failed');
    // ...but the untimed story quest is untouched and still playable.
    expect(await questStatus(page, 'first-harvest')).toBe('active');
    const stamina = await page.evaluate(() => window.sturdyVolleyDebug!.controller().stamina);
    expect(stamina).toBeGreaterThan(0);
  });
});
