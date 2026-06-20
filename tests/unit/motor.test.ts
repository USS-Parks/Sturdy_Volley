import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MOTOR_CONFIG,
  createMotorState,
  stepMotor,
  turnToward,
  type GroundHit,
} from '../../src/engine/motor';

const cfg = DEFAULT_MOTOR_CONFIG;
const HALF = cfg.capsuleHeight / 2;
const flat = (groundY = 0): GroundHit => ({ hit: true, groundY, normalY: 1 });
const air: GroundHit = { hit: false, groundY: 0, normalY: 1 };
const still = { moveDir: { x: 0, z: 0 }, speed: 0 };

describe('turnToward', () => {
  it('steps the short way and snaps when within range', () => {
    expect(turnToward(0, 1, 0.5)).toBeCloseTo(0.5, 6);
    expect(turnToward(0, 0.3, 0.5)).toBeCloseTo(0.3, 6); // snap
    // Wrap: from +3.0 toward -3.0 is the short way across ±π.
    const r = turnToward(3.0, -3.0, 0.1);
    expect(r).toBeGreaterThan(3.0);
  });
});

describe('stepMotor — grounding + gravity', () => {
  it('rests on flat ground without sinking or hovering', () => {
    const s0 = createMotorState({ x: 0, y: HALF, z: 0 });
    const s1 = stepMotor(s0, still, flat(0), 1 / 60);
    expect(s1.grounded).toBe(true);
    expect(s1.velocityY).toBe(0);
    expect(s1.position.y).toBeCloseTo(HALF, 6);
  });

  it('falls under gravity when there is no ground', () => {
    let s = createMotorState({ x: 0, y: 5, z: 0 });
    s = stepMotor(s, still, air, 0.1);
    expect(s.grounded).toBe(false);
    expect(s.velocityY).toBeLessThan(0);
    expect(s.position.y).toBeLessThan(5);
  });

  it('falls from a height and lands on the ground at capsule rest height', () => {
    let s = createMotorState({ x: 0, y: 6, z: 0 });
    for (let i = 0; i < 600 && !s.grounded; i++) s = stepMotor(s, still, flat(0), 1 / 60);
    expect(s.grounded).toBe(true);
    expect(s.position.y).toBeCloseTo(HALF, 3);
    expect(s.velocityY).toBe(0);
  });

  it('clamps to terminal fall speed', () => {
    let s = createMotorState({ x: 0, y: 1000, z: 0 });
    for (let i = 0; i < 600; i++) s = stepMotor(s, still, air, 1 / 60);
    expect(s.velocityY).toBeGreaterThanOrEqual(cfg.terminalFall - 1e-6);
    expect(s.velocityY).toBeLessThan(0);
  });

  it('snaps down small steps but falls off larger drops', () => {
    const grounded = createMotorState({ x: 0, y: HALF, z: 0 });
    // Ground drops 0.2 m (within snap band) → stays grounded, snapped down.
    const snapped = stepMotor(grounded, still, flat(-0.2), 1 / 60);
    expect(snapped.grounded).toBe(true);
    expect(snapped.position.y).toBeCloseTo(HALF - 0.2, 6);
    // Ground drops 1.0 m (beyond snap band) → becomes airborne.
    const dropped = stepMotor(grounded, still, flat(-1.0), 1 / 60);
    expect(dropped.grounded).toBe(false);
    expect(dropped.velocityY).toBeLessThan(0);
  });
});

describe('stepMotor — horizontal + facing', () => {
  it('moves horizontally at the controller speed', () => {
    const s0 = createMotorState({ x: 0, y: HALF, z: 0 });
    const s1 = stepMotor(s0, { moveDir: { x: 1, z: 0 }, speed: 4 }, flat(0), 0.1);
    expect(s1.position.x).toBeCloseTo(0.4, 6);
    expect(s1.position.z).toBeCloseTo(0, 6);
    expect(s1.grounded).toBe(true);
  });

  it('turns to face the move direction over time', () => {
    let s = createMotorState({ x: 0, y: HALF, z: 0 }, 0);
    // Move toward +x → target facing atan2(1,0) = π/2.
    for (let i = 0; i < 120; i++) s = stepMotor(s, { moveDir: { x: 1, z: 0 }, speed: 4 }, flat(0), 1 / 60);
    expect(s.facing).toBeCloseTo(Math.PI / 2, 2);
  });

  it('holds facing when there is no move input', () => {
    const s0 = createMotorState({ x: 0, y: HALF, z: 0 }, 1.2);
    const s1 = stepMotor(s0, still, flat(0), 1 / 60);
    expect(s1.facing).toBe(1.2);
  });
});
