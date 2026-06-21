import { describe, it, expect } from 'vitest';
import {
  FLORA_FAMILIES,
  floraFamily,
  windStrength,
  windVector,
  modulateWind,
  swayAngle,
  interactionBend,
  floraTier,
  assignFloraTiers,
  activeDeformingCount,
  DEFAULT_WIND,
  DEFAULT_FLORA_PERF,
  type FloraInstanceRef,
} from '../../src/engine/flora-motion';

describe('flora motion — families', () => {
  it('defines every family with all required fields', () => {
    const ids = Object.keys(FLORA_FAMILIES);
    expect(ids.length).toBe(9);
    for (const fam of Object.values(FLORA_FAMILIES)) {
      expect(fam.label.length).toBeGreaterThan(0);
      expect(['wind', 'water', 'tide']).toContain(fam.motionSource);
      expect(fam.bendPoints).toBeGreaterThanOrEqual(1);
      expect(fam.stiffness).toBeGreaterThanOrEqual(0);
      expect(fam.stiffness).toBeLessThanOrEqual(1);
      expect(fam.swayAmplitude).toBeGreaterThan(0);
      expect(['part', 'brush', 'push', 'none']).toContain(fam.interaction);
      expect(fam.distanceTiers[0]).toBeLessThan(fam.distanceTiers[1]);
      expect(fam.reducedMotionAmplitude).toBeLessThan(fam.swayAmplitude);
      expect(['billboard', 'static', 'reduced']).toContain(fam.mobileFallback);
    }
  });

  it('families are distinct (trees are stiff + non-interactive; reeds are limp + pushed)', () => {
    const tree = floraFamily('tree');
    const reed = floraFamily('reed');
    expect(tree.stiffness).toBeGreaterThan(reed.stiffness);
    expect(tree.interaction).toBe('none');
    expect(reed.interaction).toBe('push');
    // Kelp + foam are water/tide driven, not wind.
    expect(floraFamily('kelp').motionSource).toBe('water');
    expect(floraFamily('foam').motionSource).toBe('tide');
  });
});

describe('flora motion — wind', () => {
  it('wind strength stays in [0,1] and gusts over time (coherent, not constant)', () => {
    const samples = Array.from({ length: 40 }, (_, i) => windStrength(i * 0.5));
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    expect(max - min, 'wind gusts (varies over time)').toBeGreaterThan(0.1);
  });

  it('storm strengthens, fog calms, winter stiffens the wind drive', () => {
    const clear = modulateWind(DEFAULT_WIND, 'summer', 'clear');
    const storm = modulateWind(DEFAULT_WIND, 'summer', 'storm');
    const fog = modulateWind(DEFAULT_WIND, 'summer', 'fog');
    const winter = modulateWind(DEFAULT_WIND, 'winter', 'clear');
    expect(storm.baseStrength).toBeGreaterThan(clear.baseStrength);
    expect(fog.baseStrength).toBeLessThan(clear.baseStrength);
    expect(winter.baseStrength).toBeLessThan(clear.baseStrength);
    // Modulated strength never escapes [0,1].
    expect(storm.baseStrength).toBeLessThanOrEqual(1);
  });

  it('wind vector points along the configured direction', () => {
    const v = windVector(2.0, { ...DEFAULT_WIND, direction: 0, baseStrength: 0.5, gustStrength: 0 });
    // direction 0 → atan2(x,z)=0 → +Z.
    expect(v.z).toBeGreaterThan(0);
    expect(Math.abs(v.x)).toBeLessThan(1e-9);
  });
});

describe('flora motion — sway', () => {
  it('repeated plants of one family never move in lockstep (per-instance phase)', () => {
    const grass = floraFamily('grass');
    const a = swayAngle(grass, 0.0, 3.3);
    const b = swayAngle(grass, 2.1, 3.3);
    const c = swayAngle(grass, 4.7, 3.3);
    expect(a).not.toBeCloseTo(b, 3);
    expect(b).not.toBeCloseTo(c, 3);
  });

  it('reduced motion collapses the sway to a tiny ambient amplitude', () => {
    const reed = floraFamily('reed');
    let maxFull = 0;
    let maxReduced = 0;
    for (let t = 0; t < 20; t += 0.25) {
      maxFull = Math.max(maxFull, Math.abs(swayAngle(reed, 1.0, t, DEFAULT_WIND, false)));
      maxReduced = Math.max(maxReduced, Math.abs(swayAngle(reed, 1.0, t, DEFAULT_WIND, true)));
    }
    expect(maxReduced).toBeLessThan(maxFull);
    expect(maxReduced).toBeLessThanOrEqual(reed.reducedMotionAmplitude + 1e-9);
  });

  it('water/tide families do not depend on the wind config (kelp uses a current)', () => {
    const kelp = floraFamily('kelp');
    const calm = swayAngle(kelp, 0.5, 4.0, { ...DEFAULT_WIND, baseStrength: 0, gustStrength: 0 });
    expect(Math.abs(calm), 'kelp still undulates with no wind').toBeGreaterThan(0);
  });

  it('is deterministic: identical inputs → identical output', () => {
    const f = floraFamily('flower');
    expect(swayAngle(f, 1.23, 5.6)).toBe(swayAngle(f, 1.23, 5.6));
  });
});

describe('flora motion — interaction', () => {
  it('movers bend interactive flora and never bend trees/hanging props', () => {
    const grass = floraFamily('grass');
    const tree = floraFamily('tree');
    expect(interactionBend(grass, 0.5, 2)).toBeGreaterThan(0);
    expect(interactionBend(grass, 5, 2), 'no bend beyond reach').toBe(0);
    expect(interactionBend(tree, 0.1, 2), 'trees ignore movers').toBe(0);
    // Closer → stronger.
    expect(interactionBend(grass, 0.2, 2)).toBeGreaterThan(interactionBend(grass, 1.5, 2));
  });
});

describe('flora motion — tiers + active-deformation ceiling', () => {
  it('tiers a single instance by distance', () => {
    const grass = floraFamily('grass'); // [14, 30]
    expect(floraTier(5, grass)).toBe('full');
    expect(floraTier(20, grass)).toBe('reduced');
    expect(floraTier(50, grass)).toBe('billboard');
  });

  it('enforces the active-deformation ceiling (mobile throttle)', () => {
    const grass = floraFamily('grass');
    // 200 near instances, all within the full range — far more than the cap.
    const instances: FloraInstanceRef[] = Array.from({ length: 200 }, (_, i) => ({
      id: `g${i}`,
      distance: i * 0.05, // all ≤ 10 m → all want 'full'
      family: grass,
    }));
    const tiers = assignFloraTiers(instances, DEFAULT_FLORA_PERF);
    expect(activeDeformingCount(tiers)).toBe(DEFAULT_FLORA_PERF.activeCap);
    // The nearest instance is always full; the farthest overflowed to billboard.
    expect(tiers.get('g0')).toBe('full');
    expect(tiers.get('g199')).toBe('billboard');
  });

  it('is deterministic across runs (ties break by id)', () => {
    const grass = floraFamily('grass');
    const mk = (): FloraInstanceRef[] => Array.from({ length: 60 }, (_, i) => ({ id: `g${i}`, distance: 10, family: grass }));
    const a = assignFloraTiers(mk());
    const b = assignFloraTiers(mk());
    expect([...a.entries()]).toEqual([...b.entries()]);
  });
});
