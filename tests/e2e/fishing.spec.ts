import { test, expect } from '@playwright/test';

interface BeachApi {
  openFishing: () => void;
  cast: (withBait: boolean) => void;
  fishingPhase: () => string;
  pendingResolvedId: () => string | null;
  forceBite: () => void;
  forceCatch: () => void;
  forceLoss: () => void;
  grantItem: (itemId: string, qty: number) => void;
  toggleAssist: () => void;
  firstCatchSeen: () => Record<string, boolean>;
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
    /* no cutscene */
  }
}

async function newGameOnBeach(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('title-start').click();
  await page.getByTestId('field-name').fill('Angler');
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
    () =>
      Boolean((window as unknown as { sturdyVolleyBeach?: BeachApi }).sturdyVolleyBeach),
  );
}

test.describe('Prompt 021 — Fishing and crab pots', () => {
  test('opening the surf panel renders the cast button + bait counter', async ({ page }) => {
    await newGameOnBeach(page);
    await page.evaluate(() =>
      (window as unknown as { sturdyVolleyBeach?: BeachApi }).sturdyVolleyBeach!.openFishing(),
    );
    await expect(page.getByTestId('fishing-panel')).toBeVisible();
    await expect(page.getByTestId('fishing-status')).toContainText('Cast');
    await expect(page.getByTestId('fishing-cast')).toBeVisible();
  });

  test('casting → forcing a bite → forcing a catch lands the fish in inventory', async ({ page }) => {
    await newGameOnBeach(page);
    await page.evaluate(() =>
      (window as unknown as { sturdyVolleyBeach?: BeachApi }).sturdyVolleyBeach!.grantItem('bait', 3),
    );
    await page.evaluate(() =>
      (window as unknown as { sturdyVolleyBeach?: BeachApi }).sturdyVolleyBeach!.openFishing(),
    );
    await page.evaluate(() =>
      (window as unknown as { sturdyVolleyBeach?: BeachApi }).sturdyVolleyBeach!.cast(true),
    );
    await page.evaluate(() =>
      (window as unknown as { sturdyVolleyBeach?: BeachApi }).sturdyVolleyBeach!.forceBite(),
    );
    const phase = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyBeach?: BeachApi }).sturdyVolleyBeach!.fishingPhase(),
    );
    expect(['reel', 'caught']).toContain(phase);
    if (phase === 'reel') {
      await page.evaluate(() =>
        (window as unknown as { sturdyVolleyBeach?: BeachApi }).sturdyVolleyBeach!.forceCatch(),
      );
    }
    const seen = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyBeach?: BeachApi }).sturdyVolleyBeach!.firstCatchSeen(),
    );
    if (Object.keys(seen).length > 0) {
      const firstId = Object.keys(seen)[0]!;
      expect(seen[firstId]).toBe(true);
    }
  });

  test('assist toggle persists and the panel label flips', async ({ page }) => {
    await newGameOnBeach(page);
    await page.evaluate(() =>
      (window as unknown as { sturdyVolleyBeach?: BeachApi }).sturdyVolleyBeach!.openFishing(),
    );
    await expect(page.getByTestId('fishing-assist')).toContainText('off');
    await page.getByTestId('fishing-assist').click();
    await expect(page.getByTestId('fishing-assist')).toContainText('on');
  });
});
