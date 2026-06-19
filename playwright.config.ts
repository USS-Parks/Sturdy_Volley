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
  retries: process.env.CI ? 1 : 0,
  // Phaser runs on software WebGL (SwiftShader) in headless Chromium, which is
  // CPU-heavy. Too many parallel game instances saturate the CPU and stall
  // in-page actionability checks, so keep worker count low.
  workers: process.env.CI ? 1 : 2,
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
