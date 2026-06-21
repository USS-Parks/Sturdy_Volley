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
      machines: () => Record<string, { kind: string; status: string; recipeIndex: number | null }>;
      openMachine: (id: string) => void;
      grantItem: (itemId: string, qty: number) => void;
      fastForwardMinutes: (minutes: number) => void;
      animals: () => Record<string, { name: string; kind: string; hearts: number; fedToday: boolean; pettedToday: boolean; outside: boolean }>;
      petAnimal: (id: string) => void;
      feedAnimal: (id: string) => void;
      openAnimalPanel: () => void;
      pet: () => null | { name: string; kind: string; affection: number; pettedToday: boolean; bowlFilledToday: boolean; collar: 'red'|'kelp'|'shell'|null; x: number; z: number; perk: 'comfort'|'forage-sniff'|null };
      openPetPanel: () => void;
      setPetAffection: (value: number) => void;
      // Prompt 054 — quest system.
      quests: () => Array<{ id: string; name: string; status: string; objectives: Array<{ current: number; target: number; done: boolean }> }>;
      openQuestPanel: () => void;
      recordQuestEvent: (kind: string, target: string | null, qty?: number) => string[];
      acceptQuest: (id: string) => void;
      cancelQuest: (id: string) => void;
      // Test hooks that drive a panel action without a canvas-load-fragile click.
      swapPetKind: () => void;
      dismissDaySummary: () => boolean;
    };
  }
}

async function dismissFirstMorningCutscene(page: import('@playwright/test').Page): Promise<void> {
  const skip = page.getByTestId('cutscene-skip');
  try {
    await skip.waitFor({ state: 'visible', timeout: 4000 });
    await skip.click();
    await skip.waitFor({ state: 'hidden', timeout: 4000 });
  } catch {
    // Cutscene already dismissed or never mounted — fine.
  }
}

async function newGame(page: import('@playwright/test').Page, name = 'Wren'): Promise<void> {
  await page.goto('/');
  await page.getByTestId('title-start').click();
  await page.getByTestId('field-name').fill(name);
  await page.getByTestId('form-submit').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  // RF-14: dismiss the Day-1 first-morning cutscene before gameplay starts.
  await dismissFirstMorningCutscene(page);
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
