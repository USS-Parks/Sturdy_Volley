import { test, expect } from '@playwright/test';
// Reuses the Window.sturdyVolleyDebug type declared in farm.spec.ts.

interface SturdyVolleyApi {
  manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> };
}

interface InteriorApi {
  openCrafting: () => void;
  placedDecor: () => Array<{ id: string; itemId: string; x: number; z: number }>;
  grantStarterIngredients: () => void;
  grantItem: (itemId: string, qty: number) => void;
  grantRecipe: (recipeId: string) => void;
  knownRecipes: () => readonly string[];
}

async function newGame(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('title-start').click();
  await page.getByTestId('field-name').fill('Maker');
  await page.getByTestId('form-submit').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.time));
}

async function gotoInterior(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() =>
    (window as unknown as { sturdyVolley?: SturdyVolleyApi }).sturdyVolley?.manager.goTo(
      'Interior',
      { entry: 'inside-door' },
      false,
    ),
  );
  await expect(page.getByText('Farmhouse', { exact: false })).toBeVisible();
  await page.waitForFunction(
    () =>
      Boolean(
        (window as unknown as { sturdyVolleyInterior?: InteriorApi }).sturdyVolleyInterior,
      ),
  );
}

function api(page: import('@playwright/test').Page) {
  return {
    grantItem: (itemId: string, qty: number) =>
      page.evaluate(
        ([id, q]) =>
          (window as unknown as { sturdyVolleyInterior?: InteriorApi })
            .sturdyVolleyInterior!.grantItem(id as string, q as number),
        [itemId, qty] as const,
      ),
    grantRecipe: (recipeId: string) =>
      page.evaluate(
        (id) =>
          (window as unknown as { sturdyVolleyInterior?: InteriorApi })
            .sturdyVolleyInterior!.grantRecipe(id),
        recipeId,
      ),
    openCrafting: () =>
      page.evaluate(() =>
        (window as unknown as { sturdyVolleyInterior?: InteriorApi })
          .sturdyVolleyInterior!.openCrafting(),
      ),
    placedDecor: () =>
      page.evaluate(() =>
        (window as unknown as { sturdyVolleyInterior?: InteriorApi })
          .sturdyVolleyInterior!.placedDecor(),
      ),
  };
}

test.describe('Prompt 017 — crafting + recipe unlocks + placement', () => {
  test('opening the workbench lists the starter recipes', async ({ page }) => {
    await newGame(page);
    await gotoInterior(page);
    await api(page).openCrafting();
    const panel = page.getByTestId('crafting-panel');
    await expect(panel).toBeVisible();
    // STARTER_RECIPE_IDS in src/engine/crafting.ts ships seven recipes.
    const rows = panel.locator('[data-testid^="crafting-row-"]');
    await expect(rows).toHaveCount(7);
    // The Craft button is disabled for any recipe whose ingredients we lack.
    await expect(page.getByTestId('crafting-craft-driftwood-plank')).toBeDisabled();
  });

  test('crafting a placeable item drops it on the map and survives a reload', async ({ page }) => {
    await newGame(page);
    await gotoInterior(page);
    const a = api(page);

    // Grant enough driftwood-planks + the shelf recipe up-front; bypass the
    // multi-step craft chain to keep the spec focused on placement.
    await a.grantItem('driftwood-plank', 3);
    await a.grantRecipe('driftwood-shelf');
    await a.openCrafting();

    const shelfBtn = page.getByTestId('crafting-craft-driftwood-shelf');
    await expect(shelfBtn).toBeEnabled();
    await shelfBtn.click();

    const placed = await a.placedDecor();
    expect(placed).toHaveLength(1);
    expect(placed[0]!.itemId).toBe('driftwood-shelf');

    await page.getByTestId('crafting-close').click();

    // Reload via the title screen's Continue button; the save records the
    // active scene as `Interior`, so Continue resumes there and the
    // InteriorScene re-spawns the placed shelf on enter.
    await page.reload();
    await page.getByTestId('title-continue').click();
    await expect(page.locator('#game-canvas')).toBeVisible();
    await page.waitForFunction(
      () =>
        Boolean(
          (window as unknown as { sturdyVolleyInterior?: InteriorApi }).sturdyVolleyInterior,
        ),
    );
    const reloaded = await api(page).placedDecor();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]!.itemId).toBe('driftwood-shelf');
  });
});
