import { test, expect } from '@playwright/test';

interface PerfNumbers {
  fps: number;
  drawCalls: number;
  activeMeshes: number;
  triangles: number;
}

async function startWithPerf(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/?debug=perf');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await expect(page.getByTestId('perf-overlay')).toBeVisible();
}

async function newGameWithPerf(
  page: import('@playwright/test').Page,
  name = 'Bench',
): Promise<void> {
  await startWithPerf(page);
  await page.getByTestId('title-start').click();
  await page.getByTestId('field-name').fill(name);
  await page.getByTestId('form-submit').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  // Wait for the FarmScene HUD so the perf strip has a real label to read.
  await expect(page.getByText('Breakpoint Farm', { exact: false })).toBeVisible();
}

async function readPerf(page: import('@playwright/test').Page): Promise<PerfNumbers> {
  // Let two render frames settle so the overlay reflects the current scene.
  await page.waitForTimeout(120);
  const sample = await page.evaluate(() => {
    const num = (testid: string): number => {
      const el = document.querySelector(`[data-testid="${testid}"]`);
      if (!el) return Number.NaN;
      return parseInt((el.textContent ?? '').replace(/[^\d-]/g, ''), 10);
    };
    return {
      fps: num('fps'),
      drawCalls: num('perf-draws'),
      activeMeshes: num('perf-meshes'),
      triangles: num('perf-tris'),
    };
  });
  return sample;
}

test.describe('VS-A1 mobile perf budgets', () => {
  test('Farm scene stays within the Pixel-5 budget after New Game', async ({ page }) => {
    await newGameWithPerf(page);
    const sample = await readPerf(page);
    // FPS under SwiftShader is software-rendered and unreliable in CI — assert the
    // counters we actually care about (draw calls, meshes, triangles) and read
    // FPS for diagnostics only.
    expect(
      sample.drawCalls,
      `Farm draw calls ${sample.drawCalls} should be ≤ 220 (got fps=${sample.fps})`,
    ).toBeLessThanOrEqual(220);
    expect(sample.activeMeshes, `Farm active meshes ${sample.activeMeshes} ≤ 180`).toBeLessThanOrEqual(
      180,
    );
    expect(sample.triangles, `Farm triangles ${sample.triangles} ≤ 220k`).toBeLessThanOrEqual(
      220_000,
    );
  });

  test('Town scene stays within the Pixel-5 budget when entered from the Farm', async ({ page }) => {
    await newGameWithPerf(page);
    await page.getByTestId('hud-menu').click();
    await page.getByTestId('nav-town').click();
    await expect(page.getByText('Ballast Bay', { exact: false })).toBeVisible();
    const sample = await readPerf(page);
    expect(sample.drawCalls, `Town draw calls ${sample.drawCalls} ≤ 220`).toBeLessThanOrEqual(220);
    expect(sample.activeMeshes, `Town active meshes ${sample.activeMeshes} ≤ 200`).toBeLessThanOrEqual(
      200,
    );
    expect(sample.triangles, `Town triangles ${sample.triangles} ≤ 220k`).toBeLessThanOrEqual(
      220_000,
    );
  });
});
