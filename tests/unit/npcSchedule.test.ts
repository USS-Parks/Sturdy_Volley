import { describe, it, expect } from 'vitest';
import {
  pickLayer,
  activeWaypoint,
  liveStep,
  isConversationAvailable,
  type NpcSchedule,
  type ResolveContext,
} from '../../src/engine/npcSchedule';

const SCHEDULE: NpcSchedule = {
  default: [
    { startMinutes: 360, waypoint: { sceneKey: 'Town', x: 0, z: 0, posture: 'idle' } },
    { startMinutes: 720, waypoint: { sceneKey: 'Beach', x: 5, z: 5, posture: 'work' } },
    { startMinutes: 1200, waypoint: { sceneKey: 'Interior', x: 0, z: 0, posture: 'sit' } },
  ],
  bySeason: {
    winter: [{ startMinutes: 360, waypoint: { sceneKey: 'Interior', x: 0, z: 0, posture: 'sit' } }],
  },
  byWeather: {
    rain: [{ startMinutes: 360, waypoint: { sceneKey: 'Interior', x: 0, z: 0, posture: 'idle' } }],
  },
  byFestival: {
    'seed-blessing': [
      { startMinutes: 540, waypoint: { sceneKey: 'Town', x: 0, z: 4, posture: 'idle' } },
    ],
  },
  byRelationship: {
    '6': [{ startMinutes: 360, waypoint: { sceneKey: 'Farm', x: 0, z: 0, posture: 'walk' } }],
  },
};

const baseCtx: ResolveContext = {
  minutes: 600,
  season: 'spring',
  weatherId: null,
  festivalId: null,
  relationshipLevel: 0,
  activeEventFlags: [],
};

describe('pickLayer precedence', () => {
  it('default when nothing else applies', () => {
    expect(pickLayer(SCHEDULE, baseCtx)).toBe(SCHEDULE.default);
  });

  it('season overrides default', () => {
    expect(pickLayer(SCHEDULE, { ...baseCtx, season: 'winter' })).toBe(
      SCHEDULE.bySeason!.winter,
    );
  });

  it('weather overrides season', () => {
    expect(
      pickLayer(SCHEDULE, { ...baseCtx, season: 'winter', weatherId: 'rain' }),
    ).toBe(SCHEDULE.byWeather!.rain);
  });

  it('festival overrides weather', () => {
    expect(
      pickLayer(SCHEDULE, {
        ...baseCtx,
        weatherId: 'rain',
        festivalId: 'seed-blessing',
      }),
    ).toBe(SCHEDULE.byFestival!['seed-blessing']);
  });

  it('relationship picks the highest threshold ≤ player level', () => {
    expect(pickLayer(SCHEDULE, { ...baseCtx, relationshipLevel: 6 })).toBe(
      SCHEDULE.byRelationship!['6'],
    );
    // Below threshold falls through.
    expect(pickLayer(SCHEDULE, { ...baseCtx, relationshipLevel: 4 })).toBe(SCHEDULE.default);
  });
});

describe('activeWaypoint', () => {
  it('returns the last segment whose start ≤ minutes', () => {
    expect(activeWaypoint(SCHEDULE, baseCtx)?.sceneKey).toBe('Town');
    expect(activeWaypoint(SCHEDULE, { ...baseCtx, minutes: 900 })?.sceneKey).toBe('Beach');
    expect(activeWaypoint(SCHEDULE, { ...baseCtx, minutes: 1320 })?.sceneKey).toBe('Interior');
  });
});

describe('liveStep', () => {
  it('walks linearly toward the target at speed × dt', () => {
    const r = liveStep({
      position: { x: 0, z: 0 },
      target: { sceneKey: 'Town', x: 10, z: 0 },
      speed: 2,
      dt: 1,
    });
    expect(r.arrived).toBe(false);
    expect(r.x).toBeCloseTo(2);
  });

  it('snaps to the target on arrival', () => {
    const r = liveStep({
      position: { x: 0, z: 0 },
      target: { sceneKey: 'Town', x: 1, z: 0 },
      speed: 5,
      dt: 1,
    });
    expect(r.arrived).toBe(true);
    expect(r.x).toBe(1);
  });
});

describe('isConversationAvailable', () => {
  it('true when NPC is in the active scene and not sitting', () => {
    expect(isConversationAvailable(SCHEDULE, baseCtx, 'Town')).toBe(true);
    expect(isConversationAvailable(SCHEDULE, baseCtx, 'Beach')).toBe(false);
    expect(
      isConversationAvailable(SCHEDULE, { ...baseCtx, minutes: 1320 }, 'Interior'),
    ).toBe(false); // sitting
  });
});
