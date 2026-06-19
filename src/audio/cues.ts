/**
 * One-shot audio cues (Prompt 018). The full audio architecture lands in
 * Prompt 035; this is a deliberate, minimal placeholder so the "audio +
 * visual states make readiness obvious" criterion is met by a real audible
 * cue when a machine finishes processing. Uses WebAudio directly; no
 * dependencies; lazily creates the context on the first cue (browsers
 * suspend audio until a user gesture, and the player must have clicked
 * Start to even reach the Farm).
 */
let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (muted) return null;
  if (ctx) return ctx;
  const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Klass = W.AudioContext ?? W.webkitAudioContext;
  if (!Klass) return null;
  try {
    ctx = new Klass();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function setAudioMuted(value: boolean): void {
  muted = value;
}

/** Resolved cleanly even when WebAudio isn't available (e.g. Node tests). */
export function playReadyChime(): void {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(660, now);
  osc.frequency.exponentialRampToValueAtTime(990, now + 0.18);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + 0.42);
}
