import { test, expect } from '@playwright/test';
// Reuses the Window.sturdyVolleyDebug type declared in farm.spec.ts.

async function newGame(page: import('@playwright/test').Page, name = 'Tideline'): Promise<void> {
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
  } catch { /* cutscene already gone */ }
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.worldEntities));
}

async function gotoBeach(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() =>
    (window as unknown as {
      sturdyVolley?: { manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> } };
    }).sturdyVolley?.manager.goTo('Beach', undefined, false),
  );
  await expect(page.getByText('Driftwood Beach', { exact: false })).toBeVisible();
}

async function setPlayerPosition(
  page: import('@playwright/test').Page,
  x: number,
  z: number,
): Promise<void> {
  await page.evaluate(
    ({ x, z }) => {
      const sv = (
        window as unknown as {
          sturdyVolley?: {
            engine: {
              scenes: { meshes: { name: string; position: { set: (x: number, y: number, z: number) => void } }[] }[];
            };
          };
        }
      ).sturdyVolley;
      if (!sv) return;
      for (const scene of sv.engine.scenes) {
        for (const mesh of scene.meshes) {
          if (mesh.name === 'player') mesh.position.set(x, 0.9, z);
        }
      }
    },
    { x, z },
  );
}

test.describe('RF-10 — Beach forage + tide-line shells', () => {
  test('fresh save spawns 5 Beach world entities (3 shells + 2 driftwood)', async ({ page }) => {
    await newGame(page);
    const entities = await page.evaluate(() => window.sturdyVolleyDebug!.worldEntities());
    const beachKeys = Object.keys(entities).filter((k) => k.startsWith('Beach:'));
    expect(beachKeys).toHaveLength(5);
    const itemIds = beachKeys.map((k) => entities[k]?.itemId ?? '');
    expect(itemIds.filter((id) => id === 'tide-shell')).toHaveLength(3);
    expect(itemIds.filter((id) => id === 'driftwood')).toHaveLength(2);
  });

  test('walking onto a Beach driftwood (no tide gate) and pressing E picks it up', async ({
    page,
  }) => {
    await newGame(page);
    await gotoBeach(page);
    // Beach anchor drift-a is at (-6, 0.4). Park just inside the radius.
    await setPlayerPosition(page, -5.5, 0.0);
    await page.waitForTimeout(150);
    await page.keyboard.down('e');
    await page.waitForTimeout(180);
    await page.keyboard.up('e');
    await page.waitForTimeout(150);

    const stillThere = await page.evaluate(
      () => window.sturdyVolleyDebug!.worldEntities()['Beach:drift-a'],
    );
    expect(stillThere).toBeFalsy();
    const hotbar = await page.evaluate(() => window.sturdyVolleyDebug!.hotbarSlots());
    const driftStack = hotbar.find((s) => s?.itemId === 'driftwood');
    expect(driftStack?.qty, 'driftwood should land in the hotbar').toBeGreaterThanOrEqual(1);
  });

  test('tide-line shells stay submerged at high/rising tide (no interaction)', async ({ page }) => {
    await newGame(page);
    await gotoBeach(page);
    // Fresh save starts at 6 AM (Day 1) — tide state is "rising" (between the
    // 4:30 AM low and the ~10:42 AM high). The shell at Beach:shell-a sits on
    // the tide line and must NOT be interactable at this state.
    await setPlayerPosition(page, -2.5, 2.9);
    await page.waitForTimeout(180);
    await page.keyboard.down('e');
    await page.waitForTimeout(180);
    await page.keyboard.up('e');
    await page.waitForTimeout(180);

    const stillThere = await page.evaluate(
      () => window.sturdyVolleyDebug!.worldEntities()['Beach:shell-a'],
    );
    expect(stillThere, 'shell-a stays put at rising tide').toBeTruthy();
  });
});
