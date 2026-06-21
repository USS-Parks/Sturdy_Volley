import { test, expect, type Page } from '@playwright/test';
// Local interface cast (not a Window global) so this spec never collides with the
// sturdyVolleyInterior declaration other specs own (Prompt 059 handoff §3).

interface HomeDebug {
  gold: () => number;
  grantGold: (amount: number) => void;
  openHome: () => void;
  placeFurniture: (furnitureId: string, x: number, z: number, rot?: number) => { placed: boolean };
  pickUpLastPlacement: () => { removed: boolean };
  placedDecor: () => Array<{ id: string; itemId: string; x: number; z: number; rot?: number }>;
  setWallpaper: (id: string) => void;
  setFlooring: (id: string) => void;
  homeSurfaces: () => { wallpaper: string; flooring: string; renovations: string[] };
  buyRenovation: (id: string) => { built: boolean };
  setAppearancePart: (part: string, swatchId: string) => void;
  appearance: () => { body: string; beanie: string; accent: string };
  playerBodyColorHex: () => string;
  enterPhotoMode: () => void;
  exitPhotoMode: () => void;
  photoModeActive: () => boolean;
  capturePhoto: () => Promise<boolean>;
}

interface ManagerApi {
  manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> };
}

function di(page: Page) {
  // Typed handles onto the per-scene debug API. Each method is a self-contained
  // arrow so Playwright can serialize it into the page.
  return {
    gold: () => page.evaluate(() => (window as unknown as { sturdyVolleyInterior: HomeDebug }).sturdyVolleyInterior.gold()),
    grantGold: (n: number) =>
      page.evaluate((amount) => (window as unknown as { sturdyVolleyInterior: HomeDebug }).sturdyVolleyInterior.grantGold(amount), n),
    openHome: () => page.evaluate(() => (window as unknown as { sturdyVolleyInterior: HomeDebug }).sturdyVolleyInterior.openHome()),
    place: (id: string, x: number, z: number) =>
      page.evaluate(
        (a) => (window as unknown as { sturdyVolleyInterior: HomeDebug }).sturdyVolleyInterior.placeFurniture(a.id, a.x, a.z, 0),
        { id, x, z },
      ),
    pickUpLast: () =>
      page.evaluate(() => (window as unknown as { sturdyVolleyInterior: HomeDebug }).sturdyVolleyInterior.pickUpLastPlacement()),
    placedDecor: () =>
      page.evaluate(() => (window as unknown as { sturdyVolleyInterior: HomeDebug }).sturdyVolleyInterior.placedDecor()),
    setWallpaper: (id: string) =>
      page.evaluate((a) => (window as unknown as { sturdyVolleyInterior: HomeDebug }).sturdyVolleyInterior.setWallpaper(a), id),
    setFlooring: (id: string) =>
      page.evaluate((a) => (window as unknown as { sturdyVolleyInterior: HomeDebug }).sturdyVolleyInterior.setFlooring(a), id),
    surfaces: () =>
      page.evaluate(() => (window as unknown as { sturdyVolleyInterior: HomeDebug }).sturdyVolleyInterior.homeSurfaces()),
    buyRenovation: (id: string) =>
      page.evaluate((a) => (window as unknown as { sturdyVolleyInterior: HomeDebug }).sturdyVolleyInterior.buyRenovation(a), id),
    setAppearance: (part: string, swatch: string) =>
      page.evaluate(
        (a) => (window as unknown as { sturdyVolleyInterior: HomeDebug }).sturdyVolleyInterior.setAppearancePart(a.part, a.swatch),
        { part, swatch },
      ),
    appearance: () =>
      page.evaluate(() => (window as unknown as { sturdyVolleyInterior: HomeDebug }).sturdyVolleyInterior.appearance()),
    bodyColor: () =>
      page.evaluate(() => (window as unknown as { sturdyVolleyInterior: HomeDebug }).sturdyVolleyInterior.playerBodyColorHex()),
    enterPhoto: () =>
      page.evaluate(() => (window as unknown as { sturdyVolleyInterior: HomeDebug }).sturdyVolleyInterior.enterPhotoMode()),
    exitPhoto: () =>
      page.evaluate(() => (window as unknown as { sturdyVolleyInterior: HomeDebug }).sturdyVolleyInterior.exitPhotoMode()),
    photoActive: () =>
      page.evaluate(() => (window as unknown as { sturdyVolleyInterior: HomeDebug }).sturdyVolleyInterior.photoModeActive()),
    capture: () =>
      page.evaluate(() => (window as unknown as { sturdyVolleyInterior: HomeDebug }).sturdyVolleyInterior.capturePhoto()),
  };
}

async function newGame(page: Page, name = 'Decorator'): Promise<void> {
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

async function gotoFarmhouse(page: Page): Promise<void> {
  await page.evaluate(() =>
    (window as unknown as { sturdyVolley?: ManagerApi }).sturdyVolley?.manager.goTo('Interior', { entry: 'inside-door' }, false),
  );
  await page.waitForFunction(() =>
    Boolean((window as unknown as { sturdyVolleyInterior?: HomeDebug }).sturdyVolleyInterior?.openHome),
  );
}

async function resumeAfterReload(page: Page): Promise<void> {
  await page.reload();
  await page.getByTestId('title-continue').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() =>
    Boolean((window as unknown as { sturdyVolleyInterior?: HomeDebug }).sturdyVolleyInterior?.openHome),
  );
}

test.describe('Prompt 060 — home, decor, and customization', () => {
  test('buying + placing furniture deducts gold and survives a reload', async ({ page }) => {
    await newGame(page);
    await gotoFarmhouse(page);
    const d = di(page);

    const goldBefore = await d.gold();
    expect((await d.place('rush-stool', 1.5, -1)).placed).toBe(true);
    expect((await d.placedDecor()).some((p) => p.itemId === 'rush-stool')).toBe(true);
    expect(await d.gold()).toBe(goldBefore - 90); // rush-stool costs 90 g

    await resumeAfterReload(page);
    expect((await di(page).placedDecor()).some((p) => p.itemId === 'rush-stool')).toBe(true);
  });

  test('picking a piece back up removes it', async ({ page }) => {
    await newGame(page);
    await gotoFarmhouse(page);
    const d = di(page);
    await d.place('potted-fern', 0, 2);
    expect((await d.placedDecor()).length).toBeGreaterThan(0);
    expect((await d.pickUpLast()).removed).toBe(true);
    expect(await d.placedDecor()).toHaveLength(0);
  });

  test('wallpaper + flooring choices apply and persist', async ({ page }) => {
    await newGame(page);
    await gotoFarmhouse(page);
    const d = di(page);
    await d.setWallpaper('navy-panel');
    await d.setFlooring('slate-tile');
    let s = await d.surfaces();
    expect(s.wallpaper).toBe('navy-panel');
    expect(s.flooring).toBe('slate-tile');

    await resumeAfterReload(page);
    s = await di(page).surfaces();
    expect(s.wallpaper).toBe('navy-panel');
    expect(s.flooring).toBe('slate-tile');
  });

  test('a renovation is bought once with gold and recorded', async ({ page }) => {
    await newGame(page);
    await gotoFarmhouse(page);
    const d = di(page);
    await d.grantGold(1000);
    expect((await d.buyRenovation('loft-shelf')).built).toBe(true);
    expect((await d.surfaces()).renovations).toContain('loft-shelf');
    expect((await d.buyRenovation('loft-shelf')).built).toBe(false); // already built
  });

  test('changing appearance after start recolors the player and persists', async ({ page }) => {
    await newGame(page);
    await gotoFarmhouse(page);
    const d = di(page);
    const before = await d.bodyColor();
    await d.setAppearance('body', 'olive-shirt');
    expect((await d.appearance()).body).toBe('olive-shirt');
    expect(await d.bodyColor()).not.toBe(before);

    await resumeAfterReload(page);
    expect((await di(page).appearance()).body).toBe('olive-shirt');
  });

  test('photo mode hides the HUD, captures, and exits', async ({ page }) => {
    await newGame(page);
    await gotoFarmhouse(page);
    const d = di(page);
    await d.enterPhoto();
    expect(await d.photoActive()).toBe(true);
    await expect(page.getByTestId('photo-bar')).toBeVisible();
    await expect(page.getByTestId('hud-menu')).toHaveCount(0); // HUD hidden for a clean shot

    // Capture returns a boolean (true where the browser permits) and never throws.
    expect(typeof (await d.capture())).toBe('boolean');

    await d.exitPhoto();
    expect(await d.photoActive()).toBe(false);
  });

  test('the Home panel UI opens, switches tabs, and places a piece (canonical click path)', async ({ page }) => {
    await newGame(page);
    await gotoFarmhouse(page);
    const d = di(page);
    await d.openHome();
    await expect(page.getByTestId('home-panel')).toBeVisible();

    // Switch to Surfaces and pick a wall finish through the DOM.
    await page.getByTestId('home-tab-surfaces').click();
    await page.getByTestId('home-wallpaper-sage-wash').click();
    expect((await d.surfaces()).wallpaper).toBe('sage-wash');

    // Back to Decorate; place a stool via the placement bar's Place button.
    await page.getByTestId('home-tab-decorate').click();
    await page.getByTestId('home-place-rush-stool').click();
    await expect(page.getByTestId('placement-bar')).toBeVisible();
    await page.getByTestId('placement-confirm').click();
    expect((await d.placedDecor()).some((p) => p.itemId === 'rush-stool')).toBe(true);
  });
});
