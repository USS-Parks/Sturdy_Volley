import { test, expect } from '@playwright/test';
// Reuses the Window.sturdyVolleyDebug type declared in farm.spec.ts.

interface DebugApi {
  worldEntities: () => Record<string, { kind: string; itemId: string | null; age: number }>;
  warpToEntity: (suffix: string) => boolean;
  hotbarSlots: () => Array<{ itemId: string; qty: number; quality: number } | null>;
  setTimeScale: (scale: number) => void;
  sleep: () => void;
}

interface PerfNumbers {
  drawCalls: number;
  activeMeshes: number;
  triangles: number;
}

interface SceneBudget {
  drawCalls: number;
  activeMeshes: number;
  triangles: number;
}

const BUDGETS: Record<string, SceneBudget> = {
  Farm: { drawCalls: 220, activeMeshes: 180, triangles: 220_000 },
  Town: { drawCalls: 220, activeMeshes: 200, triangles: 220_000 },
  Interior: { drawCalls: 140, activeMeshes: 120, triangles: 100_000 },
};

async function readPerf(page: import('@playwright/test').Page): Promise<PerfNumbers> {
  await page.waitForTimeout(120);
  return page.evaluate(() => {
    const num = (testid: string): number => {
      const el = document.querySelector(`[data-testid="${testid}"]`);
      if (!el) return Number.NaN;
      return parseInt((el.textContent ?? '').replace(/[^\d-]/g, ''), 10);
    };
    return {
      drawCalls: num('perf-draws'),
      activeMeshes: num('perf-meshes'),
      triangles: num('perf-tris'),
    };
  });
}

async function assertWithinBudget(
  page: import('@playwright/test').Page,
  sceneKey: string,
): Promise<void> {
  const budget = BUDGETS[sceneKey];
  if (!budget) return;
  const sample = await readPerf(page);
  expect(
    sample.drawCalls,
    `${sceneKey} draw calls ${sample.drawCalls} ≤ ${budget.drawCalls}`,
  ).toBeLessThanOrEqual(budget.drawCalls);
  expect(
    sample.activeMeshes,
    `${sceneKey} active meshes ${sample.activeMeshes} ≤ ${budget.activeMeshes}`,
  ).toBeLessThanOrEqual(budget.activeMeshes);
  expect(
    sample.triangles,
    `${sceneKey} triangles ${sample.triangles} ≤ ${budget.triangles}`,
  ).toBeLessThanOrEqual(budget.triangles);
}

async function newGameWithPerf(
  page: import('@playwright/test').Page,
  name = 'Slice',
): Promise<DebugApi> {
  await page.goto('/?debug=perf');
  await expect(page.getByTestId('perf-overlay')).toBeVisible();
  await page.getByTestId('title-start').click();
  await page.getByTestId('field-name').fill(name);
  await page.getByTestId('form-submit').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  const skip = page.getByTestId('cutscene-skip');
  try {
    await skip.waitFor({ state: 'visible', timeout: 4000 });
    await skip.click();
    await skip.waitFor({ state: 'hidden', timeout: 4000 });
  } catch { /* cutscene already gone */ }
  await page.waitForFunction(() => Boolean(window.sturdyVolleyDebug?.warpToEntity));
  return await page.evaluate(() => {
    const api = window.sturdyVolleyDebug!;
    return {
      worldEntities: api.worldEntities,
      warpToEntity: api.warpToEntity,
      hotbarSlots: api.hotbarSlots,
      setTimeScale: api.setTimeScale,
      sleep: api.sleep,
    } as DebugApi;
  });
}

async function pressInteract(page: import('@playwright/test').Page): Promise<void> {
  // Dispatch the keydown/keyup directly on `window` (bypasses CDP focus
  // routing) and hold the key longer so at least one Babylon update tick
  // observes `pressed.has('e')` under headless SwiftShader frames on CI.
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
  });
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'e' }));
  });
}

async function sleepThroughDay(page: import('@playwright/test').Page): Promise<void> {
  await page.getByTestId('hud-menu').click();
  await page.getByTestId('pause-sleep').click();
  await expect(page.getByTestId('day-summary')).toBeVisible({ timeout: 8000 });
  await page.getByTestId('day-summary-continue').click();
}

test.describe('VS-A5 — Complete-loop slice gate', () => {
  test('full Day 1 → Day 2 loop: gather + plant + sleep + budgets stay green', async ({
    page,
  }) => {
    await newGameWithPerf(page);
    await assertWithinBudget(page, 'Farm');

    // 1. Gather one tide-shell forage item.
    await page.evaluate(() => window.sturdyVolleyDebug!.warpToEntity('forage-shell-a'));
    await page.waitForTimeout(150);
    await pressInteract(page);
    // Poll for the tide-shell to land in the hotbar — the engine update tick
    // that consumes the entity and adds the item can lag on slow CI frames.
    await page.waitForFunction(
      () =>
        window.sturdyVolleyDebug!.hotbarSlots().some((s) => s?.itemId === 'tide-shell'),
      null,
      { timeout: 5000 },
    );
    const hotbarAfterShell = await page.evaluate(() =>
      window.sturdyVolleyDebug!.hotbarSlots(),
    );
    expect(hotbarAfterShell.find((s) => s?.itemId === 'tide-shell')?.qty).toBe(1);

    // 2. Plant the starter Bell Pea Seeds — warp into the tilled plot.
    await page.evaluate(() => {
      const sv = (
        window as unknown as {
          sturdyVolley?: {
            engine: {
              scenes: { meshes: { name: string; position: { set: (x: number, y: number, z: number) => void } }[] }[];
            };
          };
        }
      ).sturdyVolley;
      if (!sv) return;
      for (const scene of sv.engine.scenes) {
        for (const mesh of scene.meshes) {
          if (mesh.name === 'player') mesh.position.set(-6, 0.9, -4);
        }
      }
    });
    await page.waitForTimeout(150);
    await pressInteract(page);
    await page.waitForTimeout(150);

    // 3. Sleep — Day 2.
    await sleepThroughDay(page);
    await expect(page.getByText('Spring 2', { exact: false })).toBeVisible();

    // 4. Town visit — assert Mara renders + Town stays in budget.
    await page.evaluate(() =>
      (window as unknown as {
        sturdyVolley?: {
          manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> };
        };
      }).sturdyVolley?.manager.goTo('Town', undefined, false),
    );
    await expect(page.getByText('Ballast Bay', { exact: false })).toBeVisible();
    await assertWithinBudget(page, 'Town');
    const hasMara = await page.evaluate(() => {
      const sv = (
        window as unknown as { sturdyVolley?: { engine: { scenes: { meshes: { name: string }[] }[] } } }
      ).sturdyVolley;
      if (!sv) return false;
      for (const scene of sv.engine.scenes) {
        for (const mesh of scene.meshes) if (mesh.name === 'npc-mara-vale-torso') return true;
      }
      return false;
    });
    expect(hasMara, 'Mara should render on Town in Day 2').toBe(true);

    // 5. Interior visit — assert budget.
    await page.evaluate(() =>
      (window as unknown as {
        sturdyVolley?: {
          manager: { goTo: (k: string, d?: unknown, fade?: boolean) => Promise<void> };
        };
      }).sturdyVolley?.manager.goTo('Interior', { entry: 'inside-door' }, false),
    );
    await expect(page.getByText('Farmhouse', { exact: false })).toBeVisible();
    await assertWithinBudget(page, 'Interior');
  });
});
