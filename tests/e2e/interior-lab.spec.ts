import { test, expect } from '@playwright/test';

interface CameraState {
  profileId: string;
  context: string;
  pitchDeg: number;
  fovDeg: number;
  distance: number;
  obstructionMode: 'fade' | 'cutaway';
  activeVolumeId: string | null;
}

interface Handoff {
  fromAnchorId: string;
  toRoomId: string;
  toAnchorId: string;
  facing: number;
  cameraContext: string;
  preserved: { clockMinutes: number; npcToken: string; returnPath: { x: number; z: number; facing: number } };
}

declare global {
  interface Window {
    sturdyVolleyInterior?: {
      rooms: () => string[];
      meshCount: () => number;
      player: () => { x: number; z: number; facing: number };
      setPlayer: (x: number, z: number, facing?: number) => void;
      gotoRoom: (id: string) => boolean;
      roomConformant: (id: string) => { ok: boolean; issues: string[] };
      cameraState: () => CameraState;
      activeVolumeId: () => string | null;
      seesBackingThroughNearWall: (id: string) => boolean;
      interactionFocus: () => { id: string | null; onScreen: boolean; x: number; y: number };
      playerScreen: () => { x: number; y: number; onScreen: boolean };
      enterRoom: (id: string) => Handoff | null;
      exitRoom: () => { x: number; z: number; facing: number } | null;
      lastHandoff: () => Handoff | null;
      clockMinutes: () => number;
      npcToken: () => string;
      doorAnchors: (id: string) => Array<{ id: string; facing: number; toAnchorId: string | null }>;
    };
  }
}

const ARCHETYPES = ['small-room', 'corridor', 'stair-room', 'crowded-shop', 'large-hall'];

const boot = async (page: import('@playwright/test').Page) => {
  await page.goto('/?scene=InteriorLab');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyInterior?.rooms));
};

test.describe('Interior construction-kit proving ground (WEF-05)', () => {
  test('boots via ?scene=InteriorLab and builds all five archetypes (conformant)', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await boot(page);
    const rooms = await page.evaluate(() => window.sturdyVolleyInterior!.rooms());
    expect(rooms.sort()).toEqual([...ARCHETYPES].sort());

    // Every archetype is metric-conformant.
    for (const id of ARCHETYPES) {
      const r = await page.evaluate((rid) => window.sturdyVolleyInterior!.roomConformant(rid), id);
      expect(r.ok, `${id} conformant (${r.issues.join(',')})`).toBe(true);
    }

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
    expect(stats.distinct).toBeGreaterThan(3);
    expect(stats.nonBlackRatio).toBeGreaterThan(0.2);

    const shot = await page.screenshot();
    await testInfo.attach(`interior-lab-${testInfo.project.name}`, { body: shot, contentType: 'image/png' });
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('entering a room engages its authored camera volume + profile', async ({ page }) => {
    await boot(page);
    // Outside every room → no volume, exterior profile.
    await page.evaluate(() => window.sturdyVolleyInterior!.setPlayer(50, 50));
    await page.waitForTimeout(300);
    let s = await page.evaluate(() => window.sturdyVolleyInterior!.cameraState());
    expect(s.activeVolumeId, 'no volume outside rooms').toBeNull();
    expect(s.context).toBe('exterior');

    // Inside the small room → its volume + a smallInterior profile.
    await page.evaluate(() => window.sturdyVolleyInterior!.gotoRoom('small-room'));
    await page.waitForTimeout(900); // let the profile blend settle
    s = await page.evaluate(() => window.sturdyVolleyInterior!.cameraState());
    expect(s.activeVolumeId).toBe('vol-small-room');
    expect(s.context).toBe('smallInterior');

    // The large hall overrides obstruction to cutaway.
    await page.evaluate(() => window.sturdyVolleyInterior!.gotoRoom('large-hall'));
    await page.waitForTimeout(600);
    s = await page.evaluate(() => window.sturdyVolleyInterior!.cameraState());
    expect(s.activeVolumeId).toBe('vol-large-hall');
    expect(s.context).toBe('largeInterior');
    expect(s.obstructionMode, 'hall overrides obstruction to cutaway').toBe('cutaway');
  });

  test('fading the near wall reveals backing, never a void to the sky', async ({ page }) => {
    await boot(page);
    for (const id of ARCHETYPES) {
      await page.evaluate((rid) => window.sturdyVolleyInterior!.gotoRoom(rid), id);
      await page.waitForTimeout(250);
      const ok = await page.evaluate((rid) => window.sturdyVolleyInterior!.seesBackingThroughNearWall(rid), id);
      expect(ok, `${id} keeps a backing surface behind the faded near wall`).toBe(true);
    }
  });

  test('character stays HUD-safe in every archetype on this viewport', async ({ page }, testInfo) => {
    await boot(page);
    for (const id of ARCHETYPES) {
      await page.evaluate((rid) => window.sturdyVolleyInterior!.gotoRoom(rid), id);
      await page.waitForTimeout(850);
      const ps = await page.evaluate(() => window.sturdyVolleyInterior!.playerScreen());
      expect(ps.onScreen, `player readable in ${id} (${testInfo.project.name})`).toBe(true);
      expect(ps.x).toBeGreaterThan(0.1);
      expect(ps.x).toBeLessThan(0.9);
      expect(ps.y).toBeGreaterThan(0.05);
      expect(ps.y).toBeLessThan(0.95);
    }
  });

  test('primary interaction stays readable in the crowded shop', async ({ page }) => {
    await boot(page);
    // Stand the player at the shop counter.
    await page.evaluate(() => {
      const door = window.sturdyVolleyInterior!.doorAnchors('crowded-shop');
      void door;
      window.sturdyVolleyInterior!.setPlayer(0, 26 + 0.6); // near the counter at shop centre +z
    });
    await page.waitForTimeout(500);
    const focus = await page.evaluate(() => window.sturdyVolleyInterior!.interactionFocus());
    expect(focus.id, 'the counter is the primary interaction').toContain('counter');
    expect(focus.onScreen, 'interaction target is on screen amid the clutter').toBe(true);
  });

  test('exterior↔interior handoff preserves anchor, facing, clock, NPC state, return path', async ({ page }) => {
    await boot(page);
    // Stand at an exterior spot with a known facing.
    await page.evaluate(() => window.sturdyVolleyInterior!.setPlayer(0, 8, 1.234));
    await page.waitForTimeout(150);
    const clockBefore = await page.evaluate(() => window.sturdyVolleyInterior!.clockMinutes());
    const npcBefore = await page.evaluate(() => window.sturdyVolleyInterior!.npcToken());
    const exterior = await page.evaluate(() => window.sturdyVolleyInterior!.player());

    const handoff = await page.evaluate(() => window.sturdyVolleyInterior!.enterRoom('small-room'));
    expect(handoff, 'handoff produced').not.toBeNull();
    expect(handoff!.toRoomId).toBe('small-room');
    expect(handoff!.cameraContext).toBe('smallInterior');
    // The handoff carries the destination anchor + a facing into the room.
    expect(handoff!.toAnchorId).toBe('small-door');
    // Preserved state matches the pre-entry world.
    expect(handoff!.preserved.clockMinutes).toBe(clockBefore);
    expect(handoff!.preserved.npcToken).toBe(npcBefore);
    expect(handoff!.preserved.returnPath.x).toBeCloseTo(exterior.x, 3);
    expect(handoff!.preserved.returnPath.z).toBeCloseTo(exterior.z, 3);
    expect(handoff!.preserved.returnPath.facing).toBeCloseTo(1.234, 3);

    // The clock + NPC state are untouched by the transition.
    expect(await page.evaluate(() => window.sturdyVolleyInterior!.clockMinutes())).toBe(clockBefore);
    expect(await page.evaluate(() => window.sturdyVolleyInterior!.npcToken())).toBe(npcBefore);

    // Returning restores the exact return-path pose + facing.
    const back = await page.evaluate(() => window.sturdyVolleyInterior!.exitRoom());
    expect(back!.x).toBeCloseTo(exterior.x, 3);
    expect(back!.z).toBeCloseTo(exterior.z, 3);
    expect(back!.facing).toBeCloseTo(1.234, 3);
  });

  test('adjacent-volume selection does not oscillate while loitering on a boundary', async ({ page }) => {
    await boot(page);
    // The small room volume spans x∈[-2.5,2.5] at z≈0; loiter near its +x edge and
    // confirm the active volume id stays stable frame-to-frame (sticky selection).
    await page.evaluate(() => window.sturdyVolleyInterior!.setPlayer(0, 0));
    await page.waitForTimeout(300);
    const first = await page.evaluate(() => window.sturdyVolleyInterior!.activeVolumeId());
    expect(first).toBe('vol-small-room');
    const samples: (string | null)[] = [];
    for (const x of [2.2, 2.6, 2.3, 2.7, 2.4]) {
      await page.evaluate((px) => window.sturdyVolleyInterior!.setPlayer(px, 0), x);
      await page.waitForTimeout(120);
      samples.push(await page.evaluate(() => window.sturdyVolleyInterior!.activeVolumeId()));
    }
    expect(samples.every((s) => s === 'vol-small-room'), `stable within blend boundary: ${samples.join(',')}`).toBe(true);
  });
});
