import { getAudioDirector } from './audio-director';
import { timeOfDay, type AudioEvent } from '../engine/audio-model';
import type { SaveData } from '../engine/saveModel';

/**
 * Scene → audio glue (Prompt 061). Builds the {@link AudioPlayContext} from save
 * state + the scene's live world state and hands it to the shared director, which
 * crossfades music + ambience. Scenes call this on enter and whenever the region,
 * day/time, weather, or event changes. `resume()` first so the AudioContext wakes
 * on the player's gesture (they have already clicked through the title).
 */
export interface SceneAudioInput {
  /** Current weather id (e.g. 'sunny' | 'rain' | 'sea-fog' | 'windstorm') or null. */
  weatherId?: string | null;
  /** Minutes-since-midnight to read the time of day from (defaults to the save clock). */
  minutes?: number;
  /** An overriding event mood (festival / combat). */
  event?: AudioEvent;
}

export function applySceneAudio(sceneKey: string, save: SaveData, input: SceneAudioInput = {}): void {
  const director = getAudioDirector();
  director.resume();
  director.applyContext({
    region: sceneKey,
    season: save.calendar.season,
    timeOfDay: timeOfDay(input.minutes ?? save.calendar.timeMinutes),
    weather: input.weatherId ?? null,
    event: input.event ?? null,
  });
}

/** Load persisted mixer settings into the director + register save-back. */
export function bindSceneAudioSettings(save: SaveData, persist: () => void): void {
  const director = getAudioDirector();
  director.loadSettings(save.audio);
  director.onSettingsChange((settings) => {
    save.audio = settings;
    persist();
  });
}
