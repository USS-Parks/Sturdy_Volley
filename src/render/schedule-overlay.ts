/**
 * Schedule-debug overlay (RF-11). Optional, gated by `?debug=schedules`.
 * Shows each known NPC's current waypoint (scene + x,z + posture) so the
 * renderer wave can sanity-check the schedule data without a debugger.
 * Pure DOM; no Babylon dependency.
 */
import type { NpcSchedule, ResolveContext } from '../engine/npcSchedule';
import { activeWaypoint } from '../engine/npcSchedule';
import { knownNpcIds, loadSchedule } from '../engine/schedules';

export function isScheduleOverlayEnabled(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get('debug') === 'schedules';
}

export interface ScheduleOverlayController {
  updateFrom: (ctx: ResolveContext) => void;
  destroy: () => void;
}

export function mountScheduleOverlay(parent: HTMLElement = document.body): ScheduleOverlayController {
  parent.querySelector('#schedule-overlay')?.remove();
  const root = document.createElement('div');
  root.id = 'schedule-overlay';
  root.dataset.testid = 'schedule-overlay';

  const heading = document.createElement('div');
  heading.className = 'sched-heading';
  heading.textContent = 'schedules';
  root.appendChild(heading);

  const list = document.createElement('ul');
  list.className = 'sched-list';
  const rows = new Map<string, HTMLLIElement>();
  for (const id of knownNpcIds()) {
    const li = document.createElement('li');
    li.className = 'sched-row';
    li.dataset.testid = `sched-row-${id}`;
    li.textContent = `${id}: —`;
    rows.set(id, li);
    list.appendChild(li);
  }
  root.appendChild(list);
  parent.appendChild(root);

  return {
    updateFrom(ctx) {
      for (const id of knownNpcIds()) {
        const schedule: NpcSchedule | null = loadSchedule(id);
        const li = rows.get(id);
        if (!li) continue;
        if (!schedule) {
          li.textContent = `${id}: no schedule`;
          continue;
        }
        const wp = activeWaypoint(schedule, ctx);
        if (!wp) {
          li.textContent = `${id}: no waypoint`;
          continue;
        }
        li.textContent = `${id}: ${wp.sceneKey} (${wp.x.toFixed(0)},${wp.z.toFixed(0)}) ${wp.posture ?? 'idle'}`;
      }
    },
    destroy() {
      root.remove();
    },
  };
}
