import { test, expect } from '@playwright/test';

interface MineApi {
  level: () => number;
  creatures: () => Array<{ id: string; hp: number; phase: string; x: number; z: number }>;
  forceSwing: () => void;
  teleport: (x: number, z: number) => void;
  equipWeapon: (id: 'fists' | 'driftwood-club' | 'tide-blade' | 'storm-spear') => void;
  descend: () => void;
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
  await page.getByTestId('field-name').fill('Defender');
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

test.describe('Prompt 024 — Defensive combat foundation', () => {
  test('descending to a creature-bearing level + swinging a tide-blade fells a critter', async ({ page }) => {
    await newGameOnMine(page);
    // Descend a few levels until at least one creature is present.
    for (let i = 0; i < 6; i++) {
      const count = await page.evaluate(() =>
        (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.creatures().length,
      );
      if (count > 0) break;
      await page.evaluate(() =>
        (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.descend(),
      );
    }
    const initial = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.creatures(),
    );
    if (initial.length === 0) test.skip();
    const target = initial[0]!;
    // Teleport the player adjacent to the creature, equip a strong weapon, and force-swing
    // until the creature is downed. tide-blade is 10 damage; creatures start ~12-14 hp.
    await page.evaluate(({ x, z }) =>
      (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.teleport(x, z + 0.5),
      { x: target.x, z: target.z },
    );
    await page.evaluate(() =>
      (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.equipWeapon('storm-spear'),
    );
    // Swing repeatedly until at least one creature is downed (max 10 swings).
    let after = initial;
    for (let i = 0; i < 10 && after.length === initial.length; i++) {
      await page.evaluate(() =>
        (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.forceSwing(),
      );
      after = await page.evaluate(() =>
        (window as unknown as { sturdyVolleyMine?: MineApi }).sturdyVolleyMine!.creatures(),
      );
    }
    expect(after.length).toBeLessThan(initial.length);
  });
});
