import { test, expect } from '@playwright/test';

interface CameraState {
  pitchDeg: number;
  fovDeg: number;
  distance: number;
  yawOffsetDeg: number;
}

interface RegionTransition {
  id: string;
  fromRegion: string;
  toRegion: string;
  toAnchor: { x: number; z: number };
  facing: number;
}

interface Budget {
  loadedChunks: number;
  maxLoadedChunks: number;
  meshes: number;
  bodies: number;
  over: boolean;
}

declare global {
  interface Window {
    sturdyVolleyStream?: {
      config: () => { chunkSize: number; activeRadius: number; keepRadius: number; maxLoadedChunks: number };
      regionIds: () => string[];
      region: () => { id: string; label: string; origin: { x: number; z: number } };
      player: () => { x: number; z: number };
      setPlayer: (x: number, z: number) => void;
      setVelocity: (vx: number, vz: number) => void;
      setSpeedMode: (mode: 'walk' | 'horse') => void;
      speedMode: () => string;
      tick: (n?: number) => void;
      focusChunkId: () => string;
      safeChunkId: () => string | null;
      stateOf: (id: string) => string;
      chunkStates: () => Array<{ id: string; cx: number; cz: number; state: string; ring: number }>;
      loadedIds: () => string[];
      counts: () => Record<string, number>;
      budget: () => Budget;
      groupIds: () => string[];
      groupCount: () => number;
      duplicateGroupIds: () => string[];
      worldMeshCount: () => number;
      anchorsForChunk: (id: string) => Array<{ id: string; present: boolean; appearance: string }>;
      anchorIdsForChunk: (id: string) => string[];
      variant: () => { tide: string; season: string; weather: string; restoration: number };
      setVariant: (patch: Partial<{ tide: string; season: string; weather: string; restoration: number }>) => void;
      failNextLoad: () => void;
      crossToBallastBay: () => RegionTransition | null;
      lastTransition: () => RegionTransition | null;
      cameraState: () => CameraState;
      meshCount: () => number;
    };
  }
}

const boot = async (page: import('@playwright/test').Page) => {
  await page.goto('/?scene=StreamingLab');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyStream?.chunkStates));
};

test.describe('Streaming proving ground (WEF-04)', () => {
  test('boots via ?scene=StreamingLab and streams a multi-chunk exterior', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await boot(page);

    const cfg = await page.evaluate(() => window.sturdyVolleyStream!.config());
    expect(cfg.chunkSize).toBe(32);
    expect(cfg.activeRadius).toBe(2);
    expect(cfg.keepRadius).toBe(3);

    // The spawn ring is resident: the focus chunk is active, 25 active + 24 loaded.
    const counts = await page.evaluate(() => window.sturdyVolleyStream!.counts());
    expect(counts.active, 'active ring resident').toBe(25);
    expect(counts.loaded, 'hysteresis band resident').toBe(24);
    expect(await page.evaluate(() => window.sturdyVolleyStream!.stateOf(window.sturdyVolleyStream!.focusChunkId()))).toBe('active');

    // Canvas-pixel check: the world actually rendered (not blank).
    await page.waitForTimeout(400);
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
    expect(stats.distinct, 'distinct colours').toBeGreaterThan(3);
    expect(stats.nonBlackRatio, 'non-black ratio').toBeGreaterThan(0.2);

    const shot = await page.screenshot();
    await testInfo.attach(`streaming-lab-${testInfo.project.name}`, { body: shot, contentType: 'image/png' });
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('crossing internal chunk seams keeps identity stable and never duplicates entities', async ({ page }) => {
    await boot(page);
    // Walk east across several chunk seams via the deterministic tick stepper.
    await page.evaluate(() => {
      window.sturdyVolleyStream!.setPlayer(48, 48);
      window.sturdyVolleyStream!.setVelocity(8, 0);
      window.sturdyVolleyStream!.tick(120); // ~4 s of travel, multiple seams
    });
    const dup1 = await page.evaluate(() => window.sturdyVolleyStream!.duplicateGroupIds());
    expect(dup1, 'no duplicate chunk groups while travelling').toEqual([]);
    // Group count stays bounded (hysteresis window, not unbounded growth).
    const count = await page.evaluate(() => window.sturdyVolleyStream!.groupCount());
    expect(count, 'resident groups bounded by the keep window').toBeLessThanOrEqual(64);

    // Walk back west to the start — the original chunks return with the SAME ids.
    await page.evaluate(() => {
      window.sturdyVolleyStream!.setVelocity(-8, 0);
      window.sturdyVolleyStream!.tick(120);
      window.sturdyVolleyStream!.setVelocity(0, 0);
      window.sturdyVolleyStream!.setPlayer(48, 48);
    });
    const dup2 = await page.evaluate(() => window.sturdyVolleyStream!.duplicateGroupIds());
    expect(dup2, 'no duplicates after returning').toEqual([]);
    expect(await page.evaluate(() => window.sturdyVolleyStream!.stateOf('willa-crick#1,1'))).toBe('active');
  });

  test('camera does not snap as the player crosses a seam', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.sturdyVolleyStream!.setPlayer(60, 48));
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => window.sturdyVolleyStream!.cameraState());
    // Walk across the x=64 seam (chunk 1→2).
    await page.keyboard.down('d');
    await page.waitForTimeout(900);
    await page.keyboard.up('d');
    const after = await page.evaluate(() => window.sturdyVolleyStream!.cameraState());
    // Framing parameters are continuous (no profile snap across the seam).
    expect(Math.abs(after.pitchDeg - before.pitchDeg), 'pitch continuous').toBeLessThan(2);
    expect(Math.abs(after.fovDeg - before.fovDeg), 'fov continuous').toBeLessThan(2);
    expect(Math.abs(after.distance - before.distance), 'distance continuous').toBeLessThan(2);
  });

  test('horse-speed travel preloads strictly more chunks ahead than walking', async ({ page }) => {
    await boot(page);
    const ahead = (mode: 'walk' | 'horse') =>
      page.evaluate((m) => {
        window.sturdyVolleyStream!.setPlayer(160, 48); // mid-region, room to look ahead
        const speed = m === 'horse' ? 11 : 3.2;
        window.sturdyVolleyStream!.setVelocity(speed, 0);
        window.sturdyVolleyStream!.tick(1);
        const focusCx = window.sturdyVolleyStream!.chunkStates().find((c) => c.ring === 0)!.cx;
        const states = window.sturdyVolleyStream!.chunkStates();
        const maxAheadCx = Math.max(...states.map((c) => c.cx));
        return { focusCx, maxAheadCx, total: states.length };
      }, mode);

    const walk = await ahead('walk');
    const horse = await ahead('horse');
    expect(horse.maxAheadCx, 'horse loads farther ahead in +X').toBeGreaterThan(walk.maxAheadCx);
    expect(horse.total, 'horse keeps more chunks resident').toBeGreaterThan(walk.total);
  });

  test('streaming stays within the chunk budget', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      window.sturdyVolleyStream!.setPlayer(48, 48);
      window.sturdyVolleyStream!.setSpeedMode('horse');
      window.sturdyVolleyStream!.setVelocity(11, 0);
      window.sturdyVolleyStream!.tick(200);
    });
    const budget = await page.evaluate(() => window.sturdyVolleyStream!.budget());
    expect(budget.loadedChunks, 'within chunk ceiling').toBeLessThanOrEqual(budget.maxLoadedChunks);
    expect(budget.over, 'no budget ceiling exceeded').toBe(false);
  });

  test('the Willa Crick ↔ Ballast Bay community transition swaps region without stranding the player', async ({ page }) => {
    await boot(page);
    expect((await page.evaluate(() => window.sturdyVolleyStream!.region())).id).toBe('willa-crick');

    const transition = await page.evaluate(() => window.sturdyVolleyStream!.crossToBallastBay());
    expect(transition, 'transition fired').not.toBeNull();
    expect(transition!.fromRegion).toBe('willa-crick');
    expect(transition!.toRegion).toBe('ballast-bay');

    // Active region swapped; the player recovered onto a resident Ballast Bay chunk.
    const region = await page.evaluate(() => window.sturdyVolleyStream!.region());
    expect(region.id).toBe('ballast-bay');
    expect(region.origin.x).toBe(256);
    const focus = await page.evaluate(() => window.sturdyVolleyStream!.focusChunkId());
    expect(focus.startsWith('ballast-bay#')).toBe(true);
    expect(await page.evaluate(() => window.sturdyVolleyStream!.stateOf(window.sturdyVolleyStream!.focusChunkId()))).toBe('active');
    // No stale Willa Crick chunks remain resident.
    const ids = await page.evaluate(() => window.sturdyVolleyStream!.groupIds());
    expect(ids.every((id) => id.startsWith('ballast-bay#')), 'only destination chunks resident').toBe(true);
  });

  test('content variants change presence while every stable anchor id holds', async ({ page }) => {
    await boot(page);
    // Pick a coastal chunk whose content carries a tide pool + a restoration stall.
    const chunk = 'willa-crick#0,0'; // (cx+cz)%3==0 and %4==0 → both variant anchors
    const idsLow = await page.evaluate((c) => window.sturdyVolleyStream!.anchorIdsForChunk(c), chunk);
    expect(idsLow).toContain('willa-crick#0,0:tidepool');
    expect(idsLow).toContain('willa-crick#0,0:stall');

    // Low tide + rebuilt: tide pool present, stall present.
    await page.evaluate(() => window.sturdyVolleyStream!.setVariant({ tide: 'low', restoration: 5 }));
    let resolved = await page.evaluate((c) => window.sturdyVolleyStream!.anchorsForChunk(c), chunk);
    expect(resolved.find((a) => a.id.endsWith(':tidepool'))?.present).toBe(true);
    expect(resolved.find((a) => a.id.endsWith(':stall'))?.present).toBe(true);

    // High tide + storm-worn: tide pool hidden, stall absent — but the id SET is identical.
    await page.evaluate(() => window.sturdyVolleyStream!.setVariant({ tide: 'high', restoration: 0 }));
    resolved = await page.evaluate((c) => window.sturdyVolleyStream!.anchorsForChunk(c), chunk);
    expect(resolved.find((a) => a.id.endsWith(':tidepool'))?.present).toBe(false);
    expect(resolved.find((a) => a.id.endsWith(':stall'))?.present).toBe(false);
    const idsHigh = await page.evaluate((c) => window.sturdyVolleyStream!.anchorIdsForChunk(c), chunk);
    expect(idsHigh, 'anchor identity invariant across variants').toEqual(idsLow);

    // Winter changes the marker appearance without touching its id.
    await page.evaluate(() => window.sturdyVolleyStream!.setVariant({ season: 'winter' }));
    resolved = await page.evaluate((c) => window.sturdyVolleyStream!.anchorsForChunk(c), chunk);
    expect(resolved.find((a) => a.id.endsWith(':marker'))?.appearance).toBe('snow');
  });

  test('a failed chunk load keeps the player on valid ground and recovers', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.sturdyVolleyStream!.setPlayer(48, 48));
    await page.waitForTimeout(100);
    // Arm a failure, then jump to a fresh focus — the focus chunk is first to
    // load, so it is the one that fails (the worst case for recovery).
    await page.evaluate(() => {
      window.sturdyVolleyStream!.failNextLoad();
      window.sturdyVolleyStream!.setPlayer(176, 48); // fresh focus (still Willa Crick); focus fails
    });
    expect(await page.evaluate(() => window.sturdyVolleyStream!.stateOf(window.sturdyVolleyStream!.focusChunkId()))).toBe('failed');
    // Despite the focus chunk failing, a safe resident neighbour is available.
    const safe = await page.evaluate(() => window.sturdyVolleyStream!.safeChunkId());
    expect(safe, 'a safe chunk exists despite the focus failure').not.toBeNull();
    expect(['active', 'loaded']).toContain(await page.evaluate((id) => window.sturdyVolleyStream!.stateOf(id!), safe));

    // The retry rebuilds it (tick advances failure timers past failureRetryMs).
    await page.evaluate(() => {
      window.sturdyVolleyStream!.setVelocity(0, 0);
      window.sturdyVolleyStream!.tick(60);
    });
    const counts = await page.evaluate(() => window.sturdyVolleyStream!.counts());
    expect(counts.failed, 'no chunk left permanently failed').toBe(0);
    expect(await page.evaluate(() => window.sturdyVolleyStream!.stateOf(window.sturdyVolleyStream!.focusChunkId()))).toBe('active');
  });

  test('the ?debug=streaming overlay reports region, focus, and budget', async ({ page }) => {
    await page.goto('/?scene=StreamingLab&debug=streaming');
    await page.waitForFunction(() => Boolean(window.sturdyVolleyStream?.chunkStates));
    await expect(page.locator('[data-testid="streaming-overlay"]')).toBeVisible();
    await page.waitForTimeout(200);
    await expect(page.locator('[data-testid="stream-region"]')).toContainText('Willa Crick');
    await expect(page.locator('[data-testid="stream-focus"]')).toContainText('willa-crick#');
    await expect(page.locator('[data-testid="stream-budget"]')).toContainText('chunks');
  });
});
