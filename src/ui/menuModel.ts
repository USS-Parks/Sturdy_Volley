/** A single selectable item in a menu. Pure data — no DOM, no Phaser. */
export interface MenuItem {
  id: string;
  label: string;
  enabled: boolean;
  testId: string;
}

/**
 * The title screen's main menu. `Continue` is enabled only when a save exists.
 * Kept pure so it can be unit-tested without a browser or canvas.
 */
export function buildTitleMenu(hasSave: boolean): MenuItem[] {
  return [
    { id: 'start', label: 'Start', enabled: true, testId: 'title-start' },
    { id: 'continue', label: 'Continue', enabled: hasSave, testId: 'title-continue' },
    { id: 'settings', label: 'Settings', enabled: true, testId: 'title-settings' },
    { id: 'credits', label: 'Credits', enabled: true, testId: 'title-credits' },
  ];
}
