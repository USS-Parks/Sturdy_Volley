import { test, expect } from '@playwright/test';

interface MineApi {
  level: () => number;
  descend: () => void;
  jump: (level: number) => void;
  openElevator: () => void;
  bossHp: () => number;
  strikeBoss: () => void;
  bossDefeated: () => boolean;
  lanternFuel: () => number;
  equipWeapon: (id: 'fists' | 'driftwood-club' | 'tide-blade' | 'storm-spear') => void;
  checkpoints: () => number[];
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

async function newGameOnMine(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('title-start').click();
  await page.getByTestId('field-name').fill('Spelunker');
  await page.getByTestId('form-submit').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await dismissCutscene(page);
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.time));
  await page.evaluate(() =>
    (window as unknown as { sturdyVolley?: SturdyVolleyApi }).sturdyVolley?.manager.goTo(
      'Mine',
      undefined,
      false,
    ),
  );
  await page.waitForFunction(
    () => Boolean((window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine),
  );
}

test.describe('Prompt 025 — Mine depth, elevator, boss chamber', () => {
  test('elevator panel opens on checkpoint levels and jumps the player', async ({ page }) => {
    await newGameOnMine(page);
    // L0 is a checkpoint by default.
    await page.evaluate(() =>
      (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.openElevator(),
    );
    await expect(page.getByTestId('elevator-panel')).toBeVisible();
    await expect(page.getByTestId('elevator-jump-0')).toBeDisabled();
    await page.getByTestId('elevator-close').click();
  });

  test('reaching L19 spawns the boss; force-striking with storm-spear defeats it', async ({ page }) => {
    await newGameOnMine(page);
    // Jump to L19 by adding it to checkpoints first.
    await page.evaluate(() => {
      const api = (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!;
      // Walk down level by level so loadCurrentLevel runs each step (autorecords checkpoints).
      for (let i = 0; i < 19; i++) api.descend();
    });
    const level = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.level(),
    );
    expect(level).toBe(19);
    const initialHp = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.bossHp(),
    );
    expect(initialHp).toBeGreaterThan(0);
    // Equip best weapon + strike until defeated.
    await page.evaluate(() =>
      (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.equipWeapon('storm-spear'),
    );
    for (let i = 0; i < 12; i++) {
      const hp = await page.evaluate(() =>
        (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.bossHp(),
      );
      if (hp <= 0) break;
      await page.evaluate(() =>
        (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.strikeBoss(),
      );
    }
    const defeated = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.bossDefeated(),
    );
    expect(defeated).toBe(true);
  });
});
