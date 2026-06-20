/**
 * Narrow Havok bootstrap (WEF-02a, Prompt 031). Loads the Havok WASM physics
 * engine and returns a Babylon `HavokPlugin`, or `null` if the WASM fails to
 * load (e.g. an environment that can't fetch/instantiate it). The caller falls
 * back to the ray-pick motor backend so the motor is never blocked on physics
 * availability — see `src/physics/motor-physics.ts`.
 *
 * Verified against the pinned packages: @babylonjs/core 7.54.3 +
 * @babylonjs/havok 1.3.12. The Havok ESM build resolves its `.wasm` via
 * `new URL('HavokPhysics.wasm', import.meta.url)`, so `@babylonjs/havok` is in
 * Vite's `optimizeDeps.exclude` (see vite.config.ts).
 */
import { HavokPlugin, Vector3, type Scene } from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';

/** Default world gravity (m/s²). Matches the motor's own gravity sign/scale. */
export const WORLD_GRAVITY = new Vector3(0, -22, 0);

/** Load Havok + build the plugin. Returns null on any failure (logged). */
export async function initHavok(): Promise<HavokPlugin | null> {
  try {
    const havok = await HavokPhysics();
    return new HavokPlugin(true, havok);
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[Sturdy Volley] Havok init failed; using ray-pick fallback.', err);
    return null;
  }
}

/** Enable the Havok physics world on a scene. Safe to call once per scene. */
export function enableScenePhysics(scene: Scene, plugin: HavokPlugin): boolean {
  return scene.enablePhysics(WORLD_GRAVITY, plugin);
}
