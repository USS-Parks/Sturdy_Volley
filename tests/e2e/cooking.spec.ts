import { test, expect, type Page } from '@playwright/test';
// Local interface cast (not a Window global) so this spec never collides with the
// sturdyVolleyInterior declaration other specs own.

interface InteriorCookDebug {
  grantItem: (itemId: string, qty: number) => void;
  grantRecipe: (recipeId: string) => void;
  knownRecipes: () => readonly string[];
  openKitchen: () => void;
  cook: (recipeId: string) => { cooked: boolean };
  eat: (itemId: string) => { eaten: boolean; staminaRestore: number; buffLabel: string | null };
  activeBuffs: () => Array<{ effect: string; label: string; minutesLeft: number }>;
}

interface ManagerApi {
  manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> };
}

async function newGame(page: Page, name = 'Cook'): Promise<void> {
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
    /* no cutscene */
  }
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.controller));
}

async function gotoFarmhouse(page: Page): Promise<void> {
  await page.evaluate(() =>
    (window as unknown as { sturdyVolley?: ManagerApi }).sturdyVolley?.manager.goTo('Interior', { entry: 'inside-door' }, false),
  );
  await page.waitForFunction(() =>
    Boolean((window as unknown as { sturdyVolleyInterior?: InteriorCookDebug }).sturdyVolleyInterior?.openKitchen),
  );
}

test.describe('Prompt 059 — cooking and buffs', () => {
  test('cooking a known dish and eating it grants a timed buff', async ({ page }) => {
    await newGame(page);
    await gotoFarmhouse(page);

    // Bell Pea Stew is a starter cooking recipe; stock its ingredients and cook it.
    await page.evaluate(() => {
      const d = (window as unknown as { sturdyVolleyInterior: InteriorCookDebug }).sturdyVolleyInterior;
      d.grantItem('bell-peas', 3);
      d.grantItem('salt', 2);
    });
    const cooked = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyInterior: InteriorCookDebug }).sturdyVolleyInterior.cook('bell-pea-stew'),
    );
    expect(cooked.cooked).toBe(true);

    const eaten = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyInterior: InteriorCookDebug }).sturdyVolleyInterior.eat('bell-pea-stew'),
    );
    expect(eaten.eaten).toBe(true);
    expect(eaten.staminaRestore).toBeGreaterThan(0);

    const buffs = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyInterior: InteriorCookDebug }).sturdyVolleyInterior.activeBuffs(),
    );
    expect(buffs.some((b) => b.effect === 'stamina-regen')).toBe(true);
  });

  test('the kitchen panel cooks a dish and eats from the pantry in the UI', async ({ page }) => {
    await newGame(page);
    await gotoFarmhouse(page);
    await page.evaluate(() => {
      const d = (window as unknown as { sturdyVolleyInterior: InteriorCookDebug }).sturdyVolleyInterior;
      d.grantItem('bell-peas', 3);
      d.grantItem('salt', 2);
    });

    await page.evaluate(() => (window as unknown as { sturdyVolleyInterior: InteriorCookDebug }).sturdyVolleyInterior.openKitchen());
    await expect(page.getByTestId('cooking-panel')).toBeVisible();
    await expect(page.getByTestId('cooking-cook-bell-pea-stew')).toBeVisible();

    // Cook → the dish appears in the pantry → eat it.
    await page.getByTestId('cooking-cook-bell-pea-stew').click();
    await expect(page.getByTestId('pantry-eat-bell-pea-stew')).toBeVisible();
    await page.getByTestId('pantry-eat-bell-pea-stew').click();
    // After eating, a buff chip shows.
    await expect(page.getByTestId('cooking-buffs')).toContainText('Stamina regen');
  });

  test('a granted recipe expands the cookable dishes and grants its buff (movement)', async ({ page }) => {
    await newGame(page);
    await gotoFarmhouse(page);

    await page.evaluate(() => {
      const d = (window as unknown as { sturdyVolleyInterior: InteriorCookDebug }).sturdyVolleyInterior;
      d.grantRecipe('sunrise-flapjack');
      d.grantItem('sunmelon', 1);
      d.grantItem('mooncalf-egg', 1);
    });
    expect(await page.evaluate(() =>
      (window as unknown as { sturdyVolleyInterior: InteriorCookDebug }).sturdyVolleyInterior.knownRecipes(),
    )).toContain('sunrise-flapjack');

    const cooked = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyInterior: InteriorCookDebug }).sturdyVolleyInterior.cook('sunrise-flapjack'),
    );
    expect(cooked.cooked).toBe(true);

    await page.evaluate(() =>
      (window as unknown as { sturdyVolleyInterior: InteriorCookDebug }).sturdyVolleyInterior.eat('sunrise-flapjack'),
    );
    const buffs = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyInterior: InteriorCookDebug }).sturdyVolleyInterior.activeBuffs(),
    );
    expect(buffs.some((b) => b.effect === 'movement')).toBe(true);
  });
});
