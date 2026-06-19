import { test, expect } from '@playwright/test';

interface MineApi {
  level: () => number;
  ores: () => Array<{ id: string; ore: string }>;
  hp: () => number;
  descend: () => void;
  ascend: () => void;
  jump: (level: number) => void;
  swing: (nodeId: string) => void;
  checkpoints: () => number[];
  creatures: () => Array<{ id: string; hp: number; phase: string; x: number; z: number }>;
  forceSwing: () => void;
  teleport: (x: number, z: number) => void;
  equipWeapon: (id: 'fists' | 'driftwood-club' | 'tide-blade' | 'storm-spear') => void;
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
  await page.getByTestId('field-name').fill('Miner');
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

test.describe('Prompt 023 — Mining and cave exploration', () => {
  test('fresh save starts on L0 with ore nodes spawned + a checkpoint recorded', async ({ page }) => {
    await newGameOnMine(page);
    const level = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.level(),
    );
    expect(level).toBe(0);
    const ores = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.ores(),
    );
    expect(ores.length).toBeGreaterThan(0);
    const checkpoints = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.checkpoints(),
    );
    expect(checkpoints).toContain(0);
  });

  test('descending advances the level + reshuffles ores', async ({ page }) => {
    await newGameOnMine(page);
    const oresBefore = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.ores().map((o) => o.id),
    );
    await page.evaluate(() =>
      (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.descend(),
    );
    const level = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.level(),
    );
    expect(level).toBe(1);
    const oresAfter = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.ores().map((o) => o.id),
    );
    expect(oresAfter).not.toEqual(oresBefore);
  });

  test('swinging at a gravel ore removes it from the live list', async ({ page }) => {
    await newGameOnMine(page);
    const targetId = await page.evaluate(() => {
      const ores = (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.ores();
      return ores.find((o) => o.ore === 'gravel')?.id ?? ores[0]?.id ?? null;
    });
    if (!targetId) test.skip();
    await page.evaluate((id) =>
      (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.swing(id as string),
      targetId,
    );
    const stillThere = await page.evaluate((id) =>
      (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.ores().some((o) => o.id === id),
      targetId,
    );
    expect(stillThere).toBe(false);
  });
});
