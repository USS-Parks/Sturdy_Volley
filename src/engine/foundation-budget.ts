/**
 * Foundation performance budgets (WEF-12, master Prompt 052). Pure data + a
 * checker — no Babylon — so the post-foundation budget is the normative contract
 * every WEF environment must hold, on desktop and on a Pixel 5, with
 * representative populations. The numbers are mirrored into the normative
 * `docs/SCALE_AND_PERFORMANCE.md`.
 *
 * These are **hard ceilings**: a breach is a budget failure, not a number to
 * relax (a waiver is entered in the DEVLOG with a recovery prompt). Live
 * mesh/draw measurement runs in the per-map Playwright tours + the perf overlay;
 * real-device FPS is a documented manual check (§0.2 #8).
 */

export type FoundationEnvironmentId =
  | 'breakpoint-farm'
  | 'farmhouse-interior'
  | 'ballast-bay-town'
  | 'klam-ity-river'
  | 'rainhall-caverns';

/** Every metric the foundation budget covers (acceptance §1). */
export interface FoundationBudget {
  minFps: number;
  maxFrameMs: number;
  maxDrawCalls: number;
  maxTriangles: number;
  maxActiveMeshes: number;
  maxPhysicsBodies: number;
  maxCharacterMotors: number;
  maxNavAgents: number;
  maxSkinnedMeshes: number;
  maxDeformingFlora: number;
  maxStreamedMemoryMB: number;
  maxChunkTransitionMs: number;
  maxRegionDownloadMB: number;
}

export type Platform = 'desktop' | 'mobile';

const mobile = (b: Partial<FoundationBudget> & Pick<FoundationBudget, 'maxDrawCalls' | 'maxTriangles' | 'maxActiveMeshes'>): FoundationBudget => ({
  minFps: 30,
  maxFrameMs: 1000 / 30,
  maxPhysicsBodies: 24,
  maxCharacterMotors: 12,
  maxNavAgents: 16,
  maxSkinnedMeshes: 14,
  maxDeformingFlora: 48,
  maxStreamedMemoryMB: 96,
  maxChunkTransitionMs: 250,
  maxRegionDownloadMB: 12,
  ...b,
});

/** Desktop = the mobile ceilings with 2× headroom on the GPU-bound metrics. */
function desktopFrom(m: FoundationBudget): FoundationBudget {
  return {
    ...m,
    minFps: 60,
    maxFrameMs: 1000 / 60,
    maxDrawCalls: m.maxDrawCalls * 2,
    maxTriangles: m.maxTriangles * 2,
    maxActiveMeshes: m.maxActiveMeshes * 2,
    maxSkinnedMeshes: m.maxSkinnedMeshes * 2,
    maxDeformingFlora: m.maxDeformingFlora * 2,
  };
}

const MOBILE_BUDGETS: Record<FoundationEnvironmentId, FoundationBudget> = {
  'breakpoint-farm': mobile({ maxDrawCalls: 240, maxTriangles: 240000, maxActiveMeshes: 220 }),
  'farmhouse-interior': mobile({ maxDrawCalls: 140, maxTriangles: 100000, maxActiveMeshes: 120, maxNavAgents: 8, maxPhysicsBodies: 12 }),
  'ballast-bay-town': mobile({ maxDrawCalls: 260, maxTriangles: 260000, maxActiveMeshes: 240 }),
  'klam-ity-river': mobile({ maxDrawCalls: 220, maxTriangles: 220000, maxActiveMeshes: 200 }),
  'rainhall-caverns': mobile({ maxDrawCalls: 200, maxTriangles: 180000, maxActiveMeshes: 180 }),
};

export const FOUNDATION_BUDGETS: Record<FoundationEnvironmentId, Record<Platform, FoundationBudget>> = Object.fromEntries(
  (Object.keys(MOBILE_BUDGETS) as FoundationEnvironmentId[]).map((id) => [id, { mobile: MOBILE_BUDGETS[id], desktop: desktopFrom(MOBILE_BUDGETS[id]) }]),
) as Record<FoundationEnvironmentId, Record<Platform, FoundationBudget>>;

/** Initial-download budget (the runtime bundle; streamed `.glb` is per-region). */
export const INITIAL_DOWNLOAD_BUDGET = { maxMainChunkGzipMB: 2.5, maxInitialMB: 5, hardCapMB: 35 };

export interface FoundationMetrics extends Partial<FoundationBudget> {
  fps?: number;
  drawCalls?: number;
  triangles?: number;
  activeMeshes?: number;
  physicsBodies?: number;
  characterMotors?: number;
  navAgents?: number;
  skinnedMeshes?: number;
  deformingFlora?: number;
  streamedMemoryMB?: number;
  chunkTransitionMs?: number;
  regionDownloadMB?: number;
}

export interface BudgetBreach {
  metric: string;
  measured: number;
  limit: number;
}

/** Check a sample of measured metrics against a budget. Missing metrics skip. */
export function withinBudget(metrics: FoundationMetrics, budget: FoundationBudget): { ok: boolean; breaches: BudgetBreach[] } {
  const breaches: BudgetBreach[] = [];
  const ceil = (measured: number | undefined, limit: number, metric: string): void => {
    if (measured !== undefined && measured > limit) breaches.push({ metric, measured, limit });
  };
  const floor = (measured: number | undefined, limit: number, metric: string): void => {
    if (measured !== undefined && measured < limit) breaches.push({ metric, measured, limit });
  };
  floor(metrics.fps, budget.minFps, 'fps');
  ceil(metrics.drawCalls, budget.maxDrawCalls, 'drawCalls');
  ceil(metrics.triangles, budget.maxTriangles, 'triangles');
  ceil(metrics.activeMeshes, budget.maxActiveMeshes, 'activeMeshes');
  ceil(metrics.physicsBodies, budget.maxPhysicsBodies, 'physicsBodies');
  ceil(metrics.characterMotors, budget.maxCharacterMotors, 'characterMotors');
  ceil(metrics.navAgents, budget.maxNavAgents, 'navAgents');
  ceil(metrics.skinnedMeshes, budget.maxSkinnedMeshes, 'skinnedMeshes');
  ceil(metrics.deformingFlora, budget.maxDeformingFlora, 'deformingFlora');
  ceil(metrics.streamedMemoryMB, budget.maxStreamedMemoryMB, 'streamedMemoryMB');
  ceil(metrics.chunkTransitionMs, budget.maxChunkTransitionMs, 'chunkTransitionMs');
  ceil(metrics.regionDownloadMB, budget.maxRegionDownloadMB, 'regionDownloadMB');
  return { ok: breaches.length === 0, breaches };
}

export function budgetFor(env: FoundationEnvironmentId, platform: Platform): FoundationBudget {
  return FOUNDATION_BUDGETS[env][platform];
}

export function foundationEnvironments(): FoundationEnvironmentId[] {
  return Object.keys(FOUNDATION_BUDGETS) as FoundationEnvironmentId[];
}
