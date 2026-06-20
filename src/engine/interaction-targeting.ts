/**
 * Shared 3D interaction + tool-targeting resolver (WEF-03, master Prompt 034).
 * Pure + deterministic — no Babylon. Separates the interaction pipeline into
 * distinct stages so every input method (keyboard, controller, touch tap,
 * virtual stick) feeds the SAME resolver and therefore picks the SAME target:
 *
 *   discovery → scoring → selection (+ hysteresis) → facing alignment →
 *   action commitment (anticipation → impact → recovery, with a cancel window)
 *
 * The legacy `resolveInteraction` (Prompt 005, still used by FarmScene until the
 * 053 migration) stays as-is; this is the foundation resolver the proving ground
 * + future scenes use. Farming stays deterministic on the 1 m logical grid: a
 * farm-cell candidate carries its grid cell, never a render-mesh name.
 */
import { turnToward } from './motor';
import type { InteractKind } from './interaction';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface TargetCandidate {
  id: string;
  kind: InteractKind | string;
  position: Vec3;
  /** Action priority (higher wins all else equal). */
  priority: number;
  /** Max interaction distance (m). */
  reach: number;
  /** Held tool that makes this candidate fully relevant (e.g. 'hoe' for soil). */
  requiresTool?: string;
  /** Line-of-sight blocked (supplied by the scene's obstruction probe). */
  obstructed?: boolean;
  /** Deterministic logical grid cell for farm targets (never a mesh name). */
  cell?: { col: number; row: number };
}

export interface PlayerContext {
  position: Vec3;
  /** Facing yaw (rad), atan2(x, z) — matches the motor's facing convention. */
  facing: number;
  heldTool?: string;
}

export interface TargetingConfig {
  priorityWeight: number;
  facingWeight: number;
  distanceWeight: number;
  toolMatchBonus: number;
  obstructionPenalty: number;
  /** Bonus kept on the previously-chosen target to stop flicker between near-ties. */
  hysteresisBonus: number;
  /** Allow candidates slightly beyond `reach` to still be considered (m). */
  maxReachSlack: number;
  /** Turn-in-place threshold: face the target before committing if the heading
   *  error exceeds this (rad). */
  turnInPlaceThreshold: number;
}

export const DEFAULT_TARGETING_CONFIG: TargetingConfig = {
  priorityWeight: 100,
  facingWeight: 30,
  distanceWeight: 10,
  toolMatchBonus: 40,
  obstructionPenalty: 60,
  hysteresisBonus: 15,
  maxReachSlack: 0.3,
  turnInPlaceThreshold: 0.9, // ~50°
};

export interface ScoredCandidate {
  id: string;
  score: number;
  distance: number;
  inReach: boolean;
}

export interface TargetingResult {
  chosenId: string | null;
  scored: ScoredCandidate[];
}

const TWO_PI = Math.PI * 2;

function angleDiff(a: number, b: number): number {
  let d = (a - b) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  else if (d < -Math.PI) d += TWO_PI;
  return d;
}

/** Planar heading from the player to a target (atan2(x, z) convention). */
export function headingTo(from: Vec3, to: Vec3): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/**
 * Score + select the best interaction target for the player context. Input-method
 * agnostic: the same context always yields the same choice. `prevChosenId`
 * supplies sticky-target hysteresis.
 */
export function resolveTarget(
  candidates: readonly TargetCandidate[],
  player: PlayerContext,
  prevChosenId: string | null = null,
  cfg: TargetingConfig = DEFAULT_TARGETING_CONFIG,
): TargetingResult {
  const scored: ScoredCandidate[] = [];
  let chosenId: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const c of candidates) {
    const dx = c.position.x - player.position.x;
    const dz = c.position.z - player.position.z;
    const distance = Math.hypot(dx, dz);
    const inReach = distance <= c.reach;
    if (distance > c.reach + cfg.maxReachSlack) {
      scored.push({ id: c.id, score: Number.NEGATIVE_INFINITY, distance, inReach: false });
      continue;
    }

    const heading = Math.atan2(dx, dz);
    const front = Math.cos(angleDiff(player.facing, heading)); // 1 = dead ahead
    let score = c.priority * cfg.priorityWeight;
    score += front * cfg.facingWeight;
    score -= distance * cfg.distanceWeight;
    if (c.requiresTool && player.heldTool === c.requiresTool) score += cfg.toolMatchBonus;
    if (c.obstructed) score -= cfg.obstructionPenalty;
    if (c.id === prevChosenId) score += cfg.hysteresisBonus;

    scored.push({ id: c.id, score, distance, inReach });
    if (score > bestScore || (score === bestScore && distance < bestDist)) {
      bestScore = score;
      bestDist = distance;
      chosenId = c.id;
    }
  }

  return { chosenId, scored };
}

/** Whether the player must turn in place before committing to the target. */
export function turnInPlaceNeeded(facing: number, headingToTarget: number, cfg: TargetingConfig = DEFAULT_TARGETING_CONFIG): boolean {
  return Math.abs(angleDiff(facing, headingToTarget)) > cfg.turnInPlaceThreshold;
}

/** Step the facing toward a target heading (reuses the motor's shortest-arc turn). */
export function faceTarget(facing: number, headingToTarget: number, turnRate: number, dt: number): number {
  return turnToward(facing, headingToTarget, turnRate * dt);
}

// --- Action commitment lifecycle ------------------------------------------

export type ActionPhase = 'idle' | 'anticipation' | 'impact' | 'recovery';

export interface ActionTiming {
  /** Wind-up before the effect (s). */
  anticipation: number;
  /** Impact window during which the effect fires (s). */
  impact: number;
  /** Follow-through after impact (s). */
  recovery: number;
  /** How long into anticipation the action may still be cancelled (s). */
  cancelWindow: number;
}

export const DEFAULT_ACTION_TIMING: ActionTiming = {
  anticipation: 0.18,
  impact: 0.08,
  recovery: 0.22,
  cancelWindow: 0.12,
};

export interface ActionState {
  phase: ActionPhase;
  elapsed: number;
  targetId: string | null;
}

export const IDLE_ACTION: ActionState = { phase: 'idle', elapsed: 0, targetId: null };

export function beginAction(targetId: string): ActionState {
  return { phase: 'anticipation', elapsed: 0, targetId };
}

/**
 * Advance the action timeline. `impactFired` is true exactly on the step the
 * action crosses from anticipation into impact (when the effect should execute).
 */
export function stepAction(
  state: ActionState,
  dt: number,
  timing: ActionTiming = DEFAULT_ACTION_TIMING,
): { state: ActionState; impactFired: boolean } {
  if (state.phase === 'idle') return { state, impactFired: false };
  const elapsed = state.elapsed + dt;
  const wasAnticipating = state.phase === 'anticipation';

  if (elapsed < timing.anticipation) {
    return { state: { ...state, phase: 'anticipation', elapsed }, impactFired: false };
  }
  if (elapsed < timing.anticipation + timing.impact) {
    return { state: { ...state, phase: 'impact', elapsed }, impactFired: wasAnticipating };
  }
  if (elapsed < timing.anticipation + timing.impact + timing.recovery) {
    // If dt skipped the whole impact window in one step, still fire once.
    const fired = wasAnticipating;
    return { state: { ...state, phase: 'recovery', elapsed }, impactFired: fired };
  }
  return { state: { ...IDLE_ACTION }, impactFired: false };
}

/** Whether the action can still be cancelled (early in anticipation). */
export function canCancel(state: ActionState, timing: ActionTiming = DEFAULT_ACTION_TIMING): boolean {
  return state.phase === 'anticipation' && state.elapsed <= timing.cancelWindow;
}

export function cancelAction(): ActionState {
  return { ...IDLE_ACTION };
}
