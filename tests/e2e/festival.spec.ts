import { test, expect, type Page } from '@playwright/test';
// Casts to local types (not Window globals) so this spec never collides with the
// sturdyVolleyTown / sturdyVolleyDebug declarations other specs own.

interface TownFestivalDebug {
  targets: () => Array<{ id: string; label: string }>;
  npcs: () => Array<{ id: string; pos: { x: number; z: number }; sceneKey: string }>;
  setDate: (season: string, day: number) => void;
  festivalToday: () => { id: string; name: string } | null;
  festivalActiveNow: () => boolean;
  festivalScheduleId: () => string | null;
  festivalDressingVisible: () => boolean;
  openFestival: () => void;
  playMinigameToWin: () => { won: boolean; score: number; granted: boolean; rewardSummary: string | null };
  stallRows: () => Array<{ itemId: string; name: string; price: number }>;
  buyStall: (itemId: string) => { bought: boolean; reason?: string; price: number };
  shareMoment: () => { claimed: boolean; npcId: string | null; rewardSummary: string | null };
  walletGold: () => number;
  // Prompt 057 — phase two.
  setRelationship: (npcId: string, points: number) => void;
  completeRestoration: () => void;
  setYear: (year: number) => void;
  festivalYearTwoDressingVisible: () => boolean;
}

interface ManagerApi {
  manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> };
}

async function newGame(page: Page, name = 'Festival'): Promise<void> {
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
  } catch {
    /* no cutscene */
  }
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.controller));
}

async function gotoTown(page: Page): Promise<void> {
  await page.evaluate(() =>
    (window as unknown as { sturdyVolley?: ManagerApi }).sturdyVolley?.manager.goTo('Town', undefined, false),
  );
  await page.waitForFunction(() =>
    Boolean((window as unknown as { sturdyVolleyTown?: TownFestivalDebug }).sturdyVolleyTown?.setDate),
  );
}

/** Jump the active save to the Spring Seed Blessing (spring day 13). */
async function gotoSeedBlessing(page: Page): Promise<void> {
  await page.evaluate(() =>
    (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.setDate('spring', 13),
  );
}

test.describe('Prompt 056 — festivals phase one', () => {
  test('an ordinary day has no festival; the festival day raises dressing + schedule + stage', async ({ page }) => {
    await newGame(page);
    await gotoTown(page);

    // Day 1 (spring) is not a festival.
    expect(await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.festivalToday())).toBeNull();

    await gotoSeedBlessing(page);

    const today = await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.festivalToday());
    expect(today?.id).toBe('seed-blessing');

    // Schedules altered: the byFestival layer is active (the schedule-change driver).
    const scheduleId = await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.festivalScheduleId());
    expect(scheduleId).toBe('seed-blessing');

    // Map setup: the festival dressing is visible.
    expect(await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.festivalDressingVisible())).toBe(true);

    // The festival stage is a reachable interaction target.
    const targets = await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.targets());
    expect(targets.some((t) => t.id === 'festival-stage')).toBe(true);

    // Shops altered: regular storefronts read "closed for the festival".
    expect(targets.some((t) => t.id.startsWith('door:') && t.label.includes('closed for the festival'))).toBe(true);
  });

  test('the festival hub opens with a minigame, a stall, and a relationship moment', async ({ page }) => {
    await newGame(page);
    await gotoTown(page);
    await gotoSeedBlessing(page);

    await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.openFestival());
    await expect(page.getByTestId('festival-panel')).toBeVisible();
    await expect(page.getByTestId('festival-minigame-card')).toBeVisible();
    await expect(page.getByTestId('festival-stall-card')).toBeVisible();
    await expect(page.getByTestId('festival-relationship-card')).toBeVisible();
  });

  test('playing the minigame to a win in the UI grants the festival prize', async ({ page }) => {
    await newGame(page);
    await gotoTown(page);
    await gotoSeedBlessing(page);

    const before = await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.walletGold());

    await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.openFestival());
    await page.getByTestId('festival-play-minigame').click();
    await expect(page.getByTestId('festival-minigame')).toBeVisible();
    await expect(page.locator('[data-testid^="festival-slot-"]').first()).toBeVisible();

    // Tap the lit slot every round (deterministic) until the prize is awarded.
    for (let i = 0; i < 15; i++) {
      if ((await page.getByTestId('festival-minigame-reward').count()) > 0) break;
      const active = page.locator('[data-testid^="festival-slot-"][data-active="1"]').first();
      if ((await active.count()) === 0) break;
      await active.click();
    }

    await expect(page.getByTestId('festival-minigame-status')).toContainText('won');
    await expect(page.getByTestId('festival-minigame-reward')).toContainText('g');

    const after = await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.walletGold());
    expect(after).toBeGreaterThanOrEqual(before + 150);
  });

  test('the festival prize is granted once per year via the engine', async ({ page }) => {
    await newGame(page);
    await gotoTown(page);
    await gotoSeedBlessing(page);

    const first = await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.playMinigameToWin());
    expect(first.won).toBe(true);
    expect(first.granted).toBe(true);

    // A second win the same year grants nothing.
    const second = await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.playMinigameToWin());
    expect(second.won).toBe(true);
    expect(second.granted).toBe(false);
  });

  test('the festival stall sells special stock and the relationship moment can be shared', async ({ page }) => {
    await newGame(page);
    await gotoTown(page);
    await gotoSeedBlessing(page);

    const stall = await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.stallRows());
    expect(stall.length).toBeGreaterThanOrEqual(1);
    const itemId = stall[0]!.itemId;

    const buy = await page.evaluate(
      (id) => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.buyStall(id),
      itemId,
    );
    expect(buy.bought).toBe(true);

    const shared = await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.shareMoment());
    expect(shared.claimed).toBe(true);
    expect(shared.npcId).toBe('sol-aranda');

    // Sharing again the same year is a no-op.
    const again = await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.shareMoment());
    expect(again.claimed).toBe(false);
  });
});

test.describe('Prompt 057 — festivals phase two', () => {
  test('a phase-two festival (Marsh Chorus) is reachable and winnable', async ({ page }) => {
    await newGame(page);
    await gotoTown(page);
    await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.setDate('spring', 24));

    const today = await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.festivalToday());
    expect(today?.id).toBe('marsh-chorus');

    const win = await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.playMinigameToWin());
    expect(win.won).toBe(true);
    expect(win.granted).toBe(true);
  });

  test('the Founders Harvest Fair is gated until restoration + relationship arc are met', async ({ page }) => {
    await newGame(page);
    await gotoTown(page);

    // Winter 25 with no restoration done → the Founders Fair is not available.
    await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.setDate('winter', 25));
    expect(await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.festivalToday())).toBeNull();

    // Complete the restoration trio + build the relationship arc, then re-resolve.
    await page.evaluate(() => {
      const d = (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown;
      d.completeRestoration();
      d.setRelationship('mara-vale', 1000);
      d.setDate('winter', 25);
    });

    const today = await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.festivalToday());
    expect(today?.id).toBe('founders-harvest-fair');

    const win = await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.playMinigameToWin());
    expect(win.won).toBe(true);
    expect(win.granted).toBe(true);
  });

  test('a year-two festival raises the commemorative dressing', async ({ page }) => {
    await newGame(page);
    await gotoTown(page);

    // Year one Marsh Chorus: no year-two dressing.
    await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.setDate('spring', 24));
    expect(await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.festivalYearTwoDressingVisible())).toBe(false);

    // Year two: the commemorative dressing comes up, festival still resolves.
    await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.setYear(2));
    const today = await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.festivalToday());
    expect(today?.id).toBe('marsh-chorus');
    expect(await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownFestivalDebug }).sturdyVolleyTown.festivalYearTwoDressingVisible())).toBe(true);
  });
});
