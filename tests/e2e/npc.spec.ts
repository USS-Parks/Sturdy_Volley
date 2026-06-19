import { test, expect } from '@playwright/test';
// Reuses the Window.sturdyVolleyDebug type declared in farm.spec.ts.

async function newGame(page: import('@playwright/test').Page, name = 'Walker'): Promise<void> {
  await page.goto('/');
  await page.getByTestId('title-start').click();
  await page.getByTestId('field-name').fill(name);
  await page.getByTestId('form-submit').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.time));
}

test.describe('VS-A4 — Live NPC + greet bubble', () => {
  test('the Town renders Mara as a graybox humanoid', async ({ page }) => {
    await newGame(page);
    await page.evaluate(() =>
      (window as unknown as {
        sturdyVolley?: {
          manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> };
        };
      }).sturdyVolley?.manager.goTo('Town', undefined, false),
    );
    await expect(page.getByText('Ballast Bay', { exact: false })).toBeVisible();
    // Confirm Mara's torso mesh exists.
    const hasMara = await page.evaluate(() => {
      const sv = (
        window as unknown as { sturdyVolley?: { engine: { scenes: { meshes: { name: string }[] }[] } } }
      ).sturdyVolley;
      if (!sv) return false;
      for (const scene of sv.engine.scenes) {
        for (const mesh of scene.meshes) {
          if (mesh.name === 'npc-mara-vale-torso') return true;
        }
      }
      return false;
    });
    expect(hasMara).toBe(true);
  });

  test('interacting with Mara opens a greet bubble; Continue dismisses', async ({ page }) => {
    await newGame(page);
    await page.evaluate(() =>
      (window as unknown as {
        sturdyVolley?: {
          manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> };
        };
      }).sturdyVolley?.manager.goTo('Town', undefined, false),
    );
    await expect(page.getByText('Ballast Bay', { exact: false })).toBeVisible();

    // Park the player on Mara's known schedule position so she's in range.
    // At minutes=360 her default waypoint is Town (-8, -4); after 540 it moves
    // to (0, -4). A fresh save starts at 6 AM (minutes=360).
    await page.evaluate(() => {
      const sv = (
        window as unknown as {
          sturdyVolley?: { engine: { scenes: { meshes: { name: string; position: { set: (x: number, y: number, z: number) => void } }[] }[] } };
        }
      ).sturdyVolley;
      if (!sv) return;
      for (const scene of sv.engine.scenes) {
        for (const mesh of scene.meshes) {
          if (mesh.name === 'player') {
            mesh.position.set(-7, 0.9, -3.5);
          }
        }
      }
    });
    await page.waitForTimeout(150);
    await page.keyboard.down('e');
    await page.waitForTimeout(180);
    await page.keyboard.up('e');

    await expect(page.getByTestId('dialogue-bubble')).toBeVisible();
    await expect(page.getByTestId('dialogue-body')).toContainText('Morning');
    await page.getByTestId('dialogue-dismiss').click();
    await expect(page.getByTestId('dialogue-bubble')).not.toBeVisible();
  });
});
