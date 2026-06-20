import { describe, it, expect } from 'vitest';
import {
  CAMERA_CONTEXTS,
  CAMERA_PROFILES,
  betaFromPitchDeg,
  fovRadFromDeg,
  profileById,
  variantsForContext,
} from '../../src/camera/profiles';
import {
  applyYawInput,
  clampYawOffset,
  dampToward,
  lookAheadLead,
  stepObstruction,
  stepRecenter,
  wrapAngle,
} from '../../src/camera/orbit';
import {
  applyDeadzone,
  mergeInput,
  stickToPitch,
  stickToYaw,
  DEFAULT_CAMERA_INPUT_CONFIG,
} from '../../src/camera/input';
import { containsPoint, pickVolume, type CameraVolume } from '../../src/camera/volumes';

const DEG = Math.PI / 180;

describe('camera profiles', () => {
  it('provides at least three variants for every §2 context', () => {
    for (const ctx of CAMERA_CONTEXTS) {
      expect(variantsForContext(ctx).length, `${ctx} variants`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps profile ids unique and resolvable', () => {
    const ids = CAMERA_PROFILES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(profileById('exterior:standard')?.context).toBe('exterior');
    expect(profileById('nope')).toBeUndefined();
  });

  it('converts downward view to Babylon beta (beta = 90° − pitch)', () => {
    expect(betaFromPitchDeg(30)).toBeCloseTo(60 * DEG, 6);
    expect(betaFromPitchDeg(0)).toBeCloseTo(90 * DEG, 6);
    expect(fovRadFromDeg(45)).toBeCloseTo(45 * DEG, 6);
  });

  it('keeps every variant inside its §2 table range', () => {
    const ranges: Record<string, { pitch: [number, number]; dist: [number, number]; fov: [number, number] }> = {
      exterior: { pitch: [28, 35], dist: [8, 11], fov: [45, 50] },
      farm: { pitch: [38, 46], dist: [8, 10], fov: [43, 48] },
      mounted: { pitch: [26, 32], dist: [9, 12], fov: [46, 52] },
    };
    for (const [ctx, r] of Object.entries(ranges)) {
      for (const p of variantsForContext(ctx as never)) {
        expect(p.pitchDeg).toBeGreaterThanOrEqual(r.pitch[0]);
        expect(p.pitchDeg).toBeLessThanOrEqual(r.pitch[1]);
        expect(p.followDistance).toBeGreaterThanOrEqual(r.dist[0]);
        expect(p.followDistance).toBeLessThanOrEqual(r.dist[1]);
        expect(p.fovDeg).toBeGreaterThanOrEqual(r.fov[0]);
        expect(p.fovDeg).toBeLessThanOrEqual(r.fov[1]);
      }
    }
  });
});

describe('orbit math', () => {
  const farm = profileById('farm:standard')!; // yawLimit 60°
  const exterior = profileById('exterior:standard')!;

  it('wraps angles to (-π, π]', () => {
    expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI, 6);
    expect(wrapAngle(Math.PI * 1.5)).toBeCloseTo(-Math.PI * 0.5, 6);
    expect(wrapAngle(-Math.PI * 2)).toBeCloseTo(0, 6);
  });

  it('clamps the manual yaw offset to ±limit, unbounded when null', () => {
    expect(clampYawOffset(80 * DEG, 60)).toBeCloseTo(60 * DEG, 6);
    expect(clampYawOffset(-80 * DEG, 60)).toBeCloseTo(-60 * DEG, 6);
    expect(clampYawOffset(0.3, null)).toBeCloseTo(0.3, 6);
  });

  it('applyYawInput honours the profile orbit limit', () => {
    const y = applyYawInput(0, 10, farm); // huge nudge
    expect(Math.abs(y)).toBeLessThanOrEqual(60 * DEG + 1e-6);
  });

  it('holds yaw during the recenter grace then decays to zero without overshoot', () => {
    // Before the delay: held.
    expect(stepRecenter(0.5, exterior.recenterDelay - 0.1, exterior, 0.1)).toBe(0.5);
    // After the delay: decays toward 0.
    let y = 0.5;
    for (let i = 0; i < 600; i++) y = stepRecenter(y, exterior.recenterDelay + 1, exterior, 1 / 60);
    expect(y).toBe(0);
    // Never crosses zero (sign-stable).
    const half = stepRecenter(0.01, 99, exterior, 1); // big step
    expect(half).toBe(0);
  });

  it('leads the target in the velocity direction, clamped to lookAheadMax', () => {
    const p = profileById('mounted:far')!; // gain 0.7, max 7
    expect(lookAheadLead({ x: 0, z: 0 }, p)).toEqual({ x: 0, z: 0 });
    const slow = lookAheadLead({ x: 2, z: 0 }, p);
    expect(slow.x).toBeCloseTo(2 * 0.7, 6);
    expect(slow.z).toBeCloseTo(0, 6);
    const fast = lookAheadLead({ x: 100, z: 0 }, p);
    expect(fast.x).toBeCloseTo(7, 6); // clamped to max
  });

  it('dampToward snaps when lag<=0 and converges otherwise', () => {
    expect(dampToward(0, 10, 0, 0.016)).toBe(10);
    let v = 0;
    for (let i = 0; i < 1000; i++) v = dampToward(v, 10, 0.2, 1 / 60);
    expect(v).toBeCloseTo(10, 3);
  });

  it('obstruction stays at desired when clear and pulls in (never below min) when blocked', () => {
    const p = profileById('exterior:standard')!; // min 1.6, probe 0.3
    const clear = stepObstruction(9.5, 9.5, null, p, 1);
    expect(clear.distance).toBeCloseTo(9.5, 6);
    expect(clear.fade).toBe(0);

    // Blocker at 3 m → target distance ≈ 2.7, pulled toward it.
    const blocked = stepObstruction(9.5, 9.5, 3, p, 1);
    expect(blocked.distance).toBeLessThan(9.5);
    expect(blocked.distance).toBeGreaterThanOrEqual(p.obstruction.minDistance);

    // Blocker closer than fade band → fade ramps up.
    const close = stepObstruction(2, 9.5, 1, p, 1);
    expect(close.fade).toBeGreaterThan(0);
    expect(close.distance).toBeGreaterThanOrEqual(p.obstruction.minDistance);
  });
});

describe('camera input', () => {
  const cfg = DEFAULT_CAMERA_INPUT_CONFIG;

  it('applies a radial deadzone with edge rescale', () => {
    expect(applyDeadzone(0.1, 0.18)).toBe(0);
    expect(applyDeadzone(0.18, 0.18)).toBe(0);
    expect(applyDeadzone(1, 0.18)).toBeCloseTo(1, 6);
    expect(applyDeadzone(-1, 0.18)).toBeCloseTo(-1, 6);
  });

  it('maps stick axes to yaw/pitch with dt scaling and invertY', () => {
    expect(stickToYaw(1, 1, cfg)).toBeCloseTo(cfg.stickYawRate, 6);
    expect(stickToYaw(0.1, 1, cfg)).toBe(0); // inside deadzone
    const up = stickToPitch(1, 1, { ...cfg, invertY: false });
    const inv = stickToPitch(1, 1, { ...cfg, invertY: true });
    expect(Math.sign(up)).toBe(-Math.sign(inv));
  });

  it('merges input frames (recenter is sticky-or)', () => {
    const m = mergeInput(
      { yawDelta: 0.1, pitchDelta: 0.2, recenter: false },
      { yawDelta: 0.3, pitchDelta: -0.1, recenter: true },
    );
    expect(m.yawDelta).toBeCloseTo(0.4, 6);
    expect(m.pitchDelta).toBeCloseTo(0.1, 6);
    expect(m.recenter).toBe(true);
  });
});

describe('camera volumes', () => {
  const a: CameraVolume = { id: 'a', min: { x: 0, y: 0, z: 0 }, max: { x: 4, y: 4, z: 4 }, profileId: 'farm:standard', priority: 1 };
  const b: CameraVolume = { id: 'b', min: { x: 1, y: 0, z: 1 }, max: { x: 3, y: 4, z: 3 }, profileId: 'cave:standard', priority: 5 };

  it('detects point containment', () => {
    expect(containsPoint(a, { x: 2, y: 2, z: 2 })).toBe(true);
    expect(containsPoint(a, { x: 5, y: 2, z: 2 })).toBe(false);
  });

  it('picks the highest-priority overlapping volume, null when outside all', () => {
    expect(pickVolume({ x: 2, y: 2, z: 2 }, [a, b])?.id).toBe('b');
    expect(pickVolume({ x: 0.5, y: 2, z: 0.5 }, [a, b])?.id).toBe('a');
    expect(pickVolume({ x: 9, y: 9, z: 9 }, [a, b])).toBeNull();
  });
});
