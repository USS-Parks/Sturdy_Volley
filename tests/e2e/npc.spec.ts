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

  test('RF-11: all four NPC torsos exist in the Town scene', async ({ page }) => {
    await newGame(page);
    await page.evaluate(() =>
      (window as unknown as {
        sturdyVolley?: {
          manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> };
        };
      }).sturdyVolley?.manager.goTo('Town', undefined, false),
    );
    await expect(page.getByText('Ballast Bay', { exact: false })).toBeVisible();
    const counts = await page.evaluate(() => {
      const sv = (
        window as unknown as { sturdyVolley?: { engine: { scenes: { meshes: { name: string }[] }[] } } }
      ).sturdyVolley;
      if (!sv) return {} as Record<string, boolean>;
      const want = ['mara-vale', 'jun-park', 'sol-aranda', 'lio-marin'];
      const out: Record<string, boolean> = {};
      for (const id of want) out[id] = false;
      for (const scene of sv.engine.scenes) {
        for (const mesh of scene.meshes) {
          for (const id of want) {
            if (mesh.name === `npc-${id}-torso`) out[id] = true;
          }
        }
      }
      return out;
    });
    expect(counts['mara-vale']).toBe(true);
    expect(counts['jun-park']).toBe(true);
    expect(counts['sol-aranda']).toBe(true);
    expect(counts['lio-marin']).toBe(true);
  });

  test('RF-11: ?debug=schedules mounts the schedule overlay with all four rows', async ({ page }) => {
    await page.goto('/?debug=schedules');
    await expect(page.getByTestId('schedule-overlay')).toBeVisible();
    await expect(page.getByTestId('sched-row-mara-vale')).toBeVisible();
    await expect(page.getByTestId('sched-row-jun-park')).toBeVisible();
    await expect(page.getByTestId('sched-row-sol-aranda')).toBeVisible();
    await expect(page.getByTestId('sched-row-lio-marin')).toBeVisible();
  });

  test('interacting with Mara opens a greet bubble; Continue dismisses', async ({ page }) => {
    await newGame(page);
    // Day 1 + Day 2 are rain → Mara routes to the Interior under her byWeather
    // override. Bump the saved calendar to Day 3 (sunny) where her default
    // schedule keeps her on Town, then Continue from the title.
    await page.evaluate(() => {
      const key = 'sturdy-volley:save:v1';
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const data = JSON.parse(raw);
      data.calendar.day = 3;
      localStorage.setItem(key, JSON.stringify(data));
    });
    await page.reload();
    await page.getByTestId('title-continue').click();
    await expect(page.locator('#game-canvas')).toBeVisible();
    // Wait for Continue's save-load + Farm enter to complete before navigating.
    await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.openInventory));
    await page.evaluate(() =>
      (window as unknown as {
        sturdyVolley?: {
          manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> };
        };
      }).sturdyVolley?.manager.goTo('Town', undefined, false),
    );
    await expect(page.getByText('Ballast Bay', { exact: false })).toBeVisible();

    // Park the player right next to Mara at her Day-3 6-AM waypoint (-8, -4).
    // Stand 0.5 m off so the interaction-resolver clearly picks her, and dump
    // the active target list when the test runs in headed mode.
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
            mesh.position.set(-7.5, 0.9, -3.6);
          }
        }
      }
    });
    await page.waitForTimeout(180);
    await page.keyboard.down('e');
    await page.waitForTimeout(180);
    await page.keyboard.up('e');

    await expect(page.getByTestId('dialogue-bubble')).toBeVisible();
    await expect(page.getByTestId('dialogue-body')).toContainText('Morning');
    await page.getByTestId('dialogue-dismiss').click();
    await expect(page.getByTestId('dialogue-bubble')).not.toBeVisible();
  });
});
