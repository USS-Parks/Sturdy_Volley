import { describe, it, expect } from 'vitest';
import {
  createControllerState,
  stepController,
  DEFAULT_CONTROLLER_CONFIG as CFG,
} from '../../src/engine/controller';

const FWD = { x: 0, z: 1 };
const STILL = { x: 0, z: 0 };

describe('controller', () => {
  it('starts idle at full stamina', () => {
    const s = createControllerState();
    expect(s.gait).toBe('idle');
    expect(s.speed).toBe(0);
    expect(s.stamina).toBe(CFG.maxStamina);
  });

  it('accelerates toward jog speed while moving', () => {
    let s = createControllerState();
    for (let i = 0; i < 60; i++) s = stepController(s, { dir: FWD, sprint: false }, 1 / 60);
    expect(s.speed).toBeCloseTo(CFG.jogSpeed, 1);
    expect(s.gait).toBe('jog');
    expect(s.moving).toBe(true);
  });

  it('sprinting is faster and drains stamina', () => {
    let s = createControllerState();
    for (let i = 0; i < 60; i++) s = stepController(s, { dir: FWD, sprint: true }, 1 / 60);
    expect(s.speed).toBeGreaterThan(CFG.jogSpeed);
    expect(s.gait).toBe('sprint');
    expect(s.stamina).toBeLessThan(CFG.maxStamina);
  });

  it('recovers stamina when not sprinting', () => {
    let s = createControllerState();
    s = stepController(s, { dir: FWD, sprint: true }, 1);
    const drained = s.stamina;
    s = stepController(s, { dir: FWD, sprint: false }, 1);
    expect(s.stamina).toBeGreaterThan(drained);
  });

  it('decelerates to a full stop when input ends', () => {
    let s = createControllerState();
    for (let i = 0; i < 60; i++) s = stepController(s, { dir: FWD, sprint: false }, 1 / 60);
    for (let i = 0; i < 60; i++) s = stepController(s, { dir: STILL, sprint: false }, 1 / 60);
    expect(s.speed).toBe(0);
    expect(s.gait).toBe('idle');
    expect(s.moving).toBe(false);
  });

  it('throttles to exhausted speed when stamina runs out', () => {
    let s = createControllerState();
    for (let i = 0; i < 300; i++) s = stepController(s, { dir: FWD, sprint: true }, 1 / 30);
    expect(s.stamina).toBe(0);
    expect(s.speed).toBeLessThan(CFG.sprintSpeed);
  });
});
