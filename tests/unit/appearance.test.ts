import { describe, it, expect } from 'vitest';
import {
  APPEARANCE_PARTS,
  APPEARANCE_SWATCHES,
  DEFAULT_APPEARANCE,
  appearanceStateSchema,
  normalizeAppearance,
  setAppearancePart,
  resolveAppearanceColors,
  buildWardrobeParts,
  swatchFor,
} from '../../src/engine/appearance';

describe('appearance (Prompt 060)', () => {
  it('the default appearance names a real swatch for every part', () => {
    for (const part of APPEARANCE_PARTS) {
      const id = DEFAULT_APPEARANCE[part];
      expect(APPEARANCE_SWATCHES[part].some((s) => s.id === id), `${part}=${id}`).toBe(true);
    }
  });

  it('the schema fills missing parts with the defaults (pre-060 saves)', () => {
    const parsed = appearanceStateSchema.parse({});
    expect(parsed).toEqual(DEFAULT_APPEARANCE);
  });

  it('setAppearancePart changes one part and leaves the rest', () => {
    const next = setAppearancePart(DEFAULT_APPEARANCE, 'body', 'olive-shirt');
    expect(next.body).toBe('olive-shirt');
    expect(next.beanie).toBe(DEFAULT_APPEARANCE.beanie);
    expect(next.accent).toBe(DEFAULT_APPEARANCE.accent);
    // The input is not mutated.
    expect(DEFAULT_APPEARANCE.body).toBe('harbor-blue');
  });

  it('setAppearancePart ignores an unknown swatch or part (no corruption)', () => {
    expect(setAppearancePart(DEFAULT_APPEARANCE, 'body', 'no-such-swatch')).toEqual(DEFAULT_APPEARANCE);
    // @ts-expect-error — exercising a bad part id from the debug/runtime boundary.
    expect(setAppearancePart(DEFAULT_APPEARANCE, 'hairstyle', 'olive-shirt')).toEqual(DEFAULT_APPEARANCE);
  });

  it('normalizeAppearance repairs unknown ids back to the part default', () => {
    const broken = { body: 'gone', beanie: 'forest', accent: 'gone' };
    expect(normalizeAppearance(broken)).toEqual({
      body: DEFAULT_APPEARANCE.body,
      beanie: 'forest',
      accent: DEFAULT_APPEARANCE.accent,
    });
  });

  it('resolveAppearanceColors returns the chosen swatch RGB triples', () => {
    const colors = resolveAppearanceColors({ body: 'olive-shirt', beanie: 'red-knit', accent: 'sky' });
    expect(colors.body).toEqual(swatchFor('body', 'olive-shirt').rgb);
    expect(colors.beanie).toEqual(swatchFor('beanie', 'red-knit').rgb);
    expect(colors.accent).toEqual(swatchFor('accent', 'sky').rgb);
  });

  it('buildWardrobeParts marks the active swatch per part', () => {
    const rows = buildWardrobeParts({ body: 'plum', beanie: 'mustard', accent: 'gold' });
    expect(rows.map((r) => r.part)).toEqual([...APPEARANCE_PARTS]);
    const body = rows.find((r) => r.part === 'body')!;
    expect(body.swatches.find((s) => s.active)!.id).toBe('plum');
    expect(body.swatches.filter((s) => s.active)).toHaveLength(1);
  });
});
