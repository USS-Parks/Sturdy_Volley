import { test, expect, type Page } from '@playwright/test';
// Casts to local types (not Window globals) so this spec never collides with the
// sturdyVolleyTown / sturdyVolleyDebug declarations other specs own.

interface TownDebug {
  projects: () => Array<{ id: string; name: string; complete: boolean; phaseIndex: number; phaseCount: number }>;
  targets: () => Array<{ id: string; label: string }>;
  openCivicBoard: () => void;
  contributeProject: (id: string, reqIndex: number) => { accepted: number; completed: string | null };
  completedFlags: () => string[];
  civicMeshVisible: (id: string) => boolean;
  grantItem: (itemId: string, qty: number) => void;
  setRelationship: (npcId: string, points: number) => void;
}

interface ManagerApi {
  manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> };
}

async function newGame(page: Page, name = 'Civic'): Promise<void> {
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
    Boolean((window as unknown as { sturdyVolleyTown?: TownDebug }).sturdyVolleyTown?.projects),
  );
}

test.describe('Prompt 055 — community restoration projects', () => {
  test('the town has a civic board listing the restoration projects', async ({ page }) => {
    await newGame(page);
    await gotoTown(page);

    const projects = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyTown: TownDebug }).sturdyVolleyTown.projects(),
    );
    expect(projects.length, 'at least 3 projects').toBeGreaterThanOrEqual(3);
    expect(projects.every((p) => !p.complete)).toBe(true);

    const targets = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyTown: TownDebug }).sturdyVolleyTown.targets(),
    );
    expect(targets.some((t) => t.id === 'civic-board'), 'civic board is reachable').toBe(true);

    await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownDebug }).sturdyVolleyTown.openCivicBoard());
    await expect(page.getByTestId('civic-panel')).toBeVisible();
    expect(await page.locator('[data-testid^="civic-row-"]').count()).toBeGreaterThanOrEqual(3);
    await page.getByTestId('civic-close').click();
  });

  test('completing a project alters the map, runs a ceremony, and flags the schedule change', async ({ page }) => {
    await newGame(page);
    await gotoTown(page);

    // Stock the player for the Netlight Beacon (items + gold + a relationship gate).
    await page.evaluate(() => {
      const d = (window as unknown as { sturdyVolleyTown: TownDebug }).sturdyVolleyTown;
      d.grantItem('driftwood', 8);
      d.grantItem('iron-ore', 4);
      d.grantItem('tide-shell', 6);
      d.setRelationship('mara-vale', 100); // level 1 — satisfies the phase-2 gate
    });

    // Phase 1: driftwood (req 0) + 200 gold (req 1) → advances to phase 2.
    await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownDebug }).sturdyVolleyTown.contributeProject('netlight-beacon', 0));
    await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownDebug }).sturdyVolleyTown.contributeProject('netlight-beacon', 1));
    const phaseIndex = await page.evaluate(
      () =>
        (window as unknown as { sturdyVolleyTown: TownDebug }).sturdyVolleyTown
          .projects()
          .find((p) => p.id === 'netlight-beacon')?.phaseIndex,
    );
    expect(phaseIndex).toBe(1);

    // Phase 2: iron-ore (req 0) + tide-shell (req 1); the relationship gate (req 2) is already met → completes.
    await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownDebug }).sturdyVolleyTown.contributeProject('netlight-beacon', 0));
    const result = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyTown: TownDebug }).sturdyVolleyTown.contributeProject('netlight-beacon', 1),
    );
    expect(result.completed).toBe('netlight-beacon');

    // Visible map change: the beacon mesh is now shown.
    const meshVisible = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyTown: TownDebug }).sturdyVolleyTown.civicMeshVisible('netlight-beacon'),
    );
    expect(meshVisible).toBe(true);

    // Schedule-change driver: the completion flag is active (feeds the byEvent layer).
    const flags = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyTown: TownDebug }).sturdyVolleyTown.completedFlags(),
    );
    expect(flags).toContain('civic:netlight-beacon');

    const complete = await page.evaluate(
      () =>
        (window as unknown as { sturdyVolleyTown: TownDebug }).sturdyVolleyTown
          .projects()
          .find((p) => p.id === 'netlight-beacon')?.complete,
    );
    expect(complete).toBe(true);

    // Opening ceremony with NPC reactions appears.
    await expect(page.getByTestId('ceremony-panel')).toBeVisible();
    expect(await page.locator('[data-testid="ceremony-reactions"] li').count()).toBeGreaterThanOrEqual(1);
  });

  test('the board Give button contributes from the player inventory', async ({ page }) => {
    await newGame(page);
    await gotoTown(page);
    await page.evaluate(() =>
      (window as unknown as { sturdyVolleyTown: TownDebug }).sturdyVolleyTown.grantItem('driftwood-plank', 6),
    );

    await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownDebug }).sturdyVolleyTown.openCivicBoard());
    await expect(page.getByTestId('civic-row-market-canopies')).toBeVisible();
    // Phase-1 requirement 0 (driftwood-plank) starts unmet → has a Give button.
    await expect(page.getByTestId('civic-give-market-canopies-0')).toBeVisible();

    await page.getByTestId('civic-give-market-canopies-0').click();

    // After giving 6 planks the requirement is met → the Give button is gone.
    await expect(page.getByTestId('civic-give-market-canopies-0')).toHaveCount(0);
    await expect(page.getByTestId('civic-req-market-canopies-0')).toContainText('6/6');
  });
});
