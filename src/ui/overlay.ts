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

  /** Compact in-game HUD: a top bar with the location, status, and a Menu button. */
  showHud(title: string, status: string, onMenu: () => void): void {
    this.clear();
    const bar = document.createElement('div');
    bar.className = 'hud-bar';

    const info = document.createElement('div');
    info.className = 'hud-info';
    const heading = document.createElement('div');
    heading.className = 'hud-title';
    heading.textContent = title;
    const statusLine = document.createElement('div');
    statusLine.className = 'hud-status';
    statusLine.textContent = status;
    info.append(heading, statusLine);

    const menu = document.createElement('button');
    menu.className = 'menu-button hud-menu-button';
    menu.type = 'button';
    menu.textContent = 'Menu';
    menu.dataset.testid = 'hud-menu';
    menu.addEventListener('click', onMenu);

    bar.append(info, menu);
    this.root.appendChild(bar);
  }

  /** A simple form panel with text fields, a submit button, and Cancel. */
  showForm(
    title: string,
    fields: Array<{ id: string; label: string; value?: string; placeholder?: string; maxLength?: number }>,
    submitLabel: string,
    onSubmit: (values: Record<string, string>) => void,
    onCancel: () => void,
  ): void {
    this.clear();
    const panel = this.createPanel(title);

    const form = document.createElement('form');
    form.className = 'menu-form';
    const inputs = new Map<string, HTMLInputElement>();

    for (const field of fields) {
      const label = document.createElement('label');
      label.className = 'form-field';

      const caption = document.createElement('span');
      caption.className = 'form-label';
      caption.textContent = field.label;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-input';
      input.value = field.value ?? '';
      if (field.placeholder) input.placeholder = field.placeholder;
      if (field.maxLength) input.maxLength = field.maxLength;
      input.dataset.testid = `field-${field.id}`;

      label.append(caption, input);
      form.appendChild(label);
      inputs.set(field.id, input);
    }

    const actions = document.createElement('div');
    actions.className = 'form-actions';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'menu-button';
    submit.textContent = submitLabel;
    submit.dataset.testid = 'form-submit';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'menu-button menu-button-secondary';
    cancel.textContent = 'Cancel';
    cancel.dataset.testid = 'form-cancel';
    cancel.addEventListener('click', onCancel);

    actions.append(submit, cancel);
    form.appendChild(actions);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values: Record<string, string> = {};
      for (const [id, input] of inputs) values[id] = input.value;
      onSubmit(values);
    });

    panel.appendChild(form);
    this.root.appendChild(panel);
    inputs.values().next().value?.focus();
  }

  /** Developer report panel: a scrollable list of pass/fail rows. */
  showReport(
    title: string,
    rows: Array<{ label: string; ok: boolean; detail?: string }>,
    onBack: () => void,
    testId?: string,
  ): void {
    this.clear();
    const panel = this.createPanel(title);
    panel.classList.add('report-panel');

    const list = document.createElement('ul');
    list.className = 'report-list';
    if (testId) list.dataset.testid = testId;

    for (const row of rows) {
      const li = document.createElement('li');
      li.className = 'report-row';

      const badge = document.createElement('span');
      badge.className = `report-badge ${row.ok ? 'report-ok' : 'report-fail'}`;
      badge.textContent = row.ok ? 'OK' : 'FAIL';

      const label = document.createElement('span');
      label.className = 'report-label';
      label.textContent = row.label;

      li.append(badge, label);
      if (row.detail) {
        const detail = document.createElement('span');
        detail.className = 'report-detail';
        detail.textContent = row.detail;
        li.appendChild(detail);
      }
      list.appendChild(li);
    }
    panel.appendChild(list);

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
