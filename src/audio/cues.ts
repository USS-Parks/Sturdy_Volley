import { getAudioDirector } from './audio-director';

/**
 * One-shot audio cues. Originally a standalone WebAudio placeholder (Prompt 018 /
 * 056); from the Prompt 061 audio architecture these delegate to the shared
 * {@link getAudioDirector} so cues route through the **sfx** mixer category and
 * therefore respect the per-category mute + volume controls. The public API is
 * unchanged for existing callers (machine-ready chime, festival chime). Each
 * resolves cleanly when WebAudio is unavailable (Node tests / blocked context).
 */

/** Master mute toggle — kept for back-compat; maps to the master mixer category. */
export function setAudioMuted(value: boolean): void {
  getAudioDirector().setCategoryMute('master', value);
}

/** Machine-ready chime (Prompt 018). */
export function playReadyChime(): void {
  getAudioDirector().playCue('ready');
}

/** Festival arrival / minigame-win motif (Prompt 056). */
export function playFestivalChime(): void {
  getAudioDirector().playCue('festival');
}
