import { test, expect } from '@playwright/test';

interface BeachApi {
  reef: () => { health: number; fragmentsDonated: number; tier: number };
  reefAccess: () => 'open' | 'wading' | 'closed';
  openReef: () => void;
  harvestReef: () => void;
  donateReef: () => void;
  grantItem: (itemId: string, qty: number) => void;
}

interface SturdyVolleyApi {
  manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> };
}

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

async function newGameOnBeach(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('title-start').click();
  await page.getByTestId('field-name').fill('Snorkeler');
  await page.getByTestId('form-submit').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await dismissCutscene(page);
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.time));
  await page.evaluate(() =>
    (window as unknown as { sturdyVolley?: SturdyVolleyApi }).sturdyVolley?.manager.goTo(
      'Beach',
      undefined,
      false,
    ),
  );
  await page.waitForFunction(
    () => Boolean((window as unknown as { sturdyVolleyBeach?: BeachApi }).sturdyVolleyBeach),
  );
}

test.describe('Prompt 022 — Low-tide reef and snorkeling', () => {
  test('reef panel opens; harvest button is gated by tide access', async ({ page }) => {
    await newGameOnBeach(page);
    await page.evaluate(() =>
      (window as unknown as { sturdyVolleyBeach?: BeachApi }).sturdyVolleyBeach!.openReef(),
    );
    await expect(page.getByTestId('reef-panel')).toBeVisible();
    const access = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyBeach?: BeachApi }).sturdyVolleyBeach!.reefAccess(),
    );
    const harvest = page.getByTestId('reef-harvest');
    if (access === 'closed') {
      await expect(harvest).toBeDisabled();
    } else {
      await expect(harvest).toBeEnabled();
      await harvest.click();
    }
  });

  test('donating fragments restores the reef tier and the bar grows', async ({ page }) => {
    await newGameOnBeach(page);
    await page.evaluate(() =>
      (window as unknown as { sturdyVolleyBeach?: BeachApi }).sturdyVolleyBeach!.grantItem('coral-fragment', 8),
    );
    await page.evaluate(() =>
      (window as unknown as { sturdyVolleyBeach?: BeachApi }).sturdyVolleyBeach!.openReef(),
    );
    await page.getByTestId('reef-donate').click();
    const reef = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyBeach?: BeachApi }).sturdyVolleyBeach!.reef(),
    );
    expect(reef.tier).toBeGreaterThanOrEqual(1);
    expect(reef.health).toBeCloseTo(0.25, 1);
  });
});
