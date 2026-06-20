import { test, expect } from '@playwright/test';
// Reuses the Window.sturdyVolleyDebug type declared in farm.spec.ts.

async function newGameToBakery(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('title-start').click();
  await page.getByTestId('field-name').fill('Buyer');
  await page.getByTestId('form-submit').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  const skip = page.getByTestId('cutscene-skip');
  try {
    await skip.waitFor({ state: 'visible', timeout: 4000 });
    await skip.click();
    await skip.waitFor({ state: 'hidden', timeout: 4000 });
  } catch { /* no cutscene */ }
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.time));
  // goTo Town → bakery door entry.
  await page.evaluate(() =>
    (window as unknown as {
      sturdyVolley?: { manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> } };
    }).sturdyVolley?.manager.goTo('Town', undefined, false),
  );
  await expect(page.getByText('Ballast Bay', { exact: false })).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as {
      sturdyVolley?: { manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> } };
    }).sturdyVolley?.manager.goTo('Interior', { entry: 'inside-door', shopId: 'market-bakery' }, false),
  );
  await expect(page.getByText('Sun Loaf Bakery', { exact: false })).toBeVisible();
}

test.describe('Prompt 016 — Shops and economy', () => {
  test('walking up to the bakery counter opens the shop panel; buying spends gold + adds the item', async ({
    page,
  }) => {
    await newGameToBakery(page);

    // The shop counter target sits at (4.8, -1) inside the Interior. Walk over.
    await page.evaluate(() => {
      const sv = (
        window as unknown as {
          sturdyVolley?: {
            engine: { scenes: { meshes: { name: string; position: { set: (x: number, y: number, z: number) => void } }[] }[] };
          };
        }
      ).sturdyVolley;
      if (!sv) return;
      for (const scene of sv.engine.scenes) {
        for (const mesh of scene.meshes) {
          if (mesh.name === 'player') mesh.position.set(4.0, 0.9, -1);
        }
      }
    });
    // Give InteriorScene's update loop several frames after the teleport so
    // resolveInteraction(...) picks up `shop-counter` as `nearest` before E.
    await page.waitForTimeout(350);
    // Dispatch the 'e' keydown/keyup directly on `window` (same pattern as
    // inventory.spec.ts + slice-gate.spec.ts): Playwright's CDP keyboard
    // dispatch races with focus state on desktop-chromium CI and the event
    // can miss InteriorScene's window-level onKeyDown listener. Hold the key
    // until the shop panel actually opens, then release in `finally`.
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    });
    try {
      await expect(page.getByTestId('shop-panel')).toBeVisible({ timeout: 5000 });
    } finally {
      await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'e' }));
      });
    }
    await expect(page.getByTestId('shop-list')).toContainText('Garden Omelet');

    // The garden omelet base price is 120 g, ×1.5 markup = 180 g. Wallet starts at 500.
    const before = await page.evaluate(() => {
      const raw = localStorage.getItem('sturdy-volley:save:v1');
      return raw ? JSON.parse(raw) : null;
    });
    expect(before?.wallet?.gold).toBe(500);
    await page.getByTestId('shop-buy-garden-omelet').click();
    const after = await page.evaluate(() => {
      const raw = localStorage.getItem('sturdy-volley:save:v1');
      return raw ? JSON.parse(raw) : null;
    });
    expect(after?.wallet?.gold).toBe(500 - 180);
    const hasOmelet = (after?.inventory?.slots ?? []).some(
      (s: { itemId: string; qty: number } | null) => s?.itemId === 'garden-omelet',
    );
    expect(hasOmelet).toBe(true);

    await page.getByTestId('shop-close').click();
    await expect(page.getByTestId('shop-panel')).not.toBeVisible();
  });
});
