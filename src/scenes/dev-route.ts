/**
 * Dev-only direct-boot routing. Some scenes (the camera proving ground, future
 * lab scenes) are not part of the normal Title → NewGame → Farm flow but must be
 * reachable for reproducible screenshots — including in the production preview
 * build the Playwright suite runs against, where `import.meta.env.DEV` is false.
 *
 * Gating is by explicit `?scene=<key>` URL param against a small allow-list, the
 * same hidden-unless-asked pattern as the `?debug=perf` / `?debug=schedules`
 * overlays. These scenes never appear in ordinary play.
 */

/** Scene keys that may be entered directly via `?scene=<key>`. */
export const DEV_SCENES: ReadonlySet<string> = new Set(['CameraLab', 'StreamingLab', 'InteriorLab', 'NavLab', 'FaunaLab', 'WildLab', 'MountLab', 'FloraLab', 'BreakpointFarm', 'FarmhouseInterior', 'BallastBayTown', 'KlamityRiver', 'RainhallCavern', 'AssetSwapLab']);

/**
 * Returns the requested dev scene key when the current URL carries a valid
 * `?scene=<key>` for an allow-listed dev scene, otherwise null.
 */
export function requestedDevScene(search: string = location.search): string | null {
  const params = new URLSearchParams(search);
  const key = params.get('scene');
  return key && DEV_SCENES.has(key) ? key : null;
}
