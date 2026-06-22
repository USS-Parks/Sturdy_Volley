import { z } from 'zod';

/**
 * Audio architecture model (Prompt 061). Pure, renderer-agnostic. This module
 * owns three things and nothing about WebAudio:
 *
 *  1. The **selection rules** — given a play context (region / season / time of
 *     day / weather / event) decide which music track and which ambient layers
 *     should be sounding. Deterministic, so it is unit-testable and the renderer
 *     just plays what it is told.
 *  2. The **catalogs** — every music track and ambient layer, each carrying the
 *     synth parameters the WebAudio engine (`src/audio/audio-engine.ts`) turns
 *     into a procedural placeholder voice (no audio files exist yet, the same way
 *     graybox meshes stand in for `.glb` art — §1.3 / originality §0.7).
 *  3. The **mixer settings** — per-category volume + mute, persisted on the save.
 *
 * The catalog + rules live in the engine (not the data-driven content pipeline)
 * because, like the camera profiles and the Theme-3 palette, they are tightly
 * coupled to the synth/render layer rather than world content.
 */

export type AudioCategory = 'master' | 'music' | 'ambient' | 'sfx' | 'ui';

/** Mixable categories the settings panel exposes (master gates them all). */
export const AUDIO_CATEGORIES: readonly AudioCategory[] = ['master', 'music', 'ambient', 'sfx', 'ui'];

export const AUDIO_CATEGORY_LABELS: Record<AudioCategory, string> = {
  master: 'Master',
  music: 'Music',
  ambient: 'Ambience',
  sfx: 'Effects',
  ui: 'Interface',
};

export type TimeOfDay = 'day' | 'evening' | 'night';

/** Map minutes-since-midnight (0..26*60) to a coarse part of day for audio mood. */
export function timeOfDay(minutes: number): TimeOfDay {
  const m = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  if (m < 6 * 60 || m >= 21 * 60) return 'night';
  if (m >= 18 * 60) return 'evening';
  return 'day';
}

export type AudioEvent = 'festival' | 'combat' | null;

export interface AudioPlayContext {
  /** Scene/region key, e.g. 'Farm', 'Town', 'Interior', 'Beach', 'Mine'. */
  region: string;
  season: string;
  timeOfDay: TimeOfDay;
  /** Weather id (e.g. 'sunny' | 'rain' | 'sea-fog' | 'windstorm') or null. */
  weather: string | null;
  /** An overriding event mood, if any. */
  event: AudioEvent;
}

/* Catalogs ---------------------------------------------------------------- */

export type Waveform = 'sine' | 'triangle' | 'sawtooth' | 'square';

export interface MusicTrack {
  id: string;
  name: string;
  /** Root note frequency for the procedural pad. */
  rootHz: number;
  wave: Waveform;
  /** Low-pass cutoff (Hz) — lower = warmer/darker. */
  cutoff: number;
  /** Loop gain target (0..1) within the music category. */
  gain: number;
}

export const MUSIC_TRACKS: readonly MusicTrack[] = [
  { id: 'farm-spring', name: 'Breakpoint Morning', rootHz: 196.0, wave: 'triangle', cutoff: 1400, gain: 0.5 },
  { id: 'farm-summer', name: 'Long Light', rootHz: 220.0, wave: 'triangle', cutoff: 1600, gain: 0.5 },
  { id: 'farm-fall', name: 'Harvest Amber', rootHz: 174.6, wave: 'triangle', cutoff: 1200, gain: 0.5 },
  { id: 'farm-winter', name: 'Frostline', rootHz: 164.8, wave: 'sine', cutoff: 1000, gain: 0.45 },
  { id: 'farm-rain', name: 'Rain on the Roof', rootHz: 146.8, wave: 'sine', cutoff: 800, gain: 0.42 },
  { id: 'farm-night', name: 'Lanternlight', rootHz: 130.8, wave: 'sine', cutoff: 700, gain: 0.4 },
  { id: 'town-market', name: 'Market Lane', rootHz: 261.6, wave: 'triangle', cutoff: 1800, gain: 0.5 },
  { id: 'town-winter', name: 'Frostlight Lane', rootHz: 246.9, wave: 'triangle', cutoff: 1300, gain: 0.48 },
  { id: 'town-night', name: 'Harbor After Dark', rootHz: 174.6, wave: 'sine', cutoff: 900, gain: 0.42 },
  { id: 'shore-day', name: 'Tide and Sky', rootHz: 207.7, wave: 'triangle', cutoff: 1500, gain: 0.48 },
  { id: 'shore-night', name: 'Moonwater', rootHz: 155.6, wave: 'sine', cutoff: 850, gain: 0.42 },
  { id: 'hearth-day', name: 'Home Fires', rootHz: 196.0, wave: 'sine', cutoff: 1000, gain: 0.44 },
  { id: 'hearth-night', name: 'Quiet Hours', rootHz: 130.8, wave: 'sine', cutoff: 700, gain: 0.4 },
  { id: 'cavern-drift', name: 'Deep Drift', rootHz: 110.0, wave: 'sine', cutoff: 600, gain: 0.4 },
  { id: 'cavern-tension', name: 'Something Stirs', rootHz: 98.0, wave: 'sawtooth', cutoff: 900, gain: 0.5 },
  { id: 'festival-theme', name: 'Festival', rootHz: 293.7, wave: 'triangle', cutoff: 2000, gain: 0.55 },
];

const MUSIC_BY_ID = new Map(MUSIC_TRACKS.map((t) => [t.id, t] as const));
export function musicTrack(id: string): MusicTrack | undefined {
  return MUSIC_BY_ID.get(id);
}

export type AmbientFilter = 'lowpass' | 'bandpass' | 'highpass';

export interface AmbientLayer {
  id: string;
  name: string;
  /** Filtered-noise character. */
  filter: AmbientFilter;
  freq: number;
  q: number;
  gain: number;
}

export const AMBIENT_LAYERS: readonly AmbientLayer[] = [
  { id: 'breeze', name: 'Breeze', filter: 'bandpass', freq: 500, q: 0.5, gain: 0.12 },
  { id: 'birdsong', name: 'Birdsong', filter: 'bandpass', freq: 2600, q: 4, gain: 0.06 },
  { id: 'crickets', name: 'Crickets', filter: 'bandpass', freq: 4200, q: 8, gain: 0.05 },
  { id: 'rain', name: 'Rain', filter: 'lowpass', freq: 1800, q: 0.7, gain: 0.16 },
  { id: 'town-murmur', name: 'Town Murmur', filter: 'bandpass', freq: 320, q: 0.8, gain: 0.1 },
  { id: 'gulls', name: 'Gulls', filter: 'bandpass', freq: 1800, q: 3, gain: 0.05 },
  { id: 'surf', name: 'Surf', filter: 'lowpass', freq: 700, q: 0.6, gain: 0.16 },
  { id: 'cave-drips', name: 'Cave Drips', filter: 'bandpass', freq: 1400, q: 6, gain: 0.07 },
  { id: 'low-hum', name: 'Low Hum', filter: 'lowpass', freq: 220, q: 0.7, gain: 0.1 },
  { id: 'hearth-crackle', name: 'Hearth Crackle', filter: 'bandpass', freq: 900, q: 2, gain: 0.08 },
  { id: 'rain-muffled', name: 'Rain (muffled)', filter: 'lowpass', freq: 600, q: 0.7, gain: 0.1 },
];

const AMBIENT_BY_ID = new Map(AMBIENT_LAYERS.map((l) => [l.id, l] as const));
export function ambientLayer(id: string): AmbientLayer | undefined {
  return AMBIENT_BY_ID.get(id);
}

/* Selection rules --------------------------------------------------------- */

function isRegion(region: string, ...names: string[]): boolean {
  const r = region.toLowerCase();
  return names.some((n) => r === n.toLowerCase() || r.includes(n.toLowerCase()));
}

function isWet(weather: string | null): boolean {
  return weather === 'rain' || weather === 'windstorm';
}

/**
 * Pick the music track for a context. Precedence: event override → enclosed
 * regions (cavern / interior) → town → shore → farm/outdoor. Farm/outdoor folds
 * in weather (wet), time (night), and season so the track id changes across all
 * five dimensions the acceptance names.
 */
export function selectMusicTrack(ctx: AudioPlayContext): string {
  if (ctx.event === 'festival') return 'festival-theme';
  if (ctx.event === 'combat') return 'cavern-tension';

  const night = ctx.timeOfDay === 'night';

  if (isRegion(ctx.region, 'Mine', 'Cavern', 'Quarry')) {
    return 'cavern-drift';
  }
  if (isRegion(ctx.region, 'Interior', 'Farmhouse', 'Home')) {
    return night ? 'hearth-night' : 'hearth-day';
  }
  if (isRegion(ctx.region, 'Town')) {
    if (night) return 'town-night';
    return ctx.season === 'winter' ? 'town-winter' : 'town-market';
  }
  if (isRegion(ctx.region, 'Beach', 'River', 'Reef', 'Shore', 'Marsh', 'Islet')) {
    return night ? 'shore-night' : 'shore-day';
  }
  // Farm + any other outdoor region.
  if (isWet(ctx.weather)) return 'farm-rain';
  if (night) return 'farm-night';
  const seasonTrack = `farm-${ctx.season}`;
  return MUSIC_BY_ID.has(seasonTrack) ? seasonTrack : 'farm-spring';
}

/** Pick the set of ambient layers for a context (ordered, de-duplicated). */
export function selectAmbientLayers(ctx: AudioPlayContext): string[] {
  const out: string[] = [];
  const night = ctx.timeOfDay === 'night';
  const wet = isWet(ctx.weather);

  if (isRegion(ctx.region, 'Mine', 'Cavern', 'Quarry')) {
    out.push('cave-drips', 'low-hum');
  } else if (isRegion(ctx.region, 'Interior', 'Farmhouse', 'Home')) {
    out.push('hearth-crackle');
    if (wet) out.push('rain-muffled');
  } else if (isRegion(ctx.region, 'Town')) {
    out.push('town-murmur');
    if (wet) out.push('rain');
    else if (!night) out.push('gulls');
  } else if (isRegion(ctx.region, 'Beach', 'River', 'Reef', 'Shore', 'Marsh', 'Islet')) {
    out.push('surf');
    if (!night) out.push('gulls');
    if (wet) out.push('rain');
  } else {
    // Farm + outdoor default.
    out.push('breeze');
    if (wet) out.push('rain');
    else if (!night) out.push('birdsong');
    if (night) out.push('crickets');
  }

  // De-dupe while preserving order.
  return out.filter((id, i) => out.indexOf(id) === i);
}

/* Mixer settings ---------------------------------------------------------- */

export interface CategoryMix {
  volume: number;
  muted: boolean;
}

export interface AudioSettings {
  master: CategoryMix;
  music: CategoryMix;
  ambient: CategoryMix;
  sfx: CategoryMix;
  ui: CategoryMix;
}

const categoryMixSchema = z
  .object({
    volume: z.number().min(0).max(1).default(1),
    muted: z.boolean().default(false),
  })
  .strict();

export const audioSettingsSchema = z
  .object({
    master: categoryMixSchema.default({ volume: 0.8, muted: false }),
    music: categoryMixSchema.default({ volume: 0.7, muted: false }),
    ambient: categoryMixSchema.default({ volume: 0.7, muted: false }),
    sfx: categoryMixSchema.default({ volume: 0.9, muted: false }),
    ui: categoryMixSchema.default({ volume: 0.8, muted: false }),
  })
  .strict();

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  master: { volume: 0.8, muted: false },
  music: { volume: 0.7, muted: false },
  ambient: { volume: 0.7, muted: false },
  sfx: { volume: 0.9, muted: false },
  ui: { volume: 0.8, muted: false },
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function setCategoryVolume(
  settings: AudioSettings,
  category: AudioCategory,
  volume: number,
): AudioSettings {
  return { ...settings, [category]: { ...settings[category], volume: clamp01(volume) } };
}

export function setCategoryMute(
  settings: AudioSettings,
  category: AudioCategory,
  muted: boolean,
): AudioSettings {
  return { ...settings, [category]: { ...settings[category], muted } };
}

export function toggleCategoryMute(settings: AudioSettings, category: AudioCategory): AudioSettings {
  return setCategoryMute(settings, category, !settings[category].muted);
}

/**
 * The effective linear gain (0..1) for a category: its own volume gated by its
 * mute, multiplied by the master volume gated by master mute. `master` itself
 * resolves to just the master pair.
 */
export function effectiveVolume(settings: AudioSettings, category: AudioCategory): number {
  const masterGain = settings.master.muted ? 0 : settings.master.volume;
  if (category === 'master') return masterGain;
  const own = settings[category].muted ? 0 : settings[category].volume;
  return clamp01(own * masterGain);
}

export interface AudioMixRow {
  category: AudioCategory;
  label: string;
  volume: number;
  muted: boolean;
}

/** Project the settings into per-category rows for the Audio panel. */
export function audioMixRows(settings: AudioSettings): AudioMixRow[] {
  return AUDIO_CATEGORIES.map((category) => ({
    category,
    label: AUDIO_CATEGORY_LABELS[category],
    volume: settings[category].volume,
    muted: settings[category].muted,
  }));
}

/** Crossfade duration (ms) used by the renderer when music/ambient changes. */
export const CROSSFADE_MS = 1500;
