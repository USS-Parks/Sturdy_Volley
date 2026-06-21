import { test, expect } from '@playwright/test';

type FarmLayer = 'render' | 'collision' | 'nav' | 'anchor' | 'volume';

declare global {
  interface Window {
    sturdyVolleyFarm?: {
      region: () => string;
      meshCount: () => number;
      anchors: () => string[];
      chunkCount: () => number;
      layerCount: (l: FarmLayer) => number;
      enabledCount: (l: FarmLayer) => number;
      setLayer: (l: FarmLayer, on: boolean) => void;
      player: () => { x: number; z: number; y: number; facing: number; medium: string; grounded: boolean };
      setPlayer: (x: number, z: number, facing?: number) => void;
      setMove: (x: number, z: number) => void;
      cameraState: () => { context: string };
      goat: () => { x: number; z: number; inPasture: boolean };
      cropAngles: () => number[];
      clockMinutes: () => number;
      npcToken: () => string;
      atFarmhouseDoor: () => boolean;
      pressAction: () => boolean;
      tick: (n?: number) => void;
    };
    sturdyVolleyFarmhouse?: {
      region: () => string;
      meshCount: () => number;
      roomConformant: () => { ok: boolean; issues: string[] };
      interactionAnchors: () => string[];
      player: () => { x: number; z: number; facing: number };
      setPlayer: (x: number, z: number, facing?: number) => void;
      cameraState: () => { context: string };
      seesBackingThroughNearWall: () => boolean;
      atDoor: () => boolean;
      pressAction: () => boolean;
      clockMinutes: () => number;
      npcToken: () => string;
      returnAnchor: () => { x: number; z: number; facing: number };
      tick: (n?: number) => void;
    };
  }
}

const bootFarm = async (page: import('@playwright/test').Page) => {
  await page.goto('/?scene=BreakpointFarm');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyFarm?.region));
};

test.describe('Breakpoint Farm + Farmhouse (WEF-10a)', () => {
  test('the farm boots from the blockout with anchors + chunk grid', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await bootFarm(page);
    const region = await page.evaluate(() => window.sturdyVolleyFarm!.region());
    expect(region).toBe('breakpoint-farm');
    const anchors = await page.evaluate(() => window.sturdyVolleyFarm!.anchors());
    expect(anchors).toContain('farmhouse-door');
    const chunks = await page.evaluate(() => window.sturdyVolleyFarm!.chunkCount());
    expect(chunks).toBe(16); // 4×4 grid of 32 m chunks
    const meshes = await page.evaluate(() => window.sturdyVolleyFarm!.meshCount());
    expect(meshes).toBeGreaterThan(100);

    await page.waitForTimeout(300);
    const shot = await page.screenshot();
    await testInfo.attach(`breakpoint-farm-${testInfo.project.name}`, { body: shot, contentType: 'image/png' });
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('every debug layer toggles independently', async ({ page }) => {
    await bootFarm(page);
    for (const layer of ['collision', 'nav', 'anchor', 'volume'] as FarmLayer[]) {
      const off = await page.evaluate((l) => window.sturdyVolleyFarm!.enabledCount(l), layer);
      expect(off, `${layer} hidden by default`).toBe(0);
      const total = await page.evaluate((l) => {
        window.sturdyVolleyFarm!.setLayer(l, true);
        return { on: window.sturdyVolleyFarm!.enabledCount(l), count: window.sturdyVolleyFarm!.layerCount(l) };
      }, layer);
      expect(total.count, `${layer} has viz meshes`).toBeGreaterThan(0);
      expect(total.on, `${layer} all enabled`).toBe(total.count);
      const back = await page.evaluate((l) => {
        window.sturdyVolleyFarm!.setLayer(l, false);
        return window.sturdyVolleyFarm!.enabledCount(l);
      }, layer);
      expect(back, `${layer} hidden again`).toBe(0);
    }
    // The render layer is the visible graybox (always present).
    const render = await page.evaluate(() => window.sturdyVolleyFarm!.layerCount('render'));
    expect(render).toBeGreaterThan(50);
  });

  test('authored camera volumes engage: orchard bluff hands off to the exterior context', async ({ page }) => {
    await bootFarm(page);
    const yard = await page.evaluate(() => {
      window.sturdyVolleyFarm!.setPlayer(64, 64);
      window.sturdyVolleyFarm!.tick(5);
      return window.sturdyVolleyFarm!.cameraState().context;
    });
    expect(yard).toBe('farm');
    const bluff = await page.evaluate(() => {
      window.sturdyVolleyFarm!.setPlayer(112, 64);
      window.sturdyVolleyFarm!.tick(5);
      return window.sturdyVolleyFarm!.cameraState().context;
    });
    expect(bluff).toBe('exterior');
  });

  test('elevation, water, fauna and flora cases are live', async ({ page }) => {
    await bootFarm(page);
    // Elevation + traversal: walk up the stair ramp onto the orchard bluff.
    const onBluff = await page.evaluate(() => {
      window.sturdyVolleyFarm!.setPlayer(96, 64);
      window.sturdyVolleyFarm!.setMove(1, 0);
      window.sturdyVolleyFarm!.tick(140);
      return window.sturdyVolleyFarm!.player();
    });
    expect(onBluff.y, 'climbed onto the orchard bluff').toBeGreaterThan(1.5);

    // Water: standing in the pond wades.
    const wade = await page.evaluate(() => {
      window.sturdyVolleyFarm!.setMove(0, 0);
      window.sturdyVolleyFarm!.setPlayer(24, 96);
      window.sturdyVolleyFarm!.tick(3);
      return window.sturdyVolleyFarm!.player().medium;
    });
    expect(wade).toBe('wade');

    // Fauna: the pasture goat stays inside its fence.
    const goat = await page.evaluate(() => {
      window.sturdyVolleyFarm!.tick(400);
      return window.sturdyVolleyFarm!.goat();
    });
    expect(goat.inPasture).toBe(true);

    // Flora: the crops sway (a spread of bend angles).
    const crops = await page.evaluate(() => window.sturdyVolleyFarm!.cropAngles());
    const spread = Math.max(...crops) - Math.min(...crops);
    expect(spread, 'crops sway out of lockstep').toBeGreaterThan(0.02);
  });

  test('the farmhouse door round-trips, preserving anchor/facing/camera/clock/NPC', async ({ page }) => {
    await bootFarm(page);
    // Walk to the farmhouse door and enter.
    const entered = await page.evaluate(() => {
      window.sturdyVolleyFarm!.setMove(0, 0);
      window.sturdyVolleyFarm!.setPlayer(56, 47);
      const atDoor = window.sturdyVolleyFarm!.atFarmhouseDoor();
      const began = window.sturdyVolleyFarm!.pressAction();
      return { atDoor, began };
    });
    expect(entered.atDoor).toBe(true);
    expect(entered.began).toBe(true);

    await page.waitForFunction(() => Boolean(window.sturdyVolleyFarmhouse?.region));
    const inside = await page.evaluate(() => {
      window.sturdyVolleyFarmhouse!.tick(5);
      return {
        region: window.sturdyVolleyFarmhouse!.region(),
        conformant: window.sturdyVolleyFarmhouse!.roomConformant().ok,
        anchors: window.sturdyVolleyFarmhouse!.interactionAnchors(),
        context: window.sturdyVolleyFarmhouse!.cameraState().context,
        clock: window.sturdyVolleyFarmhouse!.clockMinutes(),
        npc: window.sturdyVolleyFarmhouse!.npcToken(),
        backing: window.sturdyVolleyFarmhouse!.seesBackingThroughNearWall(),
        ret: window.sturdyVolleyFarmhouse!.returnAnchor(),
      };
    });
    expect(inside.region).toBe('farmhouse-interior');
    expect(inside.conformant).toBe(true);
    expect(inside.context).toBe('smallInterior');
    expect(inside.anchors).toEqual(expect.arrayContaining(['farmhouse:fireplace', 'farmhouse:kitchen-counter', 'farmhouse:chest']));
    expect(inside.clock, 'clock preserved across the seam').toBe(9 * 60);
    expect(inside.npc, 'NPC token preserved').toBe('npc-state-v1');
    expect(inside.backing, 'near-wall fade reveals backing, never a void').toBe(true);
    expect(inside.ret.x).toBeCloseTo(56, 1);

    // Walk to the interior door and exit back to the farm.
    const exited = await page.evaluate(() => {
      window.sturdyVolleyFarmhouse!.setPlayer(0, -3.5);
      const atDoor = window.sturdyVolleyFarmhouse!.atDoor();
      const began = window.sturdyVolleyFarmhouse!.pressAction();
      return { atDoor, began };
    });
    expect(exited.atDoor).toBe(true);
    expect(exited.began).toBe(true);

    await page.waitForFunction(() => Boolean(window.sturdyVolleyFarm?.region));
    const back = await page.evaluate(() => ({
      player: window.sturdyVolleyFarm!.player(),
      clock: window.sturdyVolleyFarm!.clockMinutes(),
      npc: window.sturdyVolleyFarm!.npcToken(),
    }));
    expect(back.player.x, 'returned to the saved return anchor').toBeCloseTo(56, 0);
    expect(Math.abs(back.player.facing - Math.PI)).toBeLessThan(0.2);
    expect(back.clock).toBe(9 * 60);
    expect(back.npc).toBe('npc-state-v1');
  });

  test('the farmhouse boots standalone as the interior-kit reference', async ({ page }) => {
    await page.goto('/?scene=FarmhouseInterior');
    await expect(page.locator('#game-canvas')).toBeVisible();
    await page.waitForFunction(() => Boolean(window.sturdyVolleyFarmhouse?.region));
    const data = await page.evaluate(() => ({
      region: window.sturdyVolleyFarmhouse!.region(),
      conformant: window.sturdyVolleyFarmhouse!.roomConformant(),
      meshes: window.sturdyVolleyFarmhouse!.meshCount(),
    }));
    expect(data.region).toBe('farmhouse-interior');
    expect(data.conformant.ok, data.conformant.issues.join(';')).toBe(true);
    expect(data.meshes).toBeGreaterThan(8);
  });
});
