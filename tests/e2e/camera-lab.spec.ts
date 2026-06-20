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
  obstructionMode: 'fade' | 'cutaway';
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
      setObstructionMode: (mode: 'fade' | 'cutaway') => void;
      baselines: () => Record<string, string>;
      playerScreen: () => { x: number; y: number; onScreen: boolean };
      dropPlayer: (x: number, y: number, z: number) => void;
      motor: () => { x: number; y: number; z: number; grounded: boolean; velocityY: number; facingDeg: number };
      controller: () => { stamina: number; gait: string; speed: number };
      physicsBackend: () => string;
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

  test('locks one baseline per context with the recorded values (WEF-01c)', async ({ page }) => {
    await page.goto('/?scene=CameraLab');
    await page.waitForFunction(() => Boolean(window.sturdyVolleyLab?.baselines));

    const baselines = await page.evaluate(() => window.sturdyVolleyLab!.baselines());
    expect(Object.keys(baselines).length, 'a baseline per §2 context').toBeGreaterThanOrEqual(7);
    for (const id of Object.values(baselines)) expect(id).toContain(':standard');

    // The live rig converges to the recorded downward view / FOV / distance.
    const cases: Array<[string, number, number, number]> = [
      ['exterior', 31, 47, 9.5],
      ['farm', 42, 45, 9],
      ['mounted', 29, 49, 10.5],
    ];
    for (const [ctx, pitch, fov, dist] of cases) {
      await page.evaluate((c) => {
        window.sturdyVolleyLab!.setPlayer(0, 0);
        window.sturdyVolleyLab!.setContext(c);
      }, ctx);
      await page.waitForTimeout(1000); // let the beta/fov blend fully settle
      const s = await page.evaluate(() => window.sturdyVolleyLab!.cameraState());
      expect(s.pitchDeg, `${ctx} downward view`).toBeCloseTo(pitch, 0);
      expect(s.fovDeg, `${ctx} FOV`).toBeCloseTo(fov, 0);
      expect(s.distance, `${ctx} follow distance`).toBeCloseTo(dist, 0);
    }
  });

  test('reduced motion and the obstruction-mode fallback are switchable', async ({ page }) => {
    await page.goto('/?scene=CameraLab');
    await page.waitForFunction(() => Boolean(window.sturdyVolleyLab?.cameraState));

    await page.evaluate(() => window.sturdyVolleyLab!.setReducedMotion(true));
    let s = await page.evaluate(() => window.sturdyVolleyLab!.cameraState());
    expect(s.reducedMotion, 'reduced motion engaged').toBe(true);

    await page.evaluate(() => window.sturdyVolleyLab!.setObstructionMode('cutaway'));
    s = await page.evaluate(() => window.sturdyVolleyLab!.cameraState());
    expect(s.obstructionMode, 'obstruction fallback engaged').toBe('cutaway');
    expect(s.obstructionMode).not.toBe('fade');
  });

  test('keeps the full player HUD-safe in the default viewport', async ({ page }, testInfo) => {
    await page.goto('/?scene=CameraLab');
    await page.waitForFunction(() => Boolean(window.sturdyVolleyLab?.playerScreen));
    await page.evaluate(() => {
      window.sturdyVolleyLab!.setPlayer(0, 0);
      window.sturdyVolleyLab!.setContext('exterior');
    });
    await page.waitForTimeout(400);
    const ps = await page.evaluate(() => window.sturdyVolleyLab!.playerScreen());
    expect(ps.onScreen, `player on screen (${testInfo.project.name})`).toBe(true);
    expect(ps.x, 'player horizontally framed').toBeGreaterThan(0.2);
    expect(ps.x).toBeLessThan(0.8);
    expect(ps.y, 'player vertically framed').toBeGreaterThan(0.1);
    expect(ps.y).toBeLessThan(0.92);
  });

  test('motor: a dropped player falls under gravity and lands grounded (WEF-02a)', async ({ page }) => {
    await page.goto('/?scene=CameraLab');
    await page.waitForFunction(() => Boolean(window.sturdyVolleyLab?.motor));

    const backend = await page.evaluate(() => window.sturdyVolleyLab!.physicsBackend());
    expect(['havok', 'raypick'], `physics backend (${backend})`).toContain(backend);

    await page.evaluate(() => window.sturdyVolleyLab!.dropPlayer(0, 8, 0));
    // Mid-fall: airborne, moving down.
    await page.waitForTimeout(150);
    const mid = await page.evaluate(() => window.sturdyVolleyLab!.motor());
    expect(mid.grounded, 'airborne mid-fall').toBe(false);
    expect(mid.velocityY, 'falling').toBeLessThan(0);

    // Settles grounded at the capsule rest height (~0.9 m centre).
    await page.waitForTimeout(1500);
    const landed = await page.evaluate(() => window.sturdyVolleyLab!.motor());
    expect(landed.grounded, 'landed grounded').toBe(true);
    expect(landed.y, 'rests at capsule half-height').toBeCloseTo(0.9, 1);
    expect(Math.abs(landed.velocityY), 'vertical velocity settled').toBeLessThan(0.5);
  });

  test('motor: keyboard movement moves the player and keeps it grounded; sprint drains stamina', async ({ page }) => {
    await page.goto('/?scene=CameraLab');
    await page.waitForFunction(() => Boolean(window.sturdyVolleyLab?.motor));
    await page.evaluate(() => window.sturdyVolleyLab!.setPlayer(0, 0));

    const before = await page.evaluate(() => window.sturdyVolleyLab!.motor());
    const staminaBefore = await page.evaluate(() => window.sturdyVolleyLab!.controller().stamina);

    await page.keyboard.down('Shift');
    await page.keyboard.down('w');
    await page.waitForTimeout(600);
    await page.keyboard.up('w');
    await page.keyboard.up('Shift');

    const after = await page.evaluate(() => window.sturdyVolleyLab!.motor());
    const staminaAfter = await page.evaluate(() => window.sturdyVolleyLab!.controller().stamina);

    const dist = Math.hypot(after.x - before.x, after.z - before.z);
    expect(dist, `player moved (${dist.toFixed(2)} m)`).toBeGreaterThan(0.5);
    expect(after.grounded, 'stayed grounded while walking').toBe(true);
    expect(staminaAfter, `sprint drained stamina (before ${staminaBefore}, after ${staminaAfter})`).toBeLessThan(staminaBefore);
  });

  test('keeps the full player HUD-safe across tablet / ultrawide / tall-phone aspect ratios', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'aspect-ratio sweep runs once, on desktop');
    await page.goto('/?scene=CameraLab');
    await page.waitForFunction(() => Boolean(window.sturdyVolleyLab?.playerScreen));

    const sizes: Array<[string, number, number]> = [
      ['tablet', 1024, 768],
      ['ultrawide', 2560, 1080],
      ['tall-phone', 360, 780],
    ];
    for (const [label, w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      await page.evaluate(() => {
        window.sturdyVolleyLab!.setPlayer(0, 0);
        window.sturdyVolleyLab!.setContext('exterior');
      });
      await page.waitForTimeout(350);
      const ps = await page.evaluate(() => window.sturdyVolleyLab!.playerScreen());
      expect(ps.onScreen, `player on screen @ ${label}`).toBe(true);
      expect(ps.x, `player framed @ ${label}`).toBeGreaterThan(0.15);
      expect(ps.x).toBeLessThan(0.85);
      expect(ps.y).toBeGreaterThan(0.08);
      expect(ps.y).toBeLessThan(0.95);
      const shot = await page.screenshot();
      await testInfo.attach(`camera-baseline-${label}`, { body: shot, contentType: 'image/png' });
    }
  });
});
