import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    sturdyVolleyDebug?: {
      player: () => { x: number; z: number };
      controller: () => { stamina: number; gait: string; target: string | null; tool: string };
      time: () => { minutes: number; paused: boolean; scale: number; clock: string };
      setTimeScale: (scale: number) => void;
      sleep: () => void;
      openInventory: () => void;
      shippingBinSlots: () => Array<{ itemId: string; qty: number; quality: number } | null>;
      hotbarSlots: () => Array<{ itemId: string; qty: number; quality: number } | null>;
      shipPrototypeSeeds: () => void;
      worldEntities: () => Record<string, { kind: string; itemId: string | null; age: number }>;
      warpToEntity: (suffix: string) => boolean;
      entityAnchors: () => Record<string, { x: number; z: number }>;
    };
  }
}

async function newGame(page: import('@playwright/test').Page, name = 'Wren'): Promise<void> {
  await page.goto('/');
  await page.getByTestId('title-start').click();
  await page.getByTestId('field-name').fill(name);
  await page.getByTestId('form-submit').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.controller));
}

test.describe('Breakpoint Farm (3D)', () => {
  test('player walks with the keyboard', async ({ page }) => {
    await newGame(page);
    const before = await page.evaluate(() => window.sturdyVolleyDebug!.player());
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowUp');
    const after = await page.evaluate(() => window.sturdyVolleyDebug!.player());
    const dist = Math.hypot(after.x - before.x, after.z - before.z);
    expect(dist, `player should move; moved ${dist.toFixed(2)} units`).toBeGreaterThan(0.5);
  });

  test('sprinting drains energy', async ({ page }) => {
    await newGame(page, 'Mica');
    const before = await page.evaluate(() => window.sturdyVolleyDebug!.controller().stamina);
    await page.keyboard.down('Shift');
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(600);
    await page.keyboard.up('ArrowUp');
    await page.keyboard.up('Shift');
    const after = await page.evaluate(() => window.sturdyVolleyDebug!.controller().stamina);
    expect(after, `energy should drop while sprinting (before ${before}, after ${after})`).toBeLessThan(before);
  });
});
