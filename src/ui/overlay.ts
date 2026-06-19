import type { MenuItem } from './menuModel';
import type { DaySummary } from '../engine/timeSystem';
import type { Container, InventoryStack } from '../engine/saveModel';
import type { Item, Npc } from '../data/schemas';
import { QUALITY_LABEL, qualityMultiplier } from '../engine/inventory';
import type { ItemCatalog } from '../engine/itemCatalog';
import { getItem, lovedByNpcs } from '../engine/itemCatalog';

export interface SlotMove {
  fromContainer: 'player' | 'partner';
  fromIndex: number;
  toContainer: 'player' | 'partner' | 'trash';
  toIndex: number | null;
}

export interface InventoryPanelOptions {
  title: string;
  player: Container;
  hotbarSize: number;
  partner?: { id: string; title: string; container: Container };
  catalog: ItemCatalog;
  onMove: (move: SlotMove) => void;
  onClose: () => void;
}

export interface CraftingPanelRecipe {
  id: string;
  name: string;
  type: 'cooking' | 'crafting';
  outputName: string;
  outputQty: number;
  ingredients: Array<{ itemId: string; itemName: string; need: number; have: number }>;
  canCraft: boolean;
}

export interface CraftingPanelOptions {
  title: string;
  recipes: CraftingPanelRecipe[];
  onCraft: (recipeId: string) => void;
  onClose: () => void;
}

export interface MachinePanelRecipeRow {
  recipeIndex: number;
  inputItemName: string;
  inputQty: number;
  inputHave: number;
  outputItemName: string;
  outputQty: number;
  fuelItemName?: string;
  fuelQty?: number;
  fuelHave?: number;
  processLabel: string;
  loadable: boolean;
  loadDisabledReason?: string;
}

export interface MachinePanelOptions {
  title: string;
  /** "Idle", "Processing — 4h left", or "Ready: Goat Cheese". */
  statusLine: string;
  /** When idle, shows recipe rows; otherwise hidden in favor of Collect. */
  recipes?: MachinePanelRecipeRow[];
  /** Shown when the loaded recipe finishes — clicking moves output to inventory. */
  collectLabel?: string;
  onLoad?: (recipeIndex: number) => void;
  onCollect?: () => void;
  onClose: () => void;
}

export interface AnimalPanelRow {
  id: string;
  name: string;
  kindLabel: string;
  habitat: string;
  hearts: number;
  fedToday: boolean;
  pettedToday: boolean;
  mood: 'happy' | 'content' | 'lonely' | 'cold';
  daysToProduce: number;
}

export interface AnimalPanelOptions {
  rows: AnimalPanelRow[];
  onClose: () => void;
}

export interface PetPanelOptions {
  name: string;
  kindLabel: string;
  affection: number;
  bowlFilledToday: boolean;
  pettedToday: boolean;
  collar: 'red' | 'kelp' | 'shell' | null;
  perkLabel: string | null;
  onPet: () => void;
  onPlayFetch: () => void;
  onFillBowl: () => void;
  onSwapKind: () => void;
  onSetCollar: (c: 'red' | 'kelp' | 'shell' | null) => void;
  onClose: () => void;
}

export interface ShopPanelEntry {
  itemId: string;
  itemName: string;
  price: number;
  remaining: number; // -1 = unlimited
}

export interface ShopPanelRecipeOffer {
  recipeId: string;
  recipeName: string;
  price: number;
  knownAlready: boolean;
}

export interface ShopPanelOptions {
  shopName: string;
  walletGold: number;
  entries: ShopPanelEntry[];
  /** Prompt 017: optional recipe offers sold by this shop. */
  recipeOffers?: ShopPanelRecipeOffer[];
  onBuy: (itemId: string) => void;
  onBuyRecipe?: (recipeId: string) => void;
  onClose: () => void;
}

export interface HotbarOptions {
  slots: readonly (InventoryStack | null)[];
  selectedIndex: number;
  catalog: ItemCatalog;
  onSelect: (index: number) => void;
}

export interface DialogueChoiceOption {
  id: string;
  label: string;
}

export interface DialoguePanelOptions {
  speaker: string;
  /** CSS color string; defaults to the accent palette. */
  portraitColor?: string;
  body: string;
  charsPerSecond?: number;
  choices?: DialogueChoiceOption[];
  onSelect?: (choiceId: string) => void;
  onDismiss?: () => void;
  /** RF-13: rapport level (0..maxLevel) shown as a horizontal pip bar. */
  rapportLevel?: number;
  rapportMaxLevel?: number;
  /** RF-13: transient tier feedback after a gift handoff. */
  tierFlash?: { tier: string; deltaText: string };
}

function initialsFor(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function capitalizeTier(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

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

  /**
   * Minimal dialogue bubble (VS-A4 compat). One line + dismiss. Kept so older
   * callers don't break; new code should use `showDialoguePanel` (RF-12).
   */
  showDialogue(speaker: string, body: string, onDismiss: () => void): void {
    this.showDialoguePanel({
      speaker,
      body,
      onDismiss,
    });
  }

  /**
   * Full dialogue panel (RF-12). Portrait placeholder + speaker name +
   * typewritten body + optional branching choices. The typewriter reveals
   * the body at ~35 chars/sec; tapping the body skips to the full line. When
   * `choices` is present, the Continue button is replaced with a vertical
   * list of choice buttons; `onSelect(choiceId)` fires when one is picked.
   */
  showDialoguePanel(opts: DialoguePanelOptions): void {
    this.clear();
    const panel = this.createPanel(opts.speaker);
    panel.classList.add('dialogue-bubble', 'dialogue-panel');
    panel.dataset.testid = 'dialogue-bubble';

    // Portrait placeholder — colored circle with the speaker initials.
    const row = document.createElement('div');
    row.className = 'dialogue-row';

    const portrait = document.createElement('div');
    portrait.className = 'dialogue-portrait';
    portrait.dataset.testid = 'dialogue-portrait';
    portrait.style.background = opts.portraitColor ?? 'var(--sv-accent)';
    portrait.textContent = initialsFor(opts.speaker);
    row.appendChild(portrait);

    const text = document.createElement('p');
    text.className = 'dialogue-body';
    text.dataset.testid = 'dialogue-body';
    text.textContent = '';
    row.appendChild(text);

    panel.appendChild(row);

    // RF-13: rapport bar — N filled pips out of `rapportMaxLevel`.
    if (typeof opts.rapportLevel === 'number') {
      const max = opts.rapportMaxLevel ?? 10;
      const bar = document.createElement('div');
      bar.className = 'dialogue-rapport';
      bar.dataset.testid = 'dialogue-rapport';
      for (let i = 0; i < max; i++) {
        const pip = document.createElement('span');
        pip.className = 'dialogue-pip';
        if (i < opts.rapportLevel) pip.classList.add('dialogue-pip-on');
        bar.appendChild(pip);
      }
      panel.appendChild(bar);
    }

    // RF-13: tier flash after a gift handoff.
    if (opts.tierFlash) {
      const flash = document.createElement('div');
      flash.className = `dialogue-tier dialogue-tier-${opts.tierFlash.tier}`;
      flash.dataset.testid = 'dialogue-tier-flash';
      flash.textContent = `${capitalizeTier(opts.tierFlash.tier)} — ${opts.tierFlash.deltaText}`;
      panel.appendChild(flash);
    }

    // Typewriter — reveals the body progressively, skips to full on click.
    const fullBody = opts.body;
    let revealed = 0;
    const speed = opts.charsPerSecond ?? 35;
    let active = true;
    const tick = (): void => {
      if (!active) return;
      revealed = Math.min(fullBody.length, revealed + Math.max(1, Math.ceil(speed / 30)));
      text.textContent = fullBody.slice(0, revealed);
      if (revealed < fullBody.length) {
        window.setTimeout(tick, 1000 / 30);
      }
    };
    text.addEventListener('click', () => {
      revealed = fullBody.length;
      text.textContent = fullBody;
    });
    window.setTimeout(tick, 1000 / 30);

    // Choices: vertical button list when present; Continue otherwise.
    if (opts.choices && opts.choices.length > 0) {
      const list = document.createElement('div');
      list.className = 'dialogue-choices';
      list.dataset.testid = 'dialogue-choices';
      for (const choice of opts.choices) {
        const btn = document.createElement('button');
        btn.className = 'menu-button';
        btn.type = 'button';
        btn.textContent = choice.label;
        btn.dataset.testid = `dialogue-choice-${choice.id}`;
        btn.addEventListener('click', () => {
          active = false;
          opts.onSelect?.(choice.id);
        });
        list.appendChild(btn);
      }
      panel.appendChild(list);
    } else {
      const dismiss = document.createElement('button');
      dismiss.className = 'menu-button';
      dismiss.type = 'button';
      dismiss.textContent = 'Continue';
      dismiss.dataset.testid = 'dialogue-dismiss';
      dismiss.addEventListener('click', () => {
        active = false;
        opts.onDismiss?.();
      });
      panel.appendChild(dismiss);
    }

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /**
   * Persistent hotbar strip at the bottom of the screen. Rendered as its own
   * element so it can coexist with the HUD bar and pause menu. Idempotent —
   * subsequent calls replace the strip in place without disturbing other UI.
   */
  showHotbar(opts: HotbarOptions): void {
    const existing = this.root.querySelector<HTMLDivElement>('.hotbar-strip');
    const strip = existing ?? document.createElement('div');
    strip.className = 'hotbar-strip';
    strip.dataset.testid = 'hotbar';
    strip.replaceChildren();

    opts.slots.forEach((stack, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hotbar-slot';
      if (i === opts.selectedIndex) btn.classList.add('hotbar-slot-active');
      btn.dataset.testid = `hotbar-slot-${i}`;
      btn.title = stack
        ? `${getItem(opts.catalog, stack.itemId)?.name ?? stack.itemId} ×${stack.qty}`
        : `Slot ${i + 1}`;

      const number = document.createElement('span');
      number.className = 'hotbar-number';
      number.textContent = `${i + 1}`;
      btn.appendChild(number);

      if (stack) {
        const item = getItem(opts.catalog, stack.itemId);
        const label = document.createElement('span');
        label.className = 'hotbar-item';
        label.textContent = item?.name ?? stack.itemId;
        const qty = document.createElement('span');
        qty.className = 'hotbar-qty';
        qty.textContent = `×${stack.qty}`;
        btn.append(label, qty);
        if (stack.quality > 0) {
          const star = document.createElement('span');
          star.className = `hotbar-quality quality-${stack.quality}`;
          star.textContent = '★'.repeat(stack.quality);
          btn.appendChild(star);
        }
      }

      btn.addEventListener('click', () => opts.onSelect(i));
      strip.appendChild(btn);
    });

    if (!existing) this.root.appendChild(strip);
  }

  clearHotbar(): void {
    this.root.querySelector('.hotbar-strip')?.remove();
  }

  /**
   * Dual-container inventory panel (player + optional partner — chest or
   * shipping bin) with a Trash slot and pointer-driven drag/drop. The
   * `onMove` callback receives a structured SlotMove the caller routes through
   * the pure inventory engine; the renderer just renders.
   */
  showInventory(opts: InventoryPanelOptions): void {
    this.clear();
    const panel = this.createPanel(opts.title, opts.partner?.title);
    panel.classList.add('inventory-panel');
    panel.dataset.testid = 'inventory-panel';

    const grids = document.createElement('div');
    grids.className = 'inventory-grids';

    const playerGrid = this.renderContainerGrid(
      opts.player,
      'player',
      opts.hotbarSize,
      opts.catalog,
      opts,
    );
    playerGrid.dataset.testid = 'inventory-player';
    grids.appendChild(playerGrid);

    if (opts.partner) {
      const partnerGrid = this.renderContainerGrid(
        opts.partner.container,
        'partner',
        opts.partner.container.capacity, // no hotbar split on partners
        opts.catalog,
        opts,
      );
      partnerGrid.dataset.testid = `inventory-partner-${opts.partner.id}`;
      grids.appendChild(partnerGrid);
    }

    panel.appendChild(grids);

    const trash = document.createElement('button');
    trash.type = 'button';
    trash.className = 'inventory-trash';
    trash.textContent = 'Trash';
    trash.dataset.testid = 'inventory-trash';
    trash.addEventListener('dragover', (e) => e.preventDefault());
    trash.addEventListener('drop', (e) => {
      e.preventDefault();
      const data = this.readDragData(e.dataTransfer);
      if (!data) return;
      opts.onMove({
        fromContainer: data.fromContainer,
        fromIndex: data.fromIndex,
        toContainer: 'trash',
        toIndex: null,
      });
    });
    panel.appendChild(trash);

    const close = document.createElement('button');
    close.className = 'menu-button';
    close.type = 'button';
    close.textContent = 'Close';
    close.dataset.testid = 'inventory-close';
    close.addEventListener('click', opts.onClose);
    panel.appendChild(close);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  private renderContainerGrid(
    container: Container,
    role: 'player' | 'partner',
    hotbarSize: number,
    catalog: ItemCatalog,
    opts: InventoryPanelOptions,
  ): HTMLDivElement {
    const grid = document.createElement('div');
    grid.className = 'inventory-grid';

    container.slots.forEach((stack, i) => {
      const cell = document.createElement('div');
      cell.className = 'inventory-slot';
      if (role === 'player' && i < hotbarSize) cell.classList.add('inventory-slot-hotbar');
      cell.dataset.testid = `slot-${role}-${i}`;
      cell.draggable = stack !== null;

      if (stack) {
        const item = getItem(catalog, stack.itemId);
        const label = document.createElement('span');
        label.className = 'inventory-item';
        label.textContent = item?.name ?? stack.itemId;
        const qty = document.createElement('span');
        qty.className = 'inventory-qty';
        qty.textContent = `×${stack.qty}`;
        cell.append(label, qty);
        if (stack.quality > 0) {
          const star = document.createElement('span');
          star.className = `inventory-quality quality-${stack.quality}`;
          star.textContent = '★'.repeat(stack.quality);
          cell.appendChild(star);
        }
        cell.title = this.tooltipText(stack, catalog);
      }

      cell.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', JSON.stringify({ fromContainer: role, fromIndex: i }));
      });
      cell.addEventListener('dragover', (e) => e.preventDefault());
      cell.addEventListener('drop', (e) => {
        e.preventDefault();
        const data = this.readDragData(e.dataTransfer);
        if (!data) return;
        opts.onMove({
          fromContainer: data.fromContainer,
          fromIndex: data.fromIndex,
          toContainer: role,
          toIndex: i,
        });
      });
      grid.appendChild(cell);
    });
    return grid;
  }

  private readDragData(dt: DataTransfer | null): { fromContainer: 'player' | 'partner'; fromIndex: number } | null {
    if (!dt) return null;
    const raw = dt.getData('text/plain');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { fromContainer: 'player' | 'partner'; fromIndex: number };
      if (
        (parsed.fromContainer === 'player' || parsed.fromContainer === 'partner') &&
        Number.isInteger(parsed.fromIndex)
      ) {
        return parsed;
      }
    } catch {
      /* drop bad payloads */
    }
    return null;
  }

  private tooltipText(stack: InventoryStack, catalog: ItemCatalog): string {
    const item = getItem(catalog, stack.itemId);
    if (!item) return stack.itemId;
    return tooltipLines(stack, item, lovedByNpcs(catalog, stack.itemId)).join('\n');
  }

  /**
   * Crafting panel (Prompt 017). Lists known recipes filtered by type; each
   * row shows the output, ingredients ("3/2 bell-peas"), and a Craft button
   * disabled when ingredients are short.
   */
  showCraftingPanel(opts: CraftingPanelOptions): void {
    this.clear();
    const panel = this.createPanel(opts.title);
    panel.classList.add('crafting-panel');
    panel.dataset.testid = 'crafting-panel';

    const list = document.createElement('ul');
    list.className = 'crafting-list';
    list.dataset.testid = 'crafting-list';
    for (const r of opts.recipes) {
      const li = document.createElement('li');
      li.className = 'crafting-row';
      li.dataset.testid = `crafting-row-${r.id}`;

      const head = document.createElement('div');
      head.className = 'crafting-head';
      const title = document.createElement('span');
      title.className = 'crafting-title';
      title.textContent = `${r.name} → ${r.outputName} ×${r.outputQty}`;
      const badge = document.createElement('span');
      badge.className = 'crafting-type';
      badge.textContent = r.type;
      head.append(title, badge);

      const ing = document.createElement('div');
      ing.className = 'crafting-ingredients';
      ing.textContent = r.ingredients
        .map((i) => `${i.have}/${i.need} ${i.itemName}`)
        .join(' · ');

      const craftBtn = document.createElement('button');
      craftBtn.className = 'menu-button crafting-btn';
      craftBtn.type = 'button';
      craftBtn.textContent = 'Craft';
      craftBtn.dataset.testid = `crafting-craft-${r.id}`;
      craftBtn.disabled = !r.canCraft;
      craftBtn.addEventListener('click', () => opts.onCraft(r.id));

      li.append(head, ing, craftBtn);
      list.appendChild(li);
    }
    panel.appendChild(list);

    const close = document.createElement('button');
    close.className = 'menu-button';
    close.type = 'button';
    close.textContent = 'Close';
    close.dataset.testid = 'crafting-close';
    close.addEventListener('click', opts.onClose);
    panel.appendChild(close);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /**
   * Pet panel (Prompt 020). Shows the pet's stats, today's care, and
   * buttons for petting, filling the bowl, playing fetch, swapping
   * kind, and changing the collar.
   */
  showPetPanel(opts: PetPanelOptions): void {
    this.clear();
    const panel = this.createPanel(opts.name);
    panel.classList.add('pet-panel');
    panel.dataset.testid = 'pet-panel';

    const stats = document.createElement('div');
    stats.className = 'pet-stats';
    const hearts = Math.floor(opts.affection / 200);
    stats.textContent = `${opts.kindLabel} · ${'♥'.repeat(hearts)}${'♡'.repeat(5 - hearts)} (${opts.affection}/1000)`;
    panel.appendChild(stats);

    const care = document.createElement('div');
    care.className = 'pet-care';
    const careParts = [
      `bowl: ${opts.bowlFilledToday ? 'full' : 'empty'}`,
      `petted today: ${opts.pettedToday ? 'yes' : 'no'}`,
      `collar: ${opts.collar ?? 'none'}`,
    ];
    if (opts.perkLabel) careParts.push(`perk unlocked: ${opts.perkLabel}`);
    care.textContent = careParts.join(' · ');
    panel.appendChild(care);

    const actions = document.createElement('div');
    actions.className = 'pet-actions';

    const petBtn = document.createElement('button');
    petBtn.type = 'button';
    petBtn.className = 'menu-button';
    petBtn.textContent = opts.pettedToday ? 'Already petted' : 'Pet';
    petBtn.dataset.testid = 'pet-pet';
    petBtn.disabled = opts.pettedToday;
    petBtn.addEventListener('click', opts.onPet);
    actions.appendChild(petBtn);

    const fetchBtn = document.createElement('button');
    fetchBtn.type = 'button';
    fetchBtn.className = 'menu-button';
    fetchBtn.textContent = 'Play fetch';
    fetchBtn.dataset.testid = 'pet-fetch';
    fetchBtn.addEventListener('click', opts.onPlayFetch);
    actions.appendChild(fetchBtn);

    const bowlBtn = document.createElement('button');
    bowlBtn.type = 'button';
    bowlBtn.className = 'menu-button';
    bowlBtn.textContent = opts.bowlFilledToday ? 'Bowl full' : 'Fill water bowl';
    bowlBtn.dataset.testid = 'pet-bowl';
    bowlBtn.disabled = opts.bowlFilledToday;
    bowlBtn.addEventListener('click', opts.onFillBowl);
    actions.appendChild(bowlBtn);

    const swapBtn = document.createElement('button');
    swapBtn.type = 'button';
    swapBtn.className = 'menu-button';
    swapBtn.textContent = 'Swap kind';
    swapBtn.dataset.testid = 'pet-swap';
    swapBtn.addEventListener('click', opts.onSwapKind);
    actions.appendChild(swapBtn);

    panel.appendChild(actions);

    const collarRow = document.createElement('div');
    collarRow.className = 'pet-collars';
    const labelEl = document.createElement('span');
    labelEl.className = 'pet-collar-label';
    labelEl.textContent = 'Collar:';
    collarRow.appendChild(labelEl);
    for (const c of ['none', 'red', 'kelp', 'shell'] as const) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-button menu-button-secondary';
      btn.textContent = c;
      btn.dataset.testid = `pet-collar-${c}`;
      btn.addEventListener('click', () => opts.onSetCollar(c === 'none' ? null : c));
      collarRow.appendChild(btn);
    }
    panel.appendChild(collarRow);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'menu-button';
    close.textContent = 'Close';
    close.dataset.testid = 'pet-close';
    close.addEventListener('click', opts.onClose);
    panel.appendChild(close);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /**
   * Animal panel (Prompt 019). Lists every animal with mood, hearts,
   * today's care state, and days-to-product. Read-only summary; petting
   * + feeding happen in the world via E.
   */
  showAnimalPanel(opts: AnimalPanelOptions): void {
    this.clear();
    const panel = this.createPanel('Animals');
    panel.classList.add('animal-panel');
    panel.dataset.testid = 'animal-panel';

    if (opts.rows.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'panel-body';
      empty.textContent = 'No animals on the farm yet.';
      panel.appendChild(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'animal-list';
      list.dataset.testid = 'animal-list';
      for (const r of opts.rows) {
        const li = document.createElement('li');
        li.className = `animal-row mood-${r.mood}`;
        li.dataset.testid = `animal-row-${r.id}`;
        const title = document.createElement('div');
        title.className = 'animal-title';
        title.textContent = `${r.name} · ${r.kindLabel}`;
        const meta = document.createElement('div');
        meta.className = 'animal-meta';
        const hearts = '♥'.repeat(r.hearts) + '♡'.repeat(Math.max(0, 5 - r.hearts));
        const todo: string[] = [];
        if (!r.fedToday) todo.push('feed');
        if (!r.pettedToday) todo.push('pet');
        const todoText = todo.length === 0 ? 'cared for today' : `needs: ${todo.join(', ')}`;
        meta.textContent = `${hearts} · ${r.mood} · ${todoText} · produce in ${r.daysToProduce}d`;
        li.append(title, meta);
        list.appendChild(li);
      }
      panel.appendChild(list);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'menu-button';
    close.textContent = 'Close';
    close.dataset.testid = 'animal-close';
    close.addEventListener('click', opts.onClose);
    panel.appendChild(close);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /**
   * Machine panel (Prompt 018). Three modes depending on state:
   * - idle: a list of supported recipes the player can load.
   * - processing: status line with the remaining time.
   * - ready: a single Collect button at the top.
   */
  showMachinePanel(opts: MachinePanelOptions): void {
    this.clear();
    const panel = this.createPanel(opts.title, opts.statusLine);
    panel.classList.add('machine-panel');
    panel.dataset.testid = 'machine-panel';

    if (opts.collectLabel) {
      const collect = document.createElement('button');
      collect.type = 'button';
      collect.className = 'menu-button machine-collect';
      collect.textContent = opts.collectLabel;
      collect.dataset.testid = 'machine-collect';
      collect.addEventListener('click', () => opts.onCollect?.());
      panel.appendChild(collect);
    } else if (opts.recipes && opts.recipes.length > 0) {
      const list = document.createElement('ul');
      list.className = 'machine-list';
      list.dataset.testid = 'machine-list';
      for (const r of opts.recipes) {
        const li = document.createElement('li');
        li.className = 'machine-row';
        li.dataset.testid = `machine-row-${r.recipeIndex}`;

        const head = document.createElement('div');
        head.className = 'machine-head';
        const title = document.createElement('span');
        title.className = 'machine-title';
        title.textContent = `${r.inputQty}× ${r.inputItemName} → ${r.outputQty}× ${r.outputItemName}`;
        head.appendChild(title);

        const info = document.createElement('div');
        info.className = 'machine-info';
        const parts = [`${r.inputHave}/${r.inputQty} ${r.inputItemName}`];
        if (r.fuelItemName && r.fuelQty !== undefined) {
          parts.push(`${r.fuelHave ?? 0}/${r.fuelQty} ${r.fuelItemName}`);
        }
        parts.push(r.processLabel);
        info.textContent = parts.join(' · ');

        const loadBtn = document.createElement('button');
        loadBtn.type = 'button';
        loadBtn.className = 'menu-button machine-load';
        loadBtn.textContent = 'Load';
        loadBtn.dataset.testid = `machine-load-${r.recipeIndex}`;
        loadBtn.disabled = !r.loadable;
        if (!r.loadable && r.loadDisabledReason) loadBtn.title = r.loadDisabledReason;
        loadBtn.addEventListener('click', () => opts.onLoad?.(r.recipeIndex));

        li.append(head, info, loadBtn);
        list.appendChild(li);
      }
      panel.appendChild(list);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'menu-button';
    close.textContent = 'Close';
    close.dataset.testid = 'machine-close';
    close.addEventListener('click', opts.onClose);
    panel.appendChild(close);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /**
   * Shop panel (Prompt 016). Shows the shop name + wallet + stock list with
   * per-row Buy button. Idempotent — re-mounts replace prior panel cleanly.
   */
  showShopPanel(opts: ShopPanelOptions): void {
    this.clear();
    const panel = this.createPanel(opts.shopName, `${opts.walletGold} g in wallet`);
    panel.classList.add('shop-panel');
    panel.dataset.testid = 'shop-panel';

    const list = document.createElement('ul');
    list.className = 'shop-list';
    list.dataset.testid = 'shop-list';
    for (const entry of opts.entries) {
      const li = document.createElement('li');
      li.className = 'shop-row';
      li.dataset.testid = `shop-row-${entry.itemId}`;

      const name = document.createElement('span');
      name.className = 'shop-item-name';
      name.textContent = entry.itemName;

      const price = document.createElement('span');
      price.className = 'shop-item-price';
      price.textContent = `${entry.price} g`;

      const buyBtn = document.createElement('button');
      buyBtn.type = 'button';
      buyBtn.className = 'menu-button shop-buy';
      buyBtn.dataset.testid = `shop-buy-${entry.itemId}`;
      const stockNote = entry.remaining === -1 ? '' : ` (${entry.remaining} left)`;
      buyBtn.textContent = `Buy${stockNote}`;
      buyBtn.disabled =
        opts.walletGold < entry.price || entry.remaining === 0;
      buyBtn.addEventListener('click', () => opts.onBuy(entry.itemId));

      li.append(name, price, buyBtn);
      list.appendChild(li);
    }
    panel.appendChild(list);

    // Prompt 017: optional recipe shelf — buying a recipe unlocks it on the
    // save instead of dropping an item in inventory.
    if (opts.recipeOffers && opts.recipeOffers.length > 0) {
      const heading = document.createElement('div');
      heading.className = 'shop-section-heading';
      heading.textContent = 'Recipes';
      panel.appendChild(heading);

      const rList = document.createElement('ul');
      rList.className = 'shop-list';
      rList.dataset.testid = 'shop-recipes';
      for (const offer of opts.recipeOffers) {
        const li = document.createElement('li');
        li.className = 'shop-row';
        li.dataset.testid = `shop-recipe-${offer.recipeId}`;

        const name = document.createElement('span');
        name.className = 'shop-item-name';
        name.textContent = offer.recipeName;

        const price = document.createElement('span');
        price.className = 'shop-item-price';
        price.textContent = `${offer.price} g`;

        const buyBtn = document.createElement('button');
        buyBtn.type = 'button';
        buyBtn.className = 'menu-button shop-buy';
        buyBtn.dataset.testid = `shop-buy-recipe-${offer.recipeId}`;
        buyBtn.textContent = offer.knownAlready ? 'Known' : 'Learn';
        buyBtn.disabled = offer.knownAlready || opts.walletGold < offer.price;
        buyBtn.addEventListener('click', () => opts.onBuyRecipe?.(offer.recipeId));

        li.append(name, price, buyBtn);
        rList.appendChild(li);
      }
      panel.appendChild(rList);
    }

    const close = document.createElement('button');
    close.className = 'menu-button';
    close.type = 'button';
    close.textContent = 'Close';
    close.dataset.testid = 'shop-close';
    close.addEventListener('click', opts.onClose);
    panel.appendChild(close);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /** Bedtime / collapse summary panel — income, skill XP, relationship deltas, notices. */
  showDaySummary(summary: DaySummary, onContinue: () => void): void {
    this.clear();
    const panel = this.createPanel('Day Summary', summary.dayLabel);
    panel.classList.add('day-summary-panel');
    panel.dataset.testid = 'day-summary';

    const stats = document.createElement('ul');
    stats.className = 'day-summary-stats';

    const rows: Array<[string, string]> = [
      ['Income', `${summary.income} g`],
      ['Relationship changes', `${summary.relationshipChanges}`],
    ];
    const xpEntries = Object.entries(summary.skillXp);
    if (xpEntries.length === 0) {
      rows.push(['Skill XP', 'none today']);
    } else {
      for (const [skill, xp] of xpEntries) {
        rows.push([`${skill} XP`, `+${xp}`]);
      }
    }
    for (const [label, value] of rows) {
      const li = document.createElement('li');
      li.className = 'day-summary-row';
      const k = document.createElement('span');
      k.className = 'day-summary-label';
      k.textContent = label;
      const v = document.createElement('span');
      v.className = 'day-summary-value';
      v.textContent = value;
      li.append(k, v);
      stats.appendChild(li);
    }
    panel.appendChild(stats);

    if (summary.notices.length > 0) {
      const notices = document.createElement('ul');
      notices.className = 'day-summary-notices';
      notices.dataset.testid = 'day-summary-notices';
      for (const note of summary.notices) {
        const li = document.createElement('li');
        li.className = 'day-summary-notice';
        li.textContent = note;
        notices.appendChild(li);
      }
      panel.appendChild(notices);
    }

    const cont = document.createElement('button');
    cont.className = 'menu-button';
    cont.type = 'button';
    cont.textContent = 'Continue to next day';
    cont.dataset.testid = 'day-summary-continue';
    cont.addEventListener('click', onContinue);
    panel.appendChild(cont);

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

/**
 * Pure tooltip-line builder. Exported so unit tests can lock the field order
 * + format without spinning up jsdom + the full overlay.
 */
export function tooltipLines(
  stack: InventoryStack,
  item: Item,
  loved: readonly Npc[],
): string[] {
  const lines: string[] = [];
  lines.push(item.name);
  lines.push(item.description);
  lines.push(`Source: ${item.category}`);
  if (item.tags.length > 0) lines.push(`Tags: ${item.tags.join(', ')}`);
  const sellEach = Math.max(0, Math.round(item.sellPrice * qualityMultiplier(stack.quality)));
  lines.push(`Sell: ${sellEach} g each (${sellEach * stack.qty} g for ${stack.qty})`);
  lines.push(`Quality: ${QUALITY_LABEL[Math.max(0, Math.min(3, stack.quality))]}`);
  if (loved.length > 0) {
    lines.push(`Loved by: ${loved.map((n) => n.name).join(', ')}`);
  }
  return lines;
}
