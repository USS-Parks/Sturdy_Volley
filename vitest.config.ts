import { defineConfig } from 'vitest/config';

// Pure-logic + DOM-overlay unit tests. The Phaser/canvas layer is exercised by
// the Playwright e2e suite, not Vitest, so unit tests stay fast and headless.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    globals: false,
    restoreMocks: true,
  },
});
