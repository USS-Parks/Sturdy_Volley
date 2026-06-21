import { describe, it, expect } from 'vitest';
import {
  RIDDEN_MOTOR_CONFIG,
  RIDDEN_GAITS,
  RIDDEN_ACCEL,
  RIDDEN_BRAKE,
  MOUNT_DURATION,
  riddenGaitSpeed,
  gaitIndexFromThrottle,
  rampSpeed,
  createMountState,
  canMount,
  beginMount,
  beginDismount,
  stepMountTransition,
  toggleMount,
  isRidden,
  shouldUseMountedCamera,
  dismountPose,
  serializeMount,
  restoreMount,
  type MountState,
} from '../../src/engine/mount';
import {
  DEFAULT_MOTOR_CONFIG,
  createMotorState,
  stepMotor,
  flatGround,
  openEnv,
} from '../../src/engine/motor';

describe('mount — ridden locomotion profile', () => {
  it('is a distinct, faster profile than the on-foot player motor', () => {
    // Gallop tops the player run; the ridden capsule is the larger horse+rider.
    const gallop = RIDDEN_GAITS[RIDDEN_GAITS.length - 1].speed;
    expect(gallop).toBeGreaterThan(10);
    expect(RIDDEN_MOTOR_CONFIG.capsuleHeight).toBeGreaterThan(DEFAULT_MOTOR_CONFIG.capsuleHeight);
    expect(RIDDEN_MOTOR_CONFIG.capsuleRadius).toBeGreaterThan(DEFAULT_MOTOR_CONFIG.capsuleRadius);
    // Turning is deliberately a wider arc than on foot (a horse cannot pivot).
    expect(RIDDEN_MOTOR_CONFIG.turnRate).toBeLessThan(DEFAULT_MOTOR_CONFIG.turnRate);
    // Fords shallow water (wades), so swimDepth stays at the wade/swim threshold.
    expect(RIDDEN_MOTOR_CONFIG.swimDepth).toBeGreaterThan(0);
  });

  it('ridden gait bands run halt → gallop, strictly increasing', () => {
    expect(RIDDEN_GAITS[0].speed).toBe(0);
    for (let i = 1; i < RIDDEN_GAITS.length; i++) {
      expect(RIDDEN_GAITS[i].speed).toBeGreaterThan(RIDDEN_GAITS[i - 1].speed);
    }
  });

  it('riddenGaitSpeed clamps the index to the band table', () => {
    expect(riddenGaitSpeed(0)).toBe(0);
    expect(riddenGaitSpeed(99)).toBe(RIDDEN_GAITS[RIDDEN_GAITS.length - 1].speed);
    expect(riddenGaitSpeed(-5)).toBe(0);
  });

  it('gaitIndexFromThrottle maps the throttle across the bands', () => {
    expect(gaitIndexFromThrottle(0)).toBe(0);
    expect(gaitIndexFromThrottle(1)).toBe(RIDDEN_GAITS.length - 1);
    expect(gaitIndexFromThrottle(0.5)).toBe(Math.round(0.5 * (RIDDEN_GAITS.length - 1)));
    expect(gaitIndexFromThrottle(5)).toBe(RIDDEN_GAITS.length - 1); // clamps high
  });

  it('rampSpeed accelerates and brakes without overshoot', () => {
    // Accelerate toward a faster gait.
    let s = rampSpeed(0, 11, 0.1);
    expect(s).toBeCloseTo(RIDDEN_ACCEL * 0.1, 6);
    expect(s).toBeLessThan(11);
    // A big step never overshoots the target.
    expect(rampSpeed(0, 2, 10)).toBe(2);
    // Braking down to a slower gait, no undershoot.
    s = rampSpeed(11, 0, 0.1);
    expect(s).toBeCloseTo(11 - RIDDEN_BRAKE * 0.1, 6);
    expect(rampSpeed(5, 0, 10)).toBe(0);
  });
});

describe('mount — state machine', () => {
  const horse = { x: 0, z: 0 };
  const REACH = 2;

  it('starts free and owned', () => {
    const s = createMountState();
    expect(s.phase).toBe('free');
    expect(s.owned).toBe(true);
    expect(isRidden(s)).toBe(false);
  });

  it('canMount requires free + owned + in reach', () => {
    const s = createMountState();
    expect(canMount({ x: 1, z: 0 }, horse, REACH, s)).toBe(true);
    expect(canMount({ x: 5, z: 0 }, horse, REACH, s)).toBe(false); // out of reach
    expect(canMount({ x: 1, z: 0 }, horse, REACH, createMountState(false))).toBe(false); // not owned
    expect(canMount({ x: 1, z: 0 }, horse, REACH, beginMount(s))).toBe(false); // not free
  });

  it('mount blend completes free → mounting → ridden after MOUNT_DURATION', () => {
    let s = createMountState();
    s = beginMount(s);
    expect(s.phase).toBe('mounting');
    // Half-way: still mounting.
    s = stepMountTransition(s, MOUNT_DURATION / 2);
    expect(s.phase).toBe('mounting');
    expect(s.transition).toBeGreaterThan(0);
    expect(s.transition).toBeLessThan(1);
    // Past the duration: ridden.
    s = stepMountTransition(s, MOUNT_DURATION);
    expect(s.phase).toBe('ridden');
    expect(isRidden(s)).toBe(true);
    expect(s.transition).toBe(0);
  });

  it('dismount blend completes ridden → dismounting → free', () => {
    let s: MountState = { ...createMountState(), phase: 'ridden' };
    s = beginDismount(s);
    expect(s.phase).toBe('dismounting');
    s = stepMountTransition(s, MOUNT_DURATION + 0.01);
    expect(s.phase).toBe('free');
  });

  it('transition stepping is a no-op in the stable free/ridden phases', () => {
    const free = createMountState();
    expect(stepMountTransition(free, 1)).toEqual(free);
    const ridden = { ...createMountState(), phase: 'ridden' as const };
    expect(stepMountTransition(ridden, 1)).toEqual(ridden);
  });

  it('toggleMount is a one-button contextual action', () => {
    // Near + free → begins mounting.
    let s = toggleMount(createMountState(), { x: 1, z: 0 }, horse, REACH);
    expect(s.phase).toBe('mounting');
    // Ridden → begins dismounting.
    s = toggleMount({ ...createMountState(), phase: 'ridden' }, { x: 1, z: 0 }, horse, REACH);
    expect(s.phase).toBe('dismounting');
    // Free but out of reach → no change.
    const far = createMountState();
    expect(toggleMount(far, { x: 9, z: 0 }, horse, REACH)).toEqual(far);
  });

  it('hands the camera to the mounted context for mounting + ridden only', () => {
    expect(shouldUseMountedCamera(createMountState())).toBe(false); // free
    expect(shouldUseMountedCamera({ ...createMountState(), phase: 'mounting' })).toBe(true);
    expect(shouldUseMountedCamera({ ...createMountState(), phase: 'ridden' })).toBe(true);
    // Reverts at dismount so the blend back to on-foot has the full duration.
    expect(shouldUseMountedCamera({ ...createMountState(), phase: 'dismounting' })).toBe(false);
  });
});

describe('mount — dismount pose', () => {
  it('places the rider beside the horse, never inside it', () => {
    const pose = dismountPose({ x: 10, z: 4 }, 0, 1.2);
    const gap = Math.hypot(pose.x - 10, pose.z - 4);
    expect(gap).toBeCloseTo(1.2, 6);
  });
});

describe('mount — save / restore', () => {
  it('round-trips a ridden state + horse pose + ownership', () => {
    const s = { ...createMountState(), phase: 'ridden' as const };
    const save = serializeMount(s, { x: 12, z: -3, facing: 1.1 });
    expect(save.phase).toBe('ridden');
    const r = restoreMount(save);
    expect(r.state.phase).toBe('ridden');
    expect(r.horse).toEqual({ x: 12, z: -3, facing: 1.1 });
    expect(r.state.owned).toBe(true);
  });

  it('round-trips a dismounted (free) state', () => {
    const save = serializeMount(createMountState(), { x: 1, z: 2, facing: 0 });
    expect(save.phase).toBe('free');
    expect(restoreMount(save).state.phase).toBe('free');
  });

  it('a mid-transition save snaps to its destination phase', () => {
    const mounting = { ...createMountState(), phase: 'mounting' as const };
    expect(serializeMount(mounting, { x: 0, z: 0, facing: 0 }).phase).toBe('ridden');
    const dismounting = { ...createMountState(), phase: 'dismounting' as const };
    expect(serializeMount(dismounting, { x: 0, z: 0, facing: 0 }).phase).toBe('free');
  });
});

describe('mount — ridden motor integration (deterministic)', () => {
  it('the ridden profile travels farther than the on-foot motor over the same input', () => {
    const input = { moveDir: { x: 0, z: 1 }, speed: 0 };
    const env = openEnv(flatGround(0));
    const dt = 1 / 30;

    // On foot at the player run speed.
    let foot = createMotorState({ x: 0, y: DEFAULT_MOTOR_CONFIG.capsuleHeight / 2, z: 0 });
    for (let i = 0; i < 90; i++) {
      foot = stepMotor(foot, { ...input, speed: 5 }, env, dt, DEFAULT_MOTOR_CONFIG);
    }

    // Ridden at gallop, with the momentum ramp.
    let horse = createMotorState({ x: 0, y: RIDDEN_MOTOR_CONFIG.capsuleHeight / 2, z: 0 });
    let speed = 0;
    for (let i = 0; i < 90; i++) {
      speed = rampSpeed(speed, riddenGaitSpeed(RIDDEN_GAITS.length - 1), dt);
      horse = stepMotor(horse, { ...input, speed }, env, dt, RIDDEN_MOTOR_CONFIG);
    }

    expect(horse.position.z).toBeGreaterThan(foot.position.z);
    // Both stay grounded and finite (no tunnelling / NaN).
    expect(horse.grounded).toBe(true);
    expect(Number.isFinite(horse.position.z)).toBe(true);
  });

  it('is deterministic: identical inputs → identical pose', () => {
    const run = (): number => {
      let s = createMotorState({ x: 0, y: RIDDEN_MOTOR_CONFIG.capsuleHeight / 2, z: 0 });
      let speed = 0;
      const env = openEnv(flatGround(0));
      for (let i = 0; i < 60; i++) {
        speed = rampSpeed(speed, 8, 1 / 30);
        s = stepMotor(s, { moveDir: { x: 0, z: 1 }, speed }, env, 1 / 30, RIDDEN_MOTOR_CONFIG);
      }
      return s.position.z;
    };
    expect(run()).toBe(run());
  });
});
