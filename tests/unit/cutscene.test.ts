import { describe, it, expect } from 'vitest';
import {
  advancePastBeat,
  collectSideEffects,
  createCursor,
  skipToEnd,
  update,
  type Cutscene,
} from '../../src/engine/cutscene';

const CUTSCENE: Cutscene = {
  id: 'first-light',
  skippableAfterFirstView: true,
  beats: [
    { kind: 'fade', to: 'in', seconds: 1 },
    { kind: 'cameraTo', target: { anchor: 'lighthouse' }, seconds: 2 },
    { kind: 'dialogue', speakerNpcId: 'mara-vale', body: 'There she is.' },
    {
      kind: 'choice',
      choices: [
        { id: 'help', label: 'Help her' },
        { id: 'watch', label: 'Just watch' },
      ],
    },
    { kind: 'giveItem', itemId: 'stormglass-charm', qty: 1 },
    { kind: 'setFlag', flag: 'netlight-relit', value: true },
    { kind: 'fade', to: 'out', seconds: 1 },
  ],
};

describe('update', () => {
  it('consumes a fade beat across multiple ticks', () => {
    let cursor = createCursor();
    const r1 = update(CUTSCENE, cursor, 0.4);
    expect(r1.fired.map((f) => f.beat.kind)).toEqual(['fade']);
    expect(r1.ended).toBe(false);
    cursor = r1.cursor;
    const r2 = update(CUTSCENE, cursor, 0.7); // total elapsed 1.1
    expect(r2.cursor.index).toBeGreaterThan(0); // advanced past fade
  });

  it('stalls at a dialogue beat and waits for advancePastBeat', () => {
    let cursor = createCursor();
    let acc = 0;
    while (acc < 5 && cursor.index < CUTSCENE.beats.length) {
      const r = update(CUTSCENE, cursor, 1);
      cursor = r.cursor;
      acc += 1;
      if (r.fired.some((f) => f.beat.kind === 'dialogue')) break;
    }
    const at = CUTSCENE.beats[cursor.index];
    expect(at?.kind).toBe('dialogue');
    cursor = advancePastBeat(cursor);
    expect(CUTSCENE.beats[cursor.index]?.kind).toBe('choice');
  });

  it('surfaces awaitChoice on a choice beat', () => {
    let cursor = { index: 3, elapsed: 0 };
    const r = update(CUTSCENE, cursor, 0);
    expect(r.awaitChoice?.choices).toHaveLength(2);
    cursor = advancePastBeat(r.cursor);
    expect(CUTSCENE.beats[cursor.index]?.kind).toBe('giveItem');
  });

  it('skipToEnd jumps the cursor past the last beat', () => {
    const c = skipToEnd(CUTSCENE);
    expect(c.index).toBe(CUTSCENE.beats.length);
    const r = update(CUTSCENE, c, 0);
    expect(r.ended).toBe(true);
  });
});

describe('collectSideEffects', () => {
  it('returns only the setFlag and giveItem beats', () => {
    const effects = collectSideEffects(CUTSCENE);
    expect(effects).toHaveLength(2);
    expect(effects.map((b) => b.kind)).toEqual(['giveItem', 'setFlag']);
  });
});
