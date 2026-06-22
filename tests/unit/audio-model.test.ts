import { describe, it, expect } from 'vitest';
import {
  selectMusicTrack,
  selectAmbientLayers,
  timeOfDay,
  musicTrack,
  ambientLayer,
  MUSIC_TRACKS,
  AMBIENT_LAYERS,
  audioSettingsSchema,
  DEFAULT_AUDIO_SETTINGS,
  setCategoryVolume,
  setCategoryMute,
  toggleCategoryMute,
  effectiveVolume,
  audioMixRows,
  type AudioPlayContext,
} from '../../src/engine/audio-model';

const BASE: AudioPlayContext = {
  region: 'Farm',
  season: 'spring',
  timeOfDay: 'day',
  weather: 'sunny',
  event: null,
};

describe('timeOfDay (Prompt 061)', () => {
  it('buckets minutes into day / evening / night', () => {
    expect(timeOfDay(8 * 60)).toBe('day');
    expect(timeOfDay(19 * 60)).toBe('evening');
    expect(timeOfDay(22 * 60)).toBe('night');
    expect(timeOfDay(2 * 60)).toBe('night');
    expect(timeOfDay(25 * 60)).toBe('night'); // past-midnight hours collapse to night
  });
});

describe('music selection (Prompt 061)', () => {
  it('changes by region, season, time, weather, and event', () => {
    const farmSpringDay = selectMusicTrack(BASE);
    expect(farmSpringDay).toBe('farm-spring');

    // season
    expect(selectMusicTrack({ ...BASE, season: 'fall' })).toBe('farm-fall');
    expect(selectMusicTrack({ ...BASE, season: 'fall' })).not.toBe(farmSpringDay);
    // time
    expect(selectMusicTrack({ ...BASE, timeOfDay: 'night' })).toBe('farm-night');
    // weather
    expect(selectMusicTrack({ ...BASE, weather: 'rain' })).toBe('farm-rain');
    expect(selectMusicTrack({ ...BASE, weather: 'windstorm' })).toBe('farm-rain');
    // event
    expect(selectMusicTrack({ ...BASE, event: 'festival' })).toBe('festival-theme');
    expect(selectMusicTrack({ ...BASE, event: 'combat' })).toBe('cavern-tension');
    // region
    expect(selectMusicTrack({ ...BASE, region: 'Town' })).toBe('town-market');
    expect(selectMusicTrack({ ...BASE, region: 'Town', season: 'winter' })).toBe('town-winter');
    expect(selectMusicTrack({ ...BASE, region: 'Town', timeOfDay: 'night' })).toBe('town-night');
    expect(selectMusicTrack({ ...BASE, region: 'Interior' })).toBe('hearth-day');
    expect(selectMusicTrack({ ...BASE, region: 'Mine' })).toBe('cavern-drift');
    expect(selectMusicTrack({ ...BASE, region: 'Beach' })).toBe('shore-day');
  });

  it('every selected track id resolves to a real catalog entry', () => {
    const contexts: AudioPlayContext[] = [
      BASE,
      { ...BASE, season: 'winter' },
      { ...BASE, timeOfDay: 'night' },
      { ...BASE, weather: 'rain' },
      { ...BASE, event: 'festival' },
      { ...BASE, event: 'combat' },
      { ...BASE, region: 'Town' },
      { ...BASE, region: 'Town', timeOfDay: 'night' },
      { ...BASE, region: 'Interior', timeOfDay: 'night' },
      { ...BASE, region: 'Mine' },
      { ...BASE, region: 'Beach', timeOfDay: 'night' },
    ];
    for (const ctx of contexts) {
      const id = selectMusicTrack(ctx);
      expect(musicTrack(id), `track ${id} missing for ${JSON.stringify(ctx)}`).toBeTruthy();
    }
  });
});

describe('ambient selection (Prompt 061)', () => {
  it('layers by region / weather / time and never duplicates', () => {
    const farmDay = selectAmbientLayers(BASE);
    expect(farmDay).toContain('breeze');
    expect(farmDay).toContain('birdsong');

    const farmNight = selectAmbientLayers({ ...BASE, timeOfDay: 'night' });
    expect(farmNight).toContain('crickets');
    expect(farmNight).not.toContain('birdsong');

    const farmRain = selectAmbientLayers({ ...BASE, weather: 'rain' });
    expect(farmRain).toContain('rain');
    expect(farmRain).not.toContain('birdsong');

    expect(selectAmbientLayers({ ...BASE, region: 'Town' })).toContain('town-murmur');
    expect(selectAmbientLayers({ ...BASE, region: 'Beach' })).toContain('surf');
    const mine = selectAmbientLayers({ ...BASE, region: 'Mine' });
    expect(mine).toEqual(['cave-drips', 'low-hum']);
    expect(selectAmbientLayers({ ...BASE, region: 'Interior' })).toContain('hearth-crackle');

    // No layer appears twice in any selection.
    for (const ctx of [BASE, { ...BASE, region: 'Beach', weather: 'rain' as const }]) {
      const layers = selectAmbientLayers(ctx);
      expect(new Set(layers).size).toBe(layers.length);
    }
  });

  it('every selected layer resolves to a real catalog entry', () => {
    const layers = selectAmbientLayers({ ...BASE, region: 'Beach', weather: 'rain' });
    for (const id of layers) expect(ambientLayer(id), `layer ${id}`).toBeTruthy();
  });
});

describe('mixer settings (Prompt 061)', () => {
  it('the schema fills missing categories with the defaults', () => {
    expect(audioSettingsSchema.parse({})).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('effective volume multiplies own × master and zeroes on mute', () => {
    const s = DEFAULT_AUDIO_SETTINGS;
    expect(effectiveVolume(s, 'music')).toBeCloseTo(0.7 * 0.8);
    expect(effectiveVolume(setCategoryMute(s, 'music', true), 'music')).toBe(0);
    // Master mute gates everything.
    expect(effectiveVolume(setCategoryMute(s, 'master', true), 'music')).toBe(0);
  });

  it('setCategoryVolume clamps to 0..1 and is immutable', () => {
    const s = DEFAULT_AUDIO_SETTINGS;
    expect(setCategoryVolume(s, 'sfx', 2).sfx.volume).toBe(1);
    expect(setCategoryVolume(s, 'sfx', -1).sfx.volume).toBe(0);
    expect(s.sfx.volume).toBe(0.9); // original untouched
  });

  it('toggleCategoryMute flips the flag', () => {
    const muted = toggleCategoryMute(DEFAULT_AUDIO_SETTINGS, 'ambient');
    expect(muted.ambient.muted).toBe(true);
    expect(toggleCategoryMute(muted, 'ambient').ambient.muted).toBe(false);
  });

  it('audioMixRows lists every category, master first', () => {
    const rows = audioMixRows(DEFAULT_AUDIO_SETTINGS);
    expect(rows.map((r) => r.category)).toEqual(['master', 'music', 'ambient', 'sfx', 'ui']);
    expect(rows[0]!.label).toBe('Master');
  });
});

describe('catalogs (Prompt 061)', () => {
  it('track + layer ids are unique', () => {
    expect(new Set(MUSIC_TRACKS.map((t) => t.id)).size).toBe(MUSIC_TRACKS.length);
    expect(new Set(AMBIENT_LAYERS.map((l) => l.id)).size).toBe(AMBIENT_LAYERS.length);
  });
});
