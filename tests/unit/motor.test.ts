import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MOTOR_CONFIG,
  NO_CEILING,
  NO_GROUND,
  NO_WALL,
  beginTraversal,
  cancelTraversal,
  createMotorState,
  flatGround,
  groundedPoseAt,
  mediumFor,
  openEnv,
  slopeAngleDeg,
  stepMotor,
  turnToward,
  type GroundHit,
  type MotorEnvironment,
} from '../../src/engine/motor';

const cfg = DEFAULT_MOTOR_CONFIG;
const HALF = cfg.capsuleHeight / 2;
const still = { moveDir: { x: 0, z: 0 }, speed: 0 };
const airEnv = openEnv(NO_GROUND);

function env(over: Partial<MotorEnvironment> = {}): MotorEnvironment {
  return { ground: flatGround(0), wall: NO_WALL, stepGround: NO_GROUND, ceiling: NO_CEILING, ...over };
}

describe('turnToward + slopeAngleDeg', () => {
  it('steps the short way and snaps when within range', () => {
    expect(turnToward(0, 1, 0.5)).toBeCloseTo(0.5, 6);
    expect(turnToward(0, 0.3, 0.5)).toBeCloseTo(0.3, 6);
    expect(turnToward(3.0, -3.0, 0.1)).toBeGreaterThan(3.0); // wrap the short way
  });
  it('reads slope angle from the normal Y', () => {
    expect(slopeAngleDeg(1)).toBeCloseTo(0, 6);
    expect(slopeAngleDeg(Math.cos((60 * Math.PI) / 180))).toBeCloseTo(60, 4);
  });
});

describe('stepMotor — grounding + gravity (031)', () => {
  it('rests on flat ground without sinking or hovering', () => {
    const s = stepMotor(createMotorState({ x: 0, y: HALF, z: 0 }), still, env(), 1 / 60);
    expect(s.grounded).toBe(true);
    expect(s.velocityY).toBe(0);
    expect(s.position.y).toBeCloseTo(HALF, 6);
  });

  it('falls under gravity when there is no ground', () => {
    const s = stepMotor(createMotorState({ x: 0, y: 5, z: 0 }), still, airEnv, 0.1);
    expect(s.grounded).toBe(false);
    expect(s.velocityY).toBeLessThan(0);
    expect(s.position.y).toBeLessThan(5);
  });

  it('falls from a height and lands at capsule rest height', () => {
    let s = createMotorState({ x: 0, y: 6, z: 0 });
    for (let i = 0; i < 600 && !s.grounded; i++) s = stepMotor(s, still, env(), 1 / 60);
    expect(s.grounded).toBe(true);
    expect(s.position.y).toBeCloseTo(HALF, 3);
  });

  it('snaps down small steps but falls off larger drops', () => {
    const g = createMotorState({ x: 0, y: HALF, z: 0 });
    const snapped = stepMotor(g, still, env({ ground: flatGround(-0.2) }), 1 / 60);
    expect(snapped.grounded).toBe(true);
    expect(snapped.position.y).toBeCloseTo(HALF - 0.2, 6);
    const dropped = stepMotor(g, still, env({ ground: flatGround(-1.0) }), 1 / 60);
    expect(dropped.grounded).toBe(false);
  });

  it('moves horizontally and turns to face the move direction', () => {
    const s = stepMotor(createMotorState({ x: 0, y: HALF, z: 0 }), { moveDir: { x: 1, z: 0 }, speed: 4 }, env(), 0.1);
    expect(s.position.x).toBeCloseTo(0.4, 6);
    let t = createMotorState({ x: 0, y: HALF, z: 0 }, 0);
    for (let i = 0; i < 120; i++) t = stepMotor(t, { moveDir: { x: 1, z: 0 }, speed: 4 }, env(), 1 / 60);
    expect(t.facing).toBeCloseTo(Math.PI / 2, 2);
  });
});

describe('stepMotor — terrain handling (032)', () => {
  it('slides down ground steeper than the slope limit', () => {
    // Steep slope, downhill toward +X (normal horizontal component points +X).
    const steep: GroundHit = { hit: true, groundY: 0, normal: { x: 0.6, y: Math.cos((70 * Math.PI) / 180), z: 0 } };
    const s = stepMotor(createMotorState({ x: 0, y: HALF, z: 0 }), still, env({ ground: steep }), 1 / 60);
    expect(s.sliding).toBe(true);
    expect(s.position.x, 'slid downhill +X').toBeGreaterThan(0);
  });

  it('does not slide on ground within the slope limit', () => {
    const gentle: GroundHit = { hit: true, groundY: 0, normal: { x: 0.2, y: Math.cos((20 * Math.PI) / 180), z: 0 } };
    const s = stepMotor(createMotorState({ x: 0, y: HALF, z: 0 }), still, env({ ground: gentle }), 1 / 60);
    expect(s.sliding).toBe(false);
  });

  it('steps up onto a small ledge in the move direction', () => {
    const e = env({
      wall: { hit: true, distance: 0.1, normal: { x: -1, y: 0, z: 0 } },
      stepGround: { hit: true, groundY: 0.2, normal: { x: 0, y: 1, z: 0 } },
    });
    const s = stepMotor(createMotorState({ x: 0, y: HALF, z: 0 }), { moveDir: { x: 1, z: 0 }, speed: 4 }, e, 0.05);
    expect(s.grounded).toBe(true);
    expect(s.position.y, 'rose onto the 0.2 m step').toBeCloseTo(HALF + 0.2, 6);
    expect(s.position.x, 'advanced past the wall').toBeGreaterThan(0);
  });

  it('does not tunnel through a wall it cannot step over', () => {
    const e = env({ wall: { hit: true, distance: 0.05, normal: { x: -1, y: 0, z: 0 } } });
    const s = stepMotor(createMotorState({ x: 0, y: HALF, z: 0 }), { moveDir: { x: 1, z: 0 }, speed: 4 }, e, 0.05);
    expect(s.position.x, 'stopped at the wall').toBeLessThan(0.1);
  });

  it('slides along a wall when moving diagonally into it', () => {
    const e = env({ wall: { hit: true, distance: 0.05, normal: { x: -1, y: 0, z: 0 } } });
    const diag = { x: Math.SQRT1_2, z: Math.SQRT1_2 };
    const s = stepMotor(createMotorState({ x: 0, y: HALF, z: 0 }), { moveDir: diag, speed: 4 }, e, 0.1);
    expect(s.position.x, 'blocked on X').toBeLessThan(0.1);
    expect(s.position.z, 'slid along Z').toBeGreaterThan(0.1);
  });

  it('blocks a step-up when the ceiling leaves no headroom', () => {
    const e = env({
      wall: { hit: true, distance: 0.1, normal: { x: -1, y: 0, z: 0 } },
      stepGround: { hit: true, groundY: 0.3, normal: { x: 0, y: 1, z: 0 } },
      ceiling: { hit: true, ceilingY: HALF * 2 + 0.05 }, // barely above the head
    });
    const s = stepMotor(createMotorState({ x: 0, y: HALF, z: 0 }), { moveDir: { x: 1, z: 0 }, speed: 4 }, e, 0.05);
    expect(s.position.y, 'did not climb the 0.3 m step').toBeLessThan(HALF + 0.1);
  });

  it('clamps the head against a low ceiling', () => {
    const ceilingY = 6.0;
    const s = stepMotor(createMotorState({ x: 0, y: 5.99, z: 0 }), still, env({ ground: NO_GROUND, ceiling: { hit: true, ceilingY } }), 1 / 60);
    expect(s.position.y).toBeLessThanOrEqual(ceilingY - HALF - cfg.skinOffset + 1e-6);
  });

  it('carries the player on a moving platform', () => {
    const s = stepMotor(createMotorState({ x: 0, y: HALF, z: 0 }), still, env({ ground: flatGround(0, { x: 3, z: 0 }) }), 0.1);
    expect(s.position.x, 'carried +0.3 m by the platform').toBeCloseTo(0.3, 6);
  });

  it('pushes out of a wall it is penetrating', () => {
    const e = env({ wall: { hit: true, distance: -0.2, normal: { x: 1, y: 0, z: 0 } } });
    const s = stepMotor(createMotorState({ x: 0, y: HALF, z: 0 }), still, e, 1 / 60);
    expect(s.position.x, 'pushed out along +X').toBeGreaterThan(0.2);
  });

  it('recovers to the last safe pose when it falls out of bounds', () => {
    const s0 = createMotorState({ x: 0, y: -30, z: 0 });
    s0.lastSafe = { x: 5, y: HALF, z: 5 };
    const s = stepMotor(s0, still, airEnv, 1 / 60);
    expect(s.position).toEqual({ x: 5, y: HALF, z: 5 });
    expect(s.grounded).toBe(true);
  });
});

describe('stepMotor — water + traversal + recovery (033)', () => {
  it('classifies the medium by water depth', () => {
    expect(mediumFor(undefined, 0, cfg)).toBe('ground');
    // feet above the surface = on dry land.
    expect(mediumFor({ surfaceY: 0.3, bedY: -0.1 }, 0.5, cfg)).toBe('ground');
    // shallow column, feet submerged = wade.
    expect(mediumFor({ surfaceY: 0.3, bedY: -0.1 }, 0, cfg)).toBe('wade');
    // deep column, feet submerged = swim.
    expect(mediumFor({ surfaceY: 0.5, bedY: -2.4 }, -0.4, cfg)).toBe('swim');
  });

  it('wades on the bed, slowed', () => {
    const water = { surfaceY: 0.3, bedY: -0.1 };
    const s = stepMotor(createMotorState({ x: 0, y: HALF, z: 0 }), { moveDir: { x: 1, z: 0 }, speed: 4 }, env({ water }), 0.1);
    expect(s.medium).toBe('wade');
    expect(s.grounded).toBe(true);
    expect(s.position.y, 'stands on the bed').toBeCloseTo(water.bedY + HALF, 6);
    expect(s.position.x, 'slowed to wade factor').toBeCloseTo(4 * cfg.wadeSpeedFactor * 0.1, 6);
  });

  it('swims (buoyant float) in deep water, slowed', () => {
    const water = { surfaceY: 0.5, bedY: -2.4 };
    let s = createMotorState({ x: 0, y: 0.5, z: 0 });
    s = stepMotor(s, { moveDir: { x: 1, z: 0 }, speed: 4 }, env({ ground: NO_GROUND, water }), 0.1);
    expect(s.medium).toBe('swim');
    expect(s.grounded).toBe(false);
    expect(s.position.y, 'eased toward the waterline').toBeLessThan(0.5);
    expect(s.position.x, 'slowed to swim factor').toBeCloseTo(4 * cfg.swimSpeedFactor * 0.1, 6);
  });

  it('runs an authored traversal to completion, ignoring input', () => {
    let s = beginTraversal(createMotorState({ x: 0, y: HALF, z: 0 }), { x: 0, y: 2.9, z: 5 }, 'climb', 0.8);
    s = stepMotor(s, { moveDir: { x: -1, z: 0 }, speed: 9 }, env(), 0.4); // input should be ignored
    expect(s.traversal, 'still traversing').not.toBeNull();
    expect(s.position.y, 'rising toward the ledge').toBeGreaterThan(HALF);
    expect(s.position.x, 'input ignored during traversal').toBeCloseTo(0, 6);
    s = stepMotor(s, still, env(), 0.5); // total 0.9 > 0.8 duration
    expect(s.traversal, 'traversal finished').toBeNull();
    expect(s.position).toEqual({ x: 0, y: 2.9, z: 5 });
    expect(s.grounded).toBe(true);
  });

  it('cancels a cancellable traversal back to its start', () => {
    let s = beginTraversal(createMotorState({ x: 1, y: HALF, z: 1 }), { x: 0, y: 5, z: 0 }, 'climb', 1, true);
    s = stepMotor(s, still, env(), 0.3);
    s = cancelTraversal(s);
    expect(s.traversal).toBeNull();
    expect(s.position).toEqual({ x: 1, y: HALF, z: 1 });
  });

  it('does not cancel a non-cancellable traversal', () => {
    const s = cancelTraversal(beginTraversal(createMotorState({ x: 0, y: HALF, z: 0 }), { x: 0, y: 5, z: 0 }, 'climb', 1, false));
    expect(s.traversal, 'still active').not.toBeNull();
  });

  it('builds a valid grounded pose for save/region recovery', () => {
    const s = groundedPoseAt(3, 4, 1.5);
    expect(s.position).toEqual({ x: 3, y: 1.5 + HALF, z: 4 });
    expect(s.grounded).toBe(true);
    expect(s.medium).toBe('ground');
  });
});
