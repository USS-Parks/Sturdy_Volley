import { test, expect, type Page } from '@playwright/test';
// Local interface casts (not Window globals) so this spec never collides with the
// sturdyVolleyDebug / sturdyVolleyTown declarations other specs own.

interface FarmMailDebug {
  mailUnread: () => number;
  mailRows: () => Array<{ id: string; sender: string; subject: string; read: boolean }>;
  openMailbox: () => void;
  readMail: (id: string) => { read: boolean; attachmentSummary: string; startedQuestId: string | null };
  deliverMail: () => string[];
  setFlag: (flag: string, value: boolean) => void;
  grantItem: (itemId: string, qty: number) => void;
}

interface TownNoticeDebug {
  openNoticeBoard: () => void;
  noticeBoard: () => { forecast: string[]; requests: string[]; news: string[]; summary: string } | null;
}

interface ManagerApi {
  manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> };
}

function farm(page: Page) {
  return page.evaluate(() => (window as unknown as { sturdyVolleyDebug: FarmMailDebug }).sturdyVolleyDebug.mailRows());
}

async function newGame(page: Page, name = 'Mail'): Promise<void> {
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
  await page.waitForFunction(() => Boolean((window as unknown as { sturdyVolleyDebug?: FarmMailDebug }).sturdyVolleyDebug?.mailRows));
}

test.describe('Prompt 058 — mail, news & world reactivity', () => {
  test('the welcome letter is delivered on day one and grants its attachments + quest', async ({ page }) => {
    await newGame(page);

    expect(await page.evaluate(() => (window as unknown as { sturdyVolleyDebug: FarmMailDebug }).sturdyVolleyDebug.mailUnread())).toBeGreaterThan(0);
    const rows = await farm(page);
    expect(rows.some((r) => r.id === 'welcome-to-breakpoint')).toBe(true);

    // Reading the welcome letter grants the seeds AND starts the first-harvest quest.
    const read = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyDebug: FarmMailDebug }).sturdyVolleyDebug.readMail('welcome-to-breakpoint'),
    );
    expect(read.read).toBe(true);
    expect(read.attachmentSummary).toContain('Bell Pea Seeds');
    expect(read.startedQuestId).toBe('first-harvest');

    // Re-reading grants nothing.
    const again = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyDebug: FarmMailDebug }).sturdyVolleyDebug.readMail('welcome-to-breakpoint'),
    );
    expect(again.read).toBe(false);
  });

  test('the mailbox panel opens and lists delivered letters', async ({ page }) => {
    await newGame(page);
    await page.evaluate(() => (window as unknown as { sturdyVolleyDebug: FarmMailDebug }).sturdyVolleyDebug.openMailbox());
    await expect(page.getByTestId('mailbox-panel')).toBeVisible();
    expect(await page.locator('[data-testid^="mail-row-"]').count()).toBeGreaterThanOrEqual(1);
    // Opening a letter shows the read view.
    await page.getByTestId('mail-open-welcome-to-breakpoint').click();
    await expect(page.getByTestId('letter-panel')).toBeVisible();
    await expect(page.getByTestId('letter-attachment')).toContainText('Bell Pea Seeds');
    await page.getByTestId('letter-back').click();
    await expect(page.getByTestId('mailbox-panel')).toBeVisible();
  });

  test('a flag-triggered lost-and-found letter returns the lost item', async ({ page }) => {
    await newGame(page);
    // Arm the lost-and-found flag, then deliver — the letter shows up.
    const delivered = await page.evaluate(() => {
      const d = (window as unknown as { sturdyVolleyDebug: FarmMailDebug }).sturdyVolleyDebug;
      d.setFlag('lost-and-found-shell', true);
      return d.deliverMail();
    });
    expect(delivered).toContain('lost-and-found-shell');
    const read = await page.evaluate(() =>
      (window as unknown as { sturdyVolleyDebug: FarmMailDebug }).sturdyVolleyDebug.readMail('lost-and-found-shell'),
    );
    expect(read.read).toBe(true);
    expect(read.attachmentSummary).toContain('Tide Shell');
  });

  test('the town notice board reacts to the world with a forecast, reasons to visit, and news', async ({ page }) => {
    await newGame(page);
    await page.evaluate(() =>
      (window as unknown as { sturdyVolley?: ManagerApi }).sturdyVolley?.manager.goTo('Town', undefined, false),
    );
    await page.waitForFunction(() =>
      Boolean((window as unknown as { sturdyVolleyTown?: TownNoticeDebug }).sturdyVolleyTown?.noticeBoard),
    );

    const board = await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownNoticeDebug }).sturdyVolleyTown.noticeBoard());
    expect(board).not.toBeNull();
    expect(board!.forecast.length).toBe(2); // today + tomorrow
    expect(board!.news.length).toBeGreaterThanOrEqual(1);

    await page.evaluate(() => (window as unknown as { sturdyVolleyTown: TownNoticeDebug }).sturdyVolleyTown.openNoticeBoard());
    await expect(page.getByTestId('notice-panel')).toBeVisible();
    expect(await page.locator('[data-testid="notice-forecast"] li').count()).toBe(2);
    await page.getByTestId('notice-close').click();
  });
});
