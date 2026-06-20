import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ACTION_TIMING,
  beginAction,
  canCancel,
  cancelAction,
  faceTarget,
  headingTo,
  resolveTarget,
  stepAction,
  turnInPlaceNeeded,
  type TargetCandidate,
} from '../../src/engine/interaction-targeting';

const at = (id: string, x: number, z: number, over: Partial<TargetCandidate> = {}): TargetCandidate => ({
  id,
  kind: 'prop',
  position: { x, y: 0, z },
  priority: 1,
  reach: 3,
  ...over,
});

const player = (x = 0, z = 0, facing = 0, heldTool?: string) => ({ position: { x, y: 0, z }, facing, heldTool });

describe('resolveTarget', () => {
  it('picks the highest-priority in-reach target', () => {
    const r = resolveTarget([at('low', 0, 1), at('high', 0, 2, { priority: 5 })], player());
    expect(r.chosenId).toBe('high');
  });

  it('excludes targets beyond reach (+ slack)', () => {
    const r = resolveTarget([at('far', 0, 10)], player());
    expect(r.chosenId).toBeNull();
    expect(r.scored[0].inReach).toBe(false);
  });

  it('prefers the target the player is facing on an otherwise tie', () => {
    // facing +z (0). Front candidate at (0,2), side candidate at (2,0); equal dist.
    const r = resolveTarget([at('front', 0, 2), at('side', 2, 0)], player(0, 0, 0));
    expect(r.chosenId).toBe('front');
  });

  it('breaks ties by proximity', () => {
    const r = resolveTarget([at('near', 0, 1.5), at('farish', 0, 2.5)], player());
    expect(r.chosenId).toBe('near');
  });

  it('a held tool flips the choice toward the matching candidate', () => {
    const cands = [at('forage', 0, 2.0, { priority: 2 }), at('soil', 0, 2.5, { priority: 2, requiresTool: 'hoe' })];
    expect(resolveTarget(cands, player(0, 0, 0)).chosenId).toBe('forage'); // no tool → nearest
    expect(resolveTarget(cands, player(0, 0, 0, 'hoe')).chosenId).toBe('soil'); // hoe → soil
  });

  it('penalises obstructed candidates', () => {
    const r = resolveTarget([at('clear', 0, 2.2), at('blocked', 0, 2.0, { obstructed: true })], player());
    expect(r.chosenId).toBe('clear');
  });

  it('keeps the previously-chosen target on a near tie (hysteresis)', () => {
    const cands = [at('a', 0, 2.0), at('b', 0.05, 2.02)];
    // Without history, 'a' (nearer) wins; with 'b' sticky, 'b' holds.
    expect(resolveTarget(cands, player()).chosenId).toBe('a');
    expect(resolveTarget(cands, player(), 'b').chosenId).toBe('b');
  });

  it('is input-agnostic: same context → same target', () => {
    const cands = [at('x', 1, 2), at('y', -1, 2, { priority: 2 })];
    const a = resolveTarget(cands, player(0, 0, 0));
    const b = resolveTarget(cands, player(0, 0, 0));
    expect(a.chosenId).toBe(b.chosenId);
  });

  it('resolves a crowded NPC/animal/door cluster deterministically', () => {
    const cands = [
      at('npc', 0, 2.5, { kind: 'npc' }),
      at('animal', 1.2, 1.5, { kind: 'animal' }),
      at('door', 0, 1.2, { kind: 'door' }),
    ];
    // facing +z, the door is nearest + dead ahead.
    expect(resolveTarget(cands, player(0, 0, 0)).chosenId).toBe('door');
  });
});

describe('facing', () => {
  it('computes heading and turn-in-place need', () => {
    expect(headingTo({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })).toBeCloseTo(0, 6);
    expect(headingTo({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBeCloseTo(Math.PI / 2, 6);
    expect(turnInPlaceNeeded(0, Math.PI)).toBe(true); // 180° behind
    expect(turnInPlaceNeeded(0, 0.2)).toBe(false); // ~11° ahead
  });

  it('faces toward a target heading over time', () => {
    let f = 0;
    for (let i = 0; i < 120; i++) f = faceTarget(f, Math.PI / 2, 12, 1 / 60);
    expect(f).toBeCloseTo(Math.PI / 2, 3);
  });
});

describe('action lifecycle', () => {
  it('runs anticipation → impact (fires once) → recovery → idle', () => {
    const s = beginAction('t');
    expect(s.phase).toBe('anticipation');
    let r = stepAction(s, 0.1); // < 0.18
    expect(r.state.phase).toBe('anticipation');
    expect(r.impactFired).toBe(false);
    r = stepAction(r.state, 0.1); // elapsed 0.2 → impact
    expect(r.state.phase).toBe('impact');
    expect(r.impactFired).toBe(true);
    r = stepAction(r.state, 0.04); // still impact, no refire
    expect(r.impactFired).toBe(false);
    r = stepAction(r.state, 0.1); // recovery
    expect(r.state.phase).toBe('recovery');
    r = stepAction(r.state, 0.3); // done
    expect(r.state.phase).toBe('idle');
  });

  it('can cancel only early in anticipation', () => {
    const s = beginAction('t');
    expect(canCancel(s)).toBe(true);
    const late = stepAction(s, DEFAULT_ACTION_TIMING.cancelWindow + 0.02).state;
    expect(canCancel(late)).toBe(false);
    expect(cancelAction().phase).toBe('idle');
  });
});
