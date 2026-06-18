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
});
