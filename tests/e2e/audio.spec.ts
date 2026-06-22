import { test, expect, type Page } from '@playwright/test';

interface CategoryMix {
  volume: number;
  muted: boolean;
}
interface AudioSettings {
  master: CategoryMix;
  music: CategoryMix;
  ambient: CategoryMix;
  sfx: CategoryMix;
  ui: CategoryMix;
}
interface AudioDebug {
  music: () => string | null;
  ambient: () => string[];
  settings: () => AudioSettings;
  setCategoryVolume: (c: string, v: number) => void;
  setCategoryMute: (c: string, b: boolean) => void;
  toggleCategoryMute: (c: string) => void;
}

interface ManagerApi {
  manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> };
}

function di(page: Page) {
  return {
    music: () => page.evaluate(() => (window as unknown as { sturdyVolleyAudio: AudioDebug }).sturdyVolleyAudio.music()),
    ambient: () => page.evaluate(() => (window as unknown as { sturdyVolleyAudio: AudioDebug }).sturdyVolleyAudio.ambient()),
    settings: () => page.evaluate(() => (window as unknown as { sturdyVolleyAudio: AudioDebug }).sturdyVolleyAudio.settings()),
    setMute: (c: string, b: boolean) =>
      page.evaluate((a) => (window as unknown as { sturdyVolleyAudio: AudioDebug }).sturdyVolleyAudio.setCategoryMute(a.c, a.b), { c, b }),
    setVolume: (c: string, v: number) =>
      page.evaluate((a) => (window as unknown as { sturdyVolleyAudio: AudioDebug }).sturdyVolleyAudio.setCategoryVolume(a.c, a.v), { c, v }),
  };
}

async function newGame(page: Page, name = 'Listener'): Promise<void> {
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
  // The audio director installs its debug surface on the Farm's first enter.
  await page.waitForFunction(() => Boolean((window as unknown as { sturdyVolleyAudio?: AudioDebug }).sturdyVolleyAudio));
}

async function gotoScene(page: Page, key: string, data?: unknown): Promise<void> {
  await page.evaluate(
    (a) => (window as unknown as { sturdyVolley?: ManagerApi }).sturdyVolley?.manager.goTo(a.key, a.data, false),
    { key, data },
  );
}

async function resumeAfterReload(page: Page): Promise<void> {
  await page.reload();
  await page.getByTestId('title-continue').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as unknown as { sturdyVolleyAudio?: AudioDebug }).sturdyVolleyAudio));
}

test.describe('Prompt 061 — audio architecture', () => {
  test('music changes by region', async ({ page }) => {
    await newGame(page);
    // Farm soundtrack.
    await page.waitForFunction(() =>
      ((window as unknown as { sturdyVolleyAudio: AudioDebug }).sturdyVolleyAudio.music() ?? '').startsWith('farm-'),
    );

    await gotoScene(page, 'Town');
    await page.waitForFunction(() =>
      ((window as unknown as { sturdyVolleyAudio: AudioDebug }).sturdyVolleyAudio.music() ?? '').startsWith('town-'),
    );

    await gotoScene(page, 'Interior', { entry: 'inside-door' });
    await page.waitForFunction(() =>
      ((window as unknown as { sturdyVolleyAudio: AudioDebug }).sturdyVolleyAudio.music() ?? '').startsWith('hearth-'),
    );
    // Ambience also tracks the region.
    expect(await di(page).ambient()).toContain('hearth-crackle');
  });

  test('audio is mutable by category and the choice persists', async ({ page }) => {
    await newGame(page);
    const d = di(page);
    expect((await d.settings()).music.muted).toBe(false);

    await d.setMute('music', true);
    expect((await d.settings()).music.muted).toBe(true);
    await d.setVolume('ambient', 0.25);
    expect((await d.settings()).ambient.volume).toBeCloseTo(0.25);

    await resumeAfterReload(page);
    const after = await di(page).settings();
    expect(after.music.muted).toBe(true);
    expect(after.ambient.volume).toBeCloseTo(0.25);
  });

  test('the Audio settings panel opens from the pause menu and mutes a category (canonical click path)', async ({ page }) => {
    await newGame(page);
    await page.getByTestId('hud-menu').click();
    await page.getByTestId('pause-audio').click();
    await expect(page.getByTestId('audio-panel')).toBeVisible();

    const muteMusic = page.getByTestId('audio-mute-music');
    await expect(muteMusic).toHaveText('On');
    await muteMusic.click();
    await expect(page.getByTestId('audio-mute-music')).toHaveText('Muted');
    expect((await di(page).settings()).music.muted).toBe(true);

    await page.getByTestId('audio-close').click();
  });
});
