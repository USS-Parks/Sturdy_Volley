import { test, expect } from '@playwright/test';

interface SwapState { active: string; meshName: string; saveId: string; anchorIds: string[]; collisionId: string; navId: string; family: string; modelId: string; dimensions: readonly number[]; sourceRefs: readonly string[]; policy: string }

declare global {
  interface Window {
    sturdyVolleySwap?: {
      meshCount: () => number;
      keys: () => string[];
      state: (key: string) => SwapState | null;
      swap: (key: string) => { ok: boolean; issues: string[]; semanticHeld: boolean };
      revert: (key: string) => boolean;
      swapBad: (key: string) => { ok: boolean; active: string };
    };
  }
}

const boot = async (page: import('@playwright/test').Page) => {
  await page.goto('/?scene=AssetSwapLab');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleySwap?.keys));
};

test.describe('Asset swap factory (WEF-11b)', () => {
  test('boots the five reference fixtures as grayboxes', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await boot(page);
    const keys = await page.evaluate(() => window.sturdyVolleySwap!.keys());
    expect(keys).toEqual(['humanoid', 'animal', 'flora', 'building', 'prop']);
    for (const k of keys) {
      const s = await page.evaluate((key) => window.sturdyVolleySwap!.state(key), k);
      expect(s?.active, `${k} starts as graybox`).toBe('graybox');
      expect(s?.meshName).toBe(`graybox-${k}`);
      expect(s?.modelId).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(s?.dimensions.every((value) => value > 0)).toBe(true);
      expect(s?.sourceRefs.length).toBeGreaterThan(0);
      expect(['visual', 'hybrid', 'foundation']).toContain(s?.policy);
    }

    await page.waitForTimeout(300);
    const shot = await page.screenshot();
    await testInfo.attach(`asset-swap-${testInfo.project.name}`, { body: shot, contentType: 'image/png' });
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('each fixture swaps end to end, preserving anchors/collision/nav/save identity', async ({ page }) => {
    await boot(page);
    for (const key of ['humanoid', 'animal', 'flora', 'building', 'prop']) {
      const result = await page.evaluate((k) => {
        const m = window.sturdyVolleySwap!;
        const before = m.state(k)!;
        const r = m.swap(k);
        const after = m.state(k)!;
        return { r, before, after };
      }, key);
      expect(result.r.ok, `${key} swaps`).toBe(true);
      expect(result.r.semanticHeld, `${key} semantic held`).toBe(true);
      expect(result.after.active).toBe('asset');
      expect(result.after.meshName, `${key} visible mesh changed`).toBe(`asset-${key}`);
      // Identity layer is byte-for-byte unchanged.
      expect(result.after.saveId).toBe(result.before.saveId);
      expect(result.after.collisionId).toBe(result.before.collisionId);
      expect(result.after.navId).toBe(result.before.navId);
      expect(result.after.anchorIds).toEqual(result.before.anchorIds);
    }
  });

  test('swap is reversible — the graybox returns as a fallback', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
      const m = window.sturdyVolleySwap!;
      m.swap('building');
      const reverted = m.revert('building');
      return { reverted, state: m.state('building') };
    });
    expect(r.reverted).toBe(true);
    expect(r.state?.active).toBe('graybox');
    expect(r.state?.meshName).toBe('graybox-building');
  });

  test('a non-conformant asset is refused and the graybox stays', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => window.sturdyVolleySwap!.swapBad('animal'));
    expect(r.ok).toBe(false);
    expect(r.active, 'graybox stays on a refused swap').toBe('graybox');
  });
});
