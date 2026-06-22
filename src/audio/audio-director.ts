import { AudioEngine } from './audio-engine';
import {
  selectMusicTrack,
  selectAmbientLayers,
  setCategoryVolume,
  setCategoryMute,
  toggleCategoryMute,
  DEFAULT_AUDIO_SETTINGS,
  type AudioCategory,
  type AudioPlayContext,
  type AudioSettings,
} from '../engine/audio-model';

/**
 * Audio director (Prompt 061). The single, scene-spanning owner of the audio
 * state: it keeps the live mixer {@link AudioSettings}, the current music track,
 * and the current ambient layer set, drives the {@link AudioEngine} synth, and
 * exposes telemetry. It is a module singleton (not owned by any scene) so music
 * and ambience carry across scene transitions instead of restarting.
 *
 * Settings flow: the scene loads `save.audio` via {@link AudioDirector.loadSettings}
 * on enter and registers an {@link AudioDirector.onSettingsChange} callback; the
 * Audio panel mutates through the director, which mirrors to the engine and fires
 * the callback so the scene can persist `save.audio`.
 */
export type AudioCueKind = 'ready' | 'festival' | 'tool' | 'ui' | 'click';

class AudioDirector {
  private readonly engine = new AudioEngine();
  private settings: AudioSettings = DEFAULT_AUDIO_SETTINGS;
  private music: string | null = null;
  private ambient: string[] = [];
  private onChange: ((settings: AudioSettings) => void) | null = null;

  resume(): void {
    this.engine.resume();
  }

  loadSettings(settings: AudioSettings): void {
    this.settings = settings;
    this.engine.applySettings(settings);
  }

  getSettings(): AudioSettings {
    return this.settings;
  }

  onSettingsChange(cb: ((settings: AudioSettings) => void) | null): void {
    this.onChange = cb;
  }

  setCategoryVolume(category: AudioCategory, volume: number): void {
    this.settings = setCategoryVolume(this.settings, category, volume);
    this.engine.applySettings(this.settings);
    this.onChange?.(this.settings);
  }

  setCategoryMute(category: AudioCategory, muted: boolean): void {
    this.settings = setCategoryMute(this.settings, category, muted);
    this.engine.applySettings(this.settings);
    this.onChange?.(this.settings);
  }

  toggleCategoryMute(category: AudioCategory): void {
    this.settings = toggleCategoryMute(this.settings, category);
    this.engine.applySettings(this.settings);
    this.onChange?.(this.settings);
  }

  /** Recompute the desired music + ambience for a context and crossfade to it. */
  applyContext(ctx: AudioPlayContext): void {
    const music = selectMusicTrack(ctx);
    const ambient = selectAmbientLayers(ctx);
    if (music !== this.music) {
      this.music = music;
      this.engine.setMusic(music);
    }
    if (!sameLayers(ambient, this.ambient)) {
      this.ambient = ambient;
      this.engine.setAmbient(ambient);
    }
  }

  currentMusic(): string | null {
    return this.music;
  }

  currentAmbient(): string[] {
    return [...this.ambient];
  }

  playCue(kind: AudioCueKind): void {
    this.engine.playCue(kind);
  }
}

function sameLayers(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}

let director: AudioDirector | null = null;

export function getAudioDirector(): AudioDirector {
  if (!director) {
    director = new AudioDirector();
    installDebug(director);
  }
  return director;
}

export type AudioDirectorHandle = ReturnType<typeof getAudioDirector>;

/** Expose a stable telemetry + control surface for Playwright (and dev). */
function installDebug(d: AudioDirector): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { sturdyVolleyAudio?: unknown }).sturdyVolleyAudio = {
    music: () => d.currentMusic(),
    ambient: () => d.currentAmbient(),
    settings: () => d.getSettings(),
    setCategoryVolume: (c: AudioCategory, v: number) => d.setCategoryVolume(c, v),
    setCategoryMute: (c: AudioCategory, b: boolean) => d.setCategoryMute(c, b),
    toggleCategoryMute: (c: AudioCategory) => d.toggleCategoryMute(c),
  };
}
