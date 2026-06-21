import { test, expect } from '@playwright/test';

interface MountStateView {
  phase: string;
  ridden: boolean;
  owned: boolean;
  cameraContext: string;
  speed: number;
  horse: { x: number; z: number; facing: number };
  player: { x: number; z: number; y: number; grounded: boolean };
  riderGap: number;
}
interface CameraStateView {
  context: string;
  distance: number;
  pitchDeg: number;
}
interface MountSaveView {
  phase: 'free' | 'ridden';
  owned: boolean;
  horse: { x: number; z: number; facing: number };
}

declare global {
  interface Window {
    sturdyVolleyMount?: {
      meshCount: () => number;
      state: () => MountStateView;
      cameraState: () => CameraStateView;
      canMount: () => boolean;
      setMove: (x: number, z: number) => void;
      setThrottle: (t: number) => void;
      setPlayer: (x: number, z: number) => void;
      pressAction: () => boolean;
      tick: (n?: number) => void;
      setReducedMotion: (on: boolean) => void;
      forded: () => boolean;
      crossedBridge: () => boolean;
      crossedSeam: () => boolean;
      tunneled: () => boolean;
      minRiderY: () => number;
      finite: () => boolean;
      serialize: () => MountSaveView;
      restore: (save: MountSaveView) => void;
    };
  }
}

const boot = async (page: import('@playwright/test').Page) => {
  await page.goto('/?scene=MountLab');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyMount?.state));
};

/** Mount the horse deterministically inside one evaluate (no rAF drift). */
const mountUp = async (page: import('@playwright/test').Page) => {
  await page.evaluate(() => {
    const m = window.sturdyVolleyMount!;
    const h = m.state().horse;
    m.setPlayer(h.x, h.z - 1.0); // within the 2 m mount reach
    m.pressAction();
    m.tick(20); // complete the mount blend
  });
};

test.describe('Mount system proving ground (Prompt 044)', () => {
  test('boots riderless on the exterior camera with the horse graybox', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await boot(page);
    const s = await page.evaluate(() => window.sturdyVolleyMount!.state());
    expect(s.phase).toBe('free');
    expect(s.ridden).toBe(false);
    expect(s.owned).toBe(true);
    expect(s.cameraContext).toBe('exterior');
    const meshes = await page.evaluate(() => window.sturdyVolleyMount!.meshCount());
    expect(meshes, 'course + horse graybox present').toBeGreaterThan(12);

    await page.waitForTimeout(300);
    const shot = await page.screenshot();
    await testInfo.attach(`mount-lab-${testInfo.project.name}`, { body: shot, contentType: 'image/png' });
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('mount is a contextual one-button action that hands the camera to the mounted context', async ({ page }) => {
    await boot(page);
    // Out of reach → cannot mount; in reach → can.
    const far = await page.evaluate(() => {
      window.sturdyVolleyMount!.setPlayer(0, -6);
      return window.sturdyVolleyMount!.canMount();
    });
    expect(far).toBe(false);

    await mountUp(page);
    const s = await page.evaluate(() => window.sturdyVolleyMount!.state());
    expect(s.ridden).toBe(true);
    expect(s.cameraContext).toBe('mounted');
    const cam = await page.evaluate(() => window.sturdyVolleyMount!.cameraState());
    expect(cam.context).toBe('mounted');
  });

  test('ridden traversal crosses ford, bridge and the community seam without tunnelling', async ({ page }) => {
    await boot(page);
    await mountUp(page);
    const before = await page.evaluate(() => window.sturdyVolleyMount!.state().horse.z);
    await page.evaluate(() => {
      const m = window.sturdyVolleyMount!;
      m.setMove(0, 1); // ride forward (+Z)
      m.setThrottle(1); // gallop
      m.tick(220);
    });
    const s = await page.evaluate(() => window.sturdyVolleyMount!.state());
    const proofs = await page.evaluate(() => ({
      forded: window.sturdyVolleyMount!.forded(),
      bridge: window.sturdyVolleyMount!.crossedBridge(),
      seam: window.sturdyVolleyMount!.crossedSeam(),
      tunneled: window.sturdyVolleyMount!.tunneled(),
      minRiderY: window.sturdyVolleyMount!.minRiderY(),
      finite: window.sturdyVolleyMount!.finite(),
    }));
    expect(s.horse.z, 'horse rode forward across the course').toBeGreaterThan(before + 30);
    expect(proofs.forded, 'waded the shallow ford').toBe(true);
    expect(proofs.bridge, 'crossed the bridge deck').toBe(true);
    expect(proofs.seam, 'crossed the Willa Crick ↔ Ballast Bay seam').toBe(true);
    expect(proofs.tunneled, 'never tunnels into the obstruction').toBe(false);
    expect(proofs.minRiderY, 'rider never sinks below ground').toBeGreaterThan(0.5);
    expect(proofs.finite, 'pose stays finite (no NaN)').toBe(true);
    // Camera stayed in the mounted context across every transition.
    expect(s.cameraContext).toBe('mounted');
  });

  test('dismount returns a valid grounded pose beside the horse and reverts the camera', async ({ page }) => {
    await boot(page);
    await mountUp(page);
    await page.evaluate(() => {
      const m = window.sturdyVolleyMount!;
      m.setMove(0, 0);
      m.setThrottle(0);
      m.tick(10); // halt
      m.pressAction(); // begin dismount
      m.tick(20); // complete the blend
    });
    const s = await page.evaluate(() => window.sturdyVolleyMount!.state());
    expect(s.phase).toBe('free');
    expect(s.ridden).toBe(false);
    expect(s.cameraContext).toBe('exterior');
    expect(s.player.grounded, 'rider lands on valid ground').toBe(true);
    expect(s.riderGap, 'rider steps off beside the horse, not inside it').toBeGreaterThan(0.5);
  });

  test('save/load restores the mounted and the dismounted state', async ({ page }) => {
    await boot(page);
    await mountUp(page);
    // Save while ridden, perturb, restore → ridden.
    const riddenSave = await page.evaluate(() => {
      const m = window.sturdyVolleyMount!;
      const save = m.serialize();
      m.setMove(0, 1);
      m.setThrottle(1);
      m.tick(30);
      m.restore(save);
      return m.state();
    });
    expect(riddenSave.phase).toBe('ridden');
    expect(riddenSave.cameraContext).toBe('mounted');

    // Dismount, save while free, restore → free.
    const freeSave = await page.evaluate(() => {
      const m = window.sturdyVolleyMount!;
      m.setMove(0, 0);
      m.setThrottle(0);
      m.tick(10);
      m.pressAction();
      m.tick(20);
      const save = m.serialize();
      m.restore(save);
      return { state: m.state(), save };
    });
    expect(freeSave.save.phase).toBe('free');
    expect(freeSave.state.phase).toBe('free');
    expect(freeSave.state.cameraContext).toBe('exterior');
  });

  test('reduced motion is honored without breaking the ride', async ({ page }) => {
    await boot(page);
    await mountUp(page);
    const s = await page.evaluate(() => {
      const m = window.sturdyVolleyMount!;
      m.setReducedMotion(true);
      m.setMove(0, 1);
      m.setThrottle(1);
      m.tick(60);
      return m.state();
    });
    expect(s.ridden).toBe(true);
    expect(s.cameraContext).toBe('mounted');
  });
});
