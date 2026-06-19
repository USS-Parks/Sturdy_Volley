import { describe, it, expect } from 'vitest';
import { forecastFor } from '../../src/engine/weather';
import { createGameTime, startNextDay, type GameTime } from '../../src/engine/timeSystem';
import type { Weather } from '../../src/data/schemas';

const POOL: Weather[] = [
  { id: 'sunny', name: 'Sunny', description: 'a', affectsTravel: false },
  { id: 'rain', name: 'Rain', description: 'b', affectsTravel: true },
  { id: 'sea-fog', name: 'Sea Fog', description: 'c', affectsTravel: true },
  { id: 'windstorm', name: 'Windstorm', description: 'd', affectsTravel: true },
];

describe('forecastFor', () => {
  it('returns null for an empty pool', () => {
    expect(forecastFor(createGameTime(), [])).toBeNull();
  });

  it('is deterministic — same day yields the same forecast', () => {
    const a = forecastFor(createGameTime(), POOL);
    const b = forecastFor(createGameTime(), POOL);
    expect(a).not.toBeNull();
    expect(a!.id).toBe(b!.id);
  });

  it('produces variety across a season', () => {
    let time: GameTime = createGameTime();
    const ids = new Set<string>();
    for (let i = 0; i < 28; i++) {
      ids.add(forecastFor(time, POOL)!.id);
      time = startNextDay(time);
    }
    expect(ids.size).toBeGreaterThanOrEqual(2);
  });

  it('summer leans drier than fall', () => {
    let summer: GameTime = { year: 1, season: 'summer', day: 1, minutes: 6 * 60 };
    let fall: GameTime = { year: 1, season: 'fall', day: 1, minutes: 6 * 60 };
    let sunny = 0;
    let fallSunny = 0;
    for (let i = 0; i < 28; i++) {
      if (forecastFor(summer, POOL)!.id === 'sunny') sunny++;
      if (forecastFor(fall, POOL)!.id === 'sunny') fallSunny++;
      summer = startNextDay(summer);
      fall = startNextDay(fall);
    }
    expect(sunny).toBeGreaterThan(fallSunny);
  });
});
