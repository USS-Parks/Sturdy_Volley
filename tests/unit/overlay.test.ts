import { describe, it, expect, beforeEach } from 'vitest';
import { UIOverlay } from '../../src/ui/overlay';
import { buildTitleMenu } from '../../src/ui/menuModel';

beforeEach(() => {
  document.body.innerHTML = '<div id="ui-root"></div>';
});

describe('UIOverlay', () => {
  it('throws if the root element is missing', () => {
    document.body.innerHTML = '';
    expect(() => new UIOverlay()).toThrow(/root element/);
  });

  it('renders one accessible button per menu item', () => {
    const overlay = new UIOverlay();
    overlay.showMenu('Sturdy Volley', buildTitleMenu(false), () => {});
    const buttons = document.querySelectorAll('.menu-button');
    expect(buttons).toHaveLength(4);
    expect(document.querySelector('h1.menu-title')?.textContent).toBe('Sturdy Volley');
  });

  it('reflects the disabled state of items', () => {
    const overlay = new UIOverlay();
    overlay.showMenu('Sturdy Volley', buildTitleMenu(false), () => {});
    const cont = document.querySelector<HTMLButtonElement>('[data-testid="title-continue"]');
    expect(cont?.disabled).toBe(true);
  });

  it('invokes the select callback with the item id', () => {
    const overlay = new UIOverlay();
    const selected: string[] = [];
    overlay.showMenu('Sturdy Volley', buildTitleMenu(true), (id) => selected.push(id));
    document.querySelector<HTMLButtonElement>('[data-testid="title-continue"]')?.click();
    expect(selected).toEqual(['continue']);
  });

  it('clear() empties the overlay', () => {
    const overlay = new UIOverlay();
    overlay.showMenu('Sturdy Volley', buildTitleMenu(false), () => {});
    overlay.clear();
    expect(document.querySelector('#ui-root')?.childElementCount).toBe(0);
  });

  it('showPanel renders a Back button that calls the handler', () => {
    const overlay = new UIOverlay();
    let backed = false;
    overlay.showPanel('Credits', 'All original.', () => {
      backed = true;
    });
    document.querySelector<HTMLButtonElement>('[data-testid="panel-back"]')?.click();
    expect(backed).toBe(true);
  });

  it('showForm renders fields and submits their values', () => {
    const overlay = new UIOverlay();
    let submitted: Record<string, string> | null = null;
    overlay.showForm(
      'New Game',
      [{ id: 'name', label: 'Your name', value: 'Wren' }],
      'Begin',
      (values) => {
        submitted = values;
      },
      () => {},
    );
    const input = document.querySelector<HTMLInputElement>('[data-testid="field-name"]');
    expect(input?.value).toBe('Wren');
    document
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    expect(submitted).toEqual({ name: 'Wren' });
  });

  it('showForm Cancel invokes the cancel handler', () => {
    const overlay = new UIOverlay();
    let cancelled = false;
    overlay.showForm('t', [{ id: 'a', label: 'A' }], 'Go', () => {}, () => {
      cancelled = true;
    });
    document.querySelector<HTMLButtonElement>('[data-testid="form-cancel"]')?.click();
    expect(cancelled).toBe(true);
  });

  it('showDaySummary renders rows, notices, and a Continue button', () => {
    const overlay = new UIOverlay();
    let advanced = false;
    overlay.showDaySummary(
      {
        dayLabel: 'Year 1, spring 1 (Mon)',
        income: 250,
        skillXp: { cultivation: 12 },
        relationshipChanges: 2,
        notices: ['You collapsed and were carried home.', 'Tomorrow: Seed Blessing.'],
      },
      () => {
        advanced = true;
      },
    );
    expect(document.querySelector('[data-testid="day-summary"]')).toBeTruthy();
    expect(document.querySelector('.menu-subtitle')?.textContent).toBe('Year 1, spring 1 (Mon)');
    expect(document.querySelectorAll('[data-testid="day-summary-notices"] li')).toHaveLength(2);
    document.querySelector<HTMLButtonElement>('[data-testid="day-summary-continue"]')?.click();
    expect(advanced).toBe(true);
  });

  it('showDaySummary shows "none today" when no skill XP rolled', () => {
    const overlay = new UIOverlay();
    overlay.showDaySummary(
      {
        dayLabel: 'Y1 S1 (Mon)',
        income: 0,
        skillXp: {},
        relationshipChanges: 0,
        notices: [],
      },
      () => {},
    );
    const values = Array.from(document.querySelectorAll('.day-summary-value')).map(
      (n) => n.textContent,
    );
    expect(values).toContain('none today');
  });

  it('showReport renders pass/fail rows and a Back button', () => {
    const overlay = new UIOverlay();
    let backed = false;
    overlay.showReport(
      'Data validation',
      [
        { label: 'items (14)', ok: true },
        { label: 'crops (0)', ok: false, detail: 'broken reference' },
      ],
      () => {
        backed = true;
      },
      'dev-data-report',
    );
    expect(document.querySelector('[data-testid="dev-data-report"]')).toBeTruthy();
    expect(document.querySelectorAll('.report-ok')).toHaveLength(1);
    expect(document.querySelectorAll('.report-fail')).toHaveLength(1);
    document.querySelector<HTMLButtonElement>('[data-testid="panel-back"]')?.click();
    expect(backed).toBe(true);
  });
});
