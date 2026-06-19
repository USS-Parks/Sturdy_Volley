import { test, expect } from '@playwright/test';
// Reuses the Window.sturdyVolleyDebug type declared in farm.spec.ts.

async function newGameToTown(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('title-start').click();
  await page.getByTestId('field-name').fill('Doors');
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
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.time));
  await page.evaluate(() =>
    (window as unknown as {
      sturdyVolley?: { manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> } };
    }).sturdyVolley?.manager.goTo('Town', undefined, false),
  );
  await expect(page.getByText('Ballast Bay', { exact: false })).toBeVisible();
}

test.describe('RF-15 — Town building doors + open/closed schedule', () => {
  test('open bakery door enters the bakery interior; exit returns to Town', async ({ page }) => {
    await newGameToTown(page);
    // Bakery position: (-12, -4). Door is z = -4 + 3.6/2 + 0.4 = -1.8.
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
          if (mesh.name === 'player') mesh.position.set(-12, 0.9, -2.2);
        }
      }
    });
    await page.waitForTimeout(180);
    await page.keyboard.down('e');
    await page.waitForTimeout(180);
    await page.keyboard.up('e');

    // Inside the Bakery — the InteriorScene HUD title flips to "Bakery".
    await expect(page.getByText('Bakery', { exact: false })).toBeVisible({ timeout: 4000 });

    // Step outside via the Interior exit door (south side anchor (0, 4.5)).
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
          if (mesh.name === 'player') mesh.position.set(0, 0.9, 4.5);
        }
      }
    });
    await page.waitForTimeout(180);
    await page.keyboard.down('e');
    await page.waitForTimeout(180);
    await page.keyboard.up('e');
    await expect(page.getByText('Ballast Bay', { exact: false })).toBeVisible({ timeout: 6000 });
  });

  test('closed fishmonger flashes a closed-today label after 2 PM', async ({ page }) => {
    await newGameToTown(page);
    // Move the calendar clock past the fishmonger close time (14 * 60 = 840).
    await page.evaluate(() => {
      const key = 'sturdy-volley:save:v1';
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const data = JSON.parse(raw);
      data.calendar.timeMinutes = 15 * 60; // 3 PM
      localStorage.setItem(key, JSON.stringify(data));
    });
    await page.reload();
    await page.getByTestId('title-continue').click();
    await expect(page.locator('#game-canvas')).toBeVisible();
    // Continue restores to save.location.sceneKey = 'Town', so just wait for
    // the Town HUD text. No need to navigate explicitly.
    await expect(page.getByText('Ballast Bay', { exact: false })).toBeVisible({
      timeout: 8000,
    });

    // Wait briefly so update() rebuilds targets at least once at the new clock,
    // then read the Town debug surface — the door's label encodes the
    // open/closed state directly from `engine/shops.ts`.
    await page.waitForTimeout(300);
    const targets = await page.evaluate(() => {
      const t = (
        window as unknown as {
          sturdyVolleyTown?: {
            targets: () => Array<{ id: string; label: string; x: number; z: number; radius: number }>;
          };
        }
      ).sturdyVolleyTown;
      return t?.targets() ?? [];
    });
    expect(targets.length, `expected door + npc targets, got ${targets.length}`).toBeGreaterThan(0);
    const fishmongerDoor = targets.find((t) => t.id === 'door:fishmonger');
    expect(fishmongerDoor, 'fishmonger door target should exist').toBeDefined();
    expect(fishmongerDoor!.label, fishmongerDoor!.label).toContain('closed today');
  });
});
