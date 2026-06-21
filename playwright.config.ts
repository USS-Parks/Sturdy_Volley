import { defineConfig, devices } from '@playwright/test';

// e2e runs against the production preview build (static, deterministic) rather
// than the dev server, which avoids Vite HMR / dep re-optimization reload races
// under parallel workers and tests the actual shipped artifact.
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

// Smoke + layout coverage on desktop and mobile viewports (P-SPR Prompt 001).
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // The suite runs serially on a software-WebGL (SwiftShader) runner; as it has
  // grown (now ~340 tests, a ~20-min serial run) the heaviest tests (machine
  // 12h fast-forward, pet swap, quest forage-loop) intermittently exhaust the
  // per-test budget under CI load. They are deterministically green locally at
  // retries:0, so this is environment timing flakiness — give CI two retries and
  // a larger per-test budget rather than masking a real failure.
  retries: process.env.CI ? 2 : 0,
  timeout: process.env.CI ? 45_000 : 30_000,
  // Babylon runs on software WebGL (SwiftShader) in headless Chromium, which is
  // CPU-heavy. Parallel game instances saturate the CPU and stall in-page
  // actionability checks, so run e2e serially for deterministic results.
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // Headless Chromium (Chrome 117+) blocklists WebGL unless SwiftShader is
    // explicitly enabled; without this Phaser's WebGL renderer throws
    // "Framebuffer Unsupported" on boot and no scenes initialize.
    launchOptions: {
      args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
    },
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
});
