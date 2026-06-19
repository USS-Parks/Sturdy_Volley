import { describe, it, expect, beforeEach } from 'vitest';
import {
  isScheduleOverlayEnabled,
  mountScheduleOverlay,
} from '../../src/render/schedule-overlay';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('isScheduleOverlayEnabled', () => {
  it('reads ?debug=schedules from the search string', () => {
    expect(isScheduleOverlayEnabled('?debug=schedules')).toBe(true);
    expect(isScheduleOverlayEnabled('?debug=perf')).toBe(false);
    expect(isScheduleOverlayEnabled('?debug=schedules&other=1')).toBe(true);
    expect(isScheduleOverlayEnabled('')).toBe(false);
  });
});

describe('mountScheduleOverlay', () => {
  it('mounts a single overlay with one row per known NPC', () => {
    const ctrl = mountScheduleOverlay();
    expect(document.querySelector('[data-testid="schedule-overlay"]')).toBeTruthy();
    // The bundled schedules.json ships 4 NPCs.
    const rows = document.querySelectorAll('[data-testid^="sched-row-"]');
    expect(rows.length).toBe(4);
    ctrl.destroy();
  });

  it('updateFrom writes the current waypoint into each row', () => {
    const ctrl = mountScheduleOverlay();
    ctrl.updateFrom({
      minutes: 600,
      season: 'spring',
      weatherId: null,
      festivalId: null,
      relationshipLevel: 0,
      activeEventFlags: [],
    });
    const maraRow = document.querySelector('[data-testid="sched-row-mara-vale"]');
    expect(maraRow?.textContent).toContain('Town');
    expect(maraRow?.textContent).toContain('work');
    ctrl.destroy();
  });

  it('mounting again replaces the previous element', () => {
    mountScheduleOverlay();
    mountScheduleOverlay();
    expect(document.querySelectorAll('[data-testid="schedule-overlay"]')).toHaveLength(1);
  });
});
