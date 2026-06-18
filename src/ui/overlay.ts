import type { MenuItem } from './menuModel';

/**
 * Manages the HTML overlay layer (#ui-root) rendered above the Phaser canvas.
 * Using real DOM keeps menus accessible (focus order, keyboard, screen readers)
 * and directly testable with Playwright and jsdom.
 */
export class UIOverlay {
  private readonly root: HTMLElement;

  constructor(rootId = 'ui-root') {
    const el = document.getElementById(rootId);
    if (!el) {
      throw new Error(`UIOverlay: root element #${rootId} not found`);
    }
    this.root = el;
  }

  /** Remove all overlay content (called on scene shutdown). */
  clear(): void {
    this.root.replaceChildren();
  }

  showMenu(
    title: string,
    items: MenuItem[],
    onSelect: (id: string) => void,
    subtitle?: string,
  ): void {
    this.clear();
    const panel = this.createPanel(title, subtitle);
    panel.setAttribute('role', 'menu');

    for (const item of items) {
      const button = document.createElement('button');
      button.className = 'menu-button';
      button.type = 'button';
      button.textContent = item.label;
      button.dataset.testid = item.testId;
      button.disabled = !item.enabled;
      button.setAttribute('role', 'menuitem');
      button.addEventListener('click', () => onSelect(item.id));
      panel.appendChild(button);
    }

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  showPanel(title: string, body: string, onBack: () => void): void {
    this.clear();
    const panel = this.createPanel(title);

    const text = document.createElement('p');
    text.className = 'panel-body';
    text.textContent = body;
    panel.appendChild(text);

    const back = document.createElement('button');
    back.className = 'menu-button';
    back.type = 'button';
    back.textContent = 'Back';
    back.dataset.testid = 'panel-back';
    back.addEventListener('click', onBack);
    panel.appendChild(back);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  private createPanel(title: string, subtitle?: string): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'menu-panel';

    const heading = document.createElement('h1');
    heading.className = 'menu-title';
    heading.textContent = title;
    panel.appendChild(heading);

    if (subtitle) {
      const sub = document.createElement('p');
      sub.className = 'menu-subtitle';
      sub.textContent = subtitle;
      panel.appendChild(sub);
    }

    return panel;
  }

  private focusFirstEnabled(panel: HTMLElement): void {
    const first = panel.querySelector<HTMLButtonElement>('button:not(:disabled)');
    first?.focus();
  }
}
