import { defineConfig } from 'vite';

// Base build config. Relative base keeps the build portable for static hosts
// and the future PWA/offline target (P-SPR Prompt 042).
export default defineConfig({
  base: './',
  // Pre-bundle heavy deps at dev-server start so the first page load doesn't
  // trigger an on-the-fly re-optimization + full reload.
  optimizeDeps: { include: ['@babylonjs/core', 'zod'] },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 4000,
  },
});
