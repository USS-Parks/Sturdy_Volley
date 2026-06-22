import {
  musicTrack,
  ambientLayer,
  CROSSFADE_MS,
  type AudioCategory,
  type AudioSettings,
} from '../engine/audio-model';

/**
 * Procedural WebAudio synth (Prompt 061). Turns the model's track + layer
 * descriptors into placeholder voices — a detuned low-pass pad per music track,
 * filtered looping noise per ambient layer, short enveloped blips for cues. No
 * audio files exist yet (the same graybox-until-real-art stance as the meshes);
 * the synth is a deliberate placeholder for the eventual scored music + recorded
 * ambience.
 *
 * Defensive by construction: every public method is a no-op when WebAudio is
 * unavailable (Node/jsdom tests, or a browser that blocks the context), and all
 * node creation is wrapped so a synth failure can never break the game. The
 * intended state (current track / layers / settings) is tracked regardless, so
 * the director's telemetry is always accurate.
 */

type GainMap = Partial<Record<Exclude<AudioCategory, 'master'>, GainNode>>;

interface MusicVoice {
  trackId: string;
  oscillators: OscillatorNode[];
  gain: GainNode;
}

interface AmbientVoice {
  id: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
  target: number;
}

const PLAYABLE: Array<Exclude<AudioCategory, 'master'>> = ['music', 'ambient', 'sfx', 'ui'];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private category: GainMap = {};
  private noise: AudioBuffer | null = null;
  private music: MusicVoice | null = null;
  private readonly ambient = new Map<string, AmbientVoice>();
  private settings: AudioSettings | null = null;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;
    const W = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Klass = W.AudioContext ?? W.webkitAudioContext;
    if (!Klass) return null;
    try {
      const ctx = new Klass();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      for (const cat of PLAYABLE) {
        const g = ctx.createGain();
        g.connect(this.master);
        this.category[cat] = g;
      }
      this.noise = this.makeNoiseBuffer(ctx);
      if (this.settings) this.applySettings(this.settings);
      return ctx;
    } catch {
      this.ctx = null;
      return null;
    }
  }

  resume(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  }

  /** Mirror the mixer settings onto the gain graph (master node × category nodes). */
  applySettings(settings: AudioSettings): void {
    this.settings = settings;
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const masterGain = settings.master.muted ? 0 : settings.master.volume;
    this.master.gain.setTargetAtTime(masterGain, now, 0.02);
    for (const cat of PLAYABLE) {
      const node = this.category[cat];
      if (!node) continue;
      const v = settings[cat].muted ? 0 : settings[cat].volume;
      node.gain.setTargetAtTime(v, now, 0.02);
    }
  }

  currentMusicId(): string | null {
    return this.music?.trackId ?? null;
  }

  setMusic(trackId: string): void {
    const ctx = this.ensure();
    if (!ctx) return;
    if (this.music?.trackId === trackId) return;
    const def = musicTrack(trackId);
    if (!def) return;
    const dest = this.category.music;
    if (!dest) return;

    const old = this.music;
    const now = ctx.currentTime;
    const dur = CROSSFADE_MS / 1000;
    try {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(def.gain, now + dur);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(def.cutoff, now);
      filter.Q.setValueAtTime(0.7, now);
      filter.connect(gain).connect(dest);

      // A simple pad: root + fifth + octave, lightly detuned for warmth.
      const ratios = [1, 1.5, 2];
      const detune = [-4, 3, -2];
      const oscillators = ratios.map((ratio, i) => {
        const osc = ctx.createOscillator();
        osc.type = def.wave;
        osc.frequency.setValueAtTime(def.rootHz * ratio, now);
        osc.detune.setValueAtTime(detune[i] ?? 0, now);
        osc.connect(filter);
        osc.start(now);
        return osc;
      });
      this.music = { trackId, oscillators, gain };
    } catch {
      return;
    }

    if (old) {
      try {
        old.gain.gain.cancelScheduledValues(now);
        old.gain.gain.setValueAtTime(Math.max(0.0001, old.gain.gain.value), now);
        old.gain.gain.linearRampToValueAtTime(0.0001, now + dur);
        for (const osc of old.oscillators) osc.stop(now + dur + 0.2);
      } catch {
        /* best-effort teardown */
      }
    }
  }

  currentAmbientIds(): string[] {
    return [...this.ambient.keys()];
  }

  setAmbient(ids: string[]): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const dest = this.category.ambient;
    if (!dest) return;
    const now = ctx.currentTime;
    const dur = CROSSFADE_MS / 1000;
    const want = new Set(ids);

    // Fade out + retire layers no longer wanted.
    for (const [id, voice] of this.ambient) {
      if (want.has(id)) continue;
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), now);
        voice.gain.gain.linearRampToValueAtTime(0.0001, now + dur);
        voice.source.stop(now + dur + 0.2);
      } catch {
        /* best-effort */
      }
      this.ambient.delete(id);
    }

    // Fade in newly wanted layers.
    for (const id of ids) {
      if (this.ambient.has(id)) continue;
      const def = ambientLayer(id);
      if (!def || !this.noise) continue;
      try {
        const source = ctx.createBufferSource();
        source.buffer = this.noise;
        source.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = def.filter;
        filter.frequency.setValueAtTime(def.freq, now);
        filter.Q.setValueAtTime(def.q, now);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(def.gain, now + dur);
        source.connect(filter).connect(gain).connect(dest);
        source.start(now);
        this.ambient.set(id, { id, source, gain, target: def.gain });
      } catch {
        /* best-effort */
      }
    }
  }

  /** Short enveloped blip routed through the sfx (or ui) category. */
  playCue(kind: 'ready' | 'festival' | 'tool' | 'ui' | 'click'): void {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const dest = kind === 'ui' || kind === 'click' ? this.category.ui : this.category.sfx;
    if (!dest) return;
    const now = ctx.currentTime;
    try {
      if (kind === 'festival') {
        [523.25, 659.25, 783.99].forEach((freq, i) => this.blip(ctx, dest, freq, now + i * 0.12, 'triangle'));
      } else if (kind === 'ready') {
        this.blip(ctx, dest, 660, now, 'triangle', 990);
      } else if (kind === 'tool') {
        this.blip(ctx, dest, 320, now, 'square');
      } else {
        this.blip(ctx, dest, 880, now, 'sine');
      }
    } catch {
      /* best-effort */
    }
  }

  private blip(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    start: number,
    wave: OscillatorType,
    glideTo?: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + 0.18);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
    osc.connect(gain).connect(dest);
    osc.start(start);
    osc.stop(start + 0.42);
  }

  private makeNoiseBuffer(ctx: AudioContext): AudioBuffer | null {
    try {
      const length = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      // Deterministic LCG so the noise is reproducible (no Math.random reliance).
      let seed = 1337;
      for (let i = 0; i < length; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        data[i] = (seed / 0x3fffffff) - 1;
      }
      return buffer;
    } catch {
      return null;
    }
  }
}
