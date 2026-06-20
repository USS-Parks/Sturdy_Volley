import { defineConfig } from 'vite';

// Base build config. Relative base keeps the build portable for static hosts
// and the future PWA/offline target (P-SPR Prompt 042).
export default defineConfig({
  base: './',
  // Pre-bundle heavy deps at dev-server start so the first page load doesn't
  // trigger an on-the-fly re-optimization + full reload. `@babylonjs/havok` is
  // excluded: its ESM build resolves the WASM via `new URL('HavokPhysics.wasm',
  // import.meta.url)`, which Vite's dep pre-bundling rewrites and breaks — left
  // unbundled, Vite emits the .wasm as an asset and the URL resolves correctly.
  optimizeDeps: { include: ['@babylonjs/core', 'zod'], exclude: ['@babylonjs/havok'] },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 4000,
  },
});
