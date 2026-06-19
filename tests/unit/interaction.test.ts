import { describe, it, expect } from 'vitest';
import { resolveInteraction, type InteractTarget } from '../../src/engine/interaction';

const mk = (id: string, x: number, z: number, radius: number, priority = 0): InteractTarget => ({
  id,
  kind: 'prop',
  label: id,
  x,
  z,
  radius,
  priority,
});

describe('resolveInteraction', () => {
  it('returns null when nothing is in range', () => {
    expect(resolveInteraction([mk('a', 10, 10, 1)], 0, 0)).toBeNull();
  });

  it('returns an in-range target', () => {
    expect(resolveInteraction([mk('a', 1, 0, 2)], 0, 0)?.id).toBe('a');
  });

  it('prefers higher priority over proximity', () => {
    const near = mk('near', 0.5, 0, 3, 0);
    const far = mk('far', 2, 0, 3, 5);
    expect(resolveInteraction([near, far], 0, 0)?.id).toBe('far');
  });

  it('breaks priority ties by proximity', () => {
    const near = mk('near', 1, 0, 5, 1);
    const far = mk('far', 3, 0, 5, 1);
    expect(resolveInteraction([near, far], 0, 0)?.id).toBe('near');
  });

  it('respects each target radius', () => {
    expect(resolveInteraction([mk('a', 2, 0, 1)], 0, 0)).toBeNull();
    expect(resolveInteraction([mk('a', 2, 0, 3)], 0, 0)?.id).toBe('a');
  });
});
