import { test, expect } from '@playwright/test';
// Reuses the Window.sturdyVolleyDebug type declared in farm.spec.ts.

async function newGameToDay3Town(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('title-start').click();
  await page.getByTestId('field-name').fill('Gifter');
  await page.getByTestId('form-submit').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.openInventory));

  // Bump the calendar to Day 3 (sunny) so Mara is on Town under her default
  // schedule. Also seed Mara's loved gift in hotbar slot 0 so the "Give" choice
  // surfaces with a known item.
  await page.evaluate(() => {
    const key = 'sturdy-volley:save:v1';
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const data = JSON.parse(raw);
    data.calendar.day = 3;
    data.inventory.slots[0] = { itemId: 'goat-cheese', qty: 1, quality: 0 };
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  await page.getByTestId('title-continue').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.openInventory));
  await page.evaluate(() =>
    (window as unknown as {
      sturdyVolley?: { manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> } };
    }).sturdyVolley?.manager.goTo('Town', undefined, false),
  );
  await expect(page.getByText('Ballast Bay', { exact: false })).toBeVisible();

  // Park player next to Mara at her Day-3 6-AM waypoint (-8, -4).
  await page.evaluate(() => {
    const sv = (
      window as unknown as {
        sturdyVolley?: { engine: { scenes: { meshes: { name: string; position: { set: (x: number, y: number, z: number) => void } }[] }[] } };
      }
    ).sturdyVolley;
    if (!sv) return;
    for (const scene of sv.engine.scenes) {
      for (const mesh of scene.meshes) {
        if (mesh.name === 'player') mesh.position.set(-7.5, 0.9, -3.6);
      }
    }
  });
  await page.waitForTimeout(180);
}

test.describe('RF-13 — Gift handoff via the dialogue panel', () => {
  test('giving Mara her loved goat-cheese yields a "Loved" tier flash + rapport bar', async ({
    page,
  }) => {
    await newGameToDay3Town(page);

    // Open the dialogue with Mara.
    await page.keyboard.down('e');
    await page.waitForTimeout(180);
    await page.keyboard.up('e');
    await expect(page.getByTestId('dialogue-bubble')).toBeVisible();
    await expect(page.getByTestId('dialogue-rapport')).toBeVisible();
    // The "Give Goat Cheese" choice should be appended to the choice list.
    await expect(page.getByTestId('dialogue-choice-__gift__')).toBeVisible();
    await page.getByTestId('dialogue-choice-__gift__').click();

    // After the handoff: tier flash visible. The rapport bar is now visible
    // (engine reports level 0 at 80 points since POINTS_PER_LEVEL = 100; the
    // bar still mounts with 10 empty pips — verified separately).
    await expect(page.getByTestId('dialogue-tier-flash')).toContainText('Loved');
    await expect(page.getByTestId('dialogue-rapport')).toBeVisible();

    // Save reflects the change.
    const after = await page.evaluate(() => {
      const raw = localStorage.getItem('sturdy-volley:save:v1');
      return raw ? JSON.parse(raw) : null;
    });
    expect(after?.relationships?.['mara-vale']).toBeGreaterThanOrEqual(80);
    expect(after?.giftsThisWeek?.['mara-vale']).toBe(1);
    expect(after?.inventory?.slots?.[0]).toBeNull();
  });
});
