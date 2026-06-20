import { test, expect } from '@playwright/test';

interface CameraState {
  profileId: string;
  context: string;
  variant: string;
  pitchDeg: number;
  fovDeg: number;
  distance: number;
  yawOffsetDeg: number;
  fade: number;
  recentering: boolean;
  reducedMotion: boolean;
}

declare global {
  interface Window {
    sturdyVolleyLab?: {
      kit: () => string[];
      meshCount: () => number;
      focus: (id: string) => boolean;
      player: () => { x: number; z: number };
      setPlayer: (x: number, z: number) => void;
      setPlayerVelocity: (vx: number, vz: number) => void;
      cameraState: () => CameraState;
      contexts: () => string[];
      variants: (ctx: string) => string[];
      setContext: (ctx: string) => void;
      cycleVariant: () => string;
      nudgeYaw: (rad: number) => void;
      recenter: () => void;
      setReducedMotion: (on: boolean) => void;
    };
  }
}

/** Every station the proving-ground kit must stand up (master Prompt 028). */
const EXPECTED_KIT = [
  'open-ground',
  'farm-grid',
  'narrow-lane',
  'small-room',
  'large-room',
  'roof',
  'tree-canopy',
  'wall-corner',
  'slope',
  'stairs',
  'cliff',
  'shallow-water',
  'doorway',
  'npc-capsule',
  'animal-body',
  'interaction-prop',
  'cave-corridor',
];

test.describe('Camera Lab proving ground (WEF-01a)', () => {
  test('boots via ?scene=CameraLab and renders the full geometry kit', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    // Direct-boot route — works in the production preview build (no dev menu).
    await page.goto('/?scene=CameraLab');
    await expect(page.locator('#game-canvas')).toBeVisible();
    await page.waitForFunction(() => Boolean(window.sturdyVolleyLab?.kit));

    // The kit stands up every required station.
    const kit = await page.evaluate(() => window.sturdyVolleyLab!.kit());
    expect(kit.sort(), 'camera-lab kit stations').toEqual([...EXPECTED_KIT].sort());

    const meshCount = await page.evaluate(() => window.sturdyVolleyLab!.meshCount());
    expect(meshCount, 'kit builds many primitive meshes at scale').toBeGreaterThan(40);

    // Canvas-pixel check: the proving ground actually rendered (not blank).
    await page.waitForTimeout(500);
    const stats = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
      if (!canvas) return { distinct: 0, nonBlackRatio: 0 };
      const off = document.createElement('canvas');
      off.width = 48;
      off.height = 48;
      const ctx = off.getContext('2d');
      if (!ctx) return { distinct: 0, nonBlackRatio: 0 };
      ctx.drawImage(canvas, 0, 0, 48, 48);
      const data = ctx.getImageData(0, 0, 48, 48).data;
      const colors = new Set<string>();
      let nonBlack = 0;
      for (let i = 0; i < data.length; i += 4) {
        colors.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`);
        if (data[i] + data[i + 1] + data[i + 2] > 40) nonBlack += 1;
      }
      return { distinct: colors.size, nonBlackRatio: nonBlack / (48 * 48) };
    });
    expect(stats.distinct, 'distinct colors in proving-ground canvas').toBeGreaterThan(4);
    expect(stats.nonBlackRatio, 'non-black pixel ratio').toBeGreaterThan(0.25);

    // Reproducible screenshot route: one labelled capture per Playwright project
    // (desktop-chromium + mobile-chromium / Pixel 5), attached to the report.
    const shot = await page.screenshot();
    await testInfo.attach(`camera-lab-${testInfo.project.name}`, { body: shot, contentType: 'image/png' });

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('focus() reframes the camera onto a named station', async ({ page }) => {
    await page.goto('/?scene=CameraLab');
    await page.waitForFunction(() => Boolean(window.sturdyVolleyLab?.focus));
    const ok = await page.evaluate(() => window.sturdyVolleyLab!.focus('farm-grid'));
    expect(ok, 'focus a known station').toBe(true);
    const moved = await page.evaluate(() => window.sturdyVolleyLab!.player());
    expect(moved.x, 'player teleported toward the farm-grid station').toBeLessThan(-5);
    const miss = await page.evaluate(() => window.sturdyVolleyLab!.focus('nope'));
    expect(miss, 'focus an unknown station fails cleanly').toBe(false);
  });

  test('every §2 context exposes ≥3 variants switchable live', async ({ page }) => {
    await page.goto('/?scene=CameraLab');
    await page.waitForFunction(() => Boolean(window.sturdyVolleyLab?.cameraState));

    const contexts = await page.evaluate(() => window.sturdyVolleyLab!.contexts());
    expect(contexts.length, 'all §2 contexts present').toBeGreaterThanOrEqual(7);

    for (const ctx of contexts) {
      const variants = await page.evaluate((c) => window.sturdyVolleyLab!.variants(c), ctx);
      expect(variants.length, `${ctx} has ≥3 variants`).toBeGreaterThanOrEqual(3);
    }

    // Switching context is reflected in live rig state.
    await page.evaluate(() => window.sturdyVolleyLab!.setContext('cave'));
    let state = await page.evaluate(() => window.sturdyVolleyLab!.cameraState());
    expect(state.context, 'context switched to cave').toBe('cave');

    // Cycling the variant changes the active profile.
    const before = state.variant;
    const after = await page.evaluate(() => window.sturdyVolleyLab!.cycleVariant());
    expect(after, 'cycleVariant returns a profile id').toContain('cave:');
    state = await page.evaluate(() => window.sturdyVolleyLab!.cameraState());
    expect(state.variant, 'variant changed after cycle').not.toBe(before);
  });

  test('manual orbit is constrained to the profile yaw limit, and recenter returns to rest', async ({ page }) => {
    await page.goto('/?scene=CameraLab');
    await page.waitForFunction(() => Boolean(window.sturdyVolleyLab?.cameraState));

    // Farm context: ±60° orbit limit. Player at origin = outside all volumes.
    await page.evaluate(() => {
      window.sturdyVolleyLab!.setPlayer(0, 0);
      window.sturdyVolleyLab!.setContext('farm');
      window.sturdyVolleyLab!.nudgeYaw(10); // far past the limit
    });
    await page.waitForTimeout(150);
    let state = await page.evaluate(() => window.sturdyVolleyLab!.cameraState());
    expect(Math.abs(state.yawOffsetDeg), 'orbit clamped to ±60°').toBeLessThanOrEqual(62);
    expect(Math.abs(state.yawOffsetDeg), 'orbit actually moved').toBeGreaterThan(5);

    // Recenter returns the manual offset to ~0.
    await page.evaluate(() => window.sturdyVolleyLab!.recenter());
    await page.waitForTimeout(1200);
    state = await page.evaluate(() => window.sturdyVolleyLab!.cameraState());
    expect(Math.abs(state.yawOffsetDeg), 'recentered to rest').toBeLessThan(2);
  });
});
