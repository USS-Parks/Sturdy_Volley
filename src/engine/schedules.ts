import type { NpcSchedule } from './npcSchedule';
import scheduleJson from '../data/content/schedules.json';

/**
 * Loader for the bundled NPC schedules JSON. Currently no validation — the
 * file is curated by hand and the runtime checks waypoint shape at use time.
 * A formal schema can land at RF-11 once the renderer wave exercises all 4.
 */
const RAW = scheduleJson as Record<string, NpcSchedule>;

export function loadSchedule(npcId: string): NpcSchedule | null {
  return RAW[npcId] ?? null;
}

export function knownNpcIds(): string[] {
  return Object.keys(RAW);
}
