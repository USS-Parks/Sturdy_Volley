/**
 * Cutscene scripting engine (Prompt 014). Pure. A Cutscene is a typed list of
 * `Beat`s the runner ticks through: camera moves, character blocking, animation
 * cues, dialogue, lighting / sound cues, choices, fades. The runner exposes a
 * single `update(dt)` that advances the cursor by the elapsed time, fires any
 * beats whose time has come, and surfaces choices the renderer collects.
 */
import type { DialogueChoice } from './dialogue';

export type CameraEase = 'linear' | 'easeInOut';

export interface CameraTarget {
  /** Free-form camera anchor id the renderer maps to a real position. */
  anchor: string;
  /** Optional offset (XYZ). */
  offset?: [number, number, number];
}

export type Beat =
  | { kind: 'wait'; seconds: number }
  | { kind: 'cameraTo'; target: CameraTarget; seconds: number; ease?: CameraEase }
  | { kind: 'shake'; intensity: number; seconds: number }
  | { kind: 'fade'; to: 'in' | 'out'; seconds: number }
  | { kind: 'moveCharacter'; npcId: string; anchor: string; seconds: number }
  | { kind: 'faceCharacter'; npcId: string; lookAtAnchor: string }
  | { kind: 'playAnimation'; npcId: string; clip: string; loop?: boolean }
  | { kind: 'holdProp'; npcId: string; itemId: string }
  | { kind: 'releaseProp'; npcId: string }
  | { kind: 'dialogue'; speakerNpcId: string; body: string; portrait?: string }
  | { kind: 'lighting'; preset: string; seconds: number }
  | { kind: 'sound'; cueId: string; volume?: number }
  | { kind: 'choice'; choices: DialogueChoice[] }
  | { kind: 'giveItem'; itemId: string; qty: number; quality?: number }
  | { kind: 'setFlag'; flag: string; value: string | number | boolean };

export interface Cutscene {
  id: string;
  /** Whether the player can skip after their first viewing. */
  skippableAfterFirstView: boolean;
  beats: readonly Beat[];
}

export interface CutsceneCursor {
  index: number;
  /** Time spent on the current beat (seconds). */
  elapsed: number;
}

export function createCursor(): CutsceneCursor {
  return { index: 0, elapsed: 0 };
}

export interface FiredBeat {
  index: number;
  beat: Beat;
}

export interface UpdateResult {
  cursor: CutsceneCursor;
  fired: FiredBeat[];
  /** Outstanding choice the renderer must resolve before we advance further. */
  awaitChoice?: { index: number; choices: DialogueChoice[] };
  /** True once we've stepped past the last beat. */
  ended: boolean;
}

function beatDuration(beat: Beat): number {
  switch (beat.kind) {
    case 'wait':
      return beat.seconds;
    case 'cameraTo':
    case 'shake':
    case 'fade':
    case 'moveCharacter':
    case 'lighting':
      return beat.seconds;
    case 'dialogue':
      // Dialogue defaults to 0 — the renderer holds the line on screen until the
      // player taps; advancing is up to `advancePastDialogue`.
      return 0;
    case 'choice':
      return 0;
    default:
      return 0;
  }
}

/**
 * Tick the cursor forward by `dt`. Fires any beat whose duration has elapsed.
 * Dialogue + choice beats fire and then stall the cursor until the caller
 * invokes `advancePastBeat`.
 */
export function update(
  cutscene: Cutscene,
  cursor: CutsceneCursor,
  dt: number,
): UpdateResult {
  let { index, elapsed } = cursor;
  const fired: FiredBeat[] = [];
  let remaining = Math.max(0, dt);

  while (index < cutscene.beats.length) {
    const beat = cutscene.beats[index]!;
    const duration = beatDuration(beat);
    if (beat.kind === 'dialogue' || beat.kind === 'choice') {
      // Fire the beat exactly once.
      if (elapsed === 0) fired.push({ index, beat });
      elapsed = Number.EPSILON;
      if (beat.kind === 'choice') {
        return {
          cursor: { index, elapsed },
          fired,
          awaitChoice: { index, choices: beat.choices },
          ended: false,
        };
      }
      return { cursor: { index, elapsed }, fired, ended: false };
    }
    if (elapsed === 0) fired.push({ index, beat });
    if (duration <= 0) {
      // Instant beat — advance.
      index += 1;
      elapsed = 0;
      continue;
    }
    const consumed = Math.min(remaining, duration - elapsed);
    elapsed += consumed;
    remaining -= consumed;
    if (elapsed >= duration) {
      index += 1;
      elapsed = 0;
    } else {
      break;
    }
  }
  return {
    cursor: { index, elapsed },
    fired,
    ended: index >= cutscene.beats.length,
  };
}

/** Caller invokes this after the player taps through dialogue / picks a choice. */
export function advancePastBeat(cursor: CutsceneCursor): CutsceneCursor {
  return { index: cursor.index + 1, elapsed: 0 };
}

/** Walk straight to the end — used when a player skips a cutscene. */
export function skipToEnd(cutscene: Cutscene): CutsceneCursor {
  return { index: cutscene.beats.length, elapsed: 0 };
}

/**
 * Collect every state-mutating beat in order (setFlag / giveItem). Useful to
 * apply all of a cutscene's permanent side-effects when it's skipped or
 * replayed.
 */
export function collectSideEffects(cutscene: Cutscene): Beat[] {
  return cutscene.beats.filter(
    (b): b is Beat & { kind: 'setFlag' | 'giveItem' } =>
      b.kind === 'setFlag' || b.kind === 'giveItem',
  );
}
