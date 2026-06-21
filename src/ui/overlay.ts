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

export interface ProfessionPanelSkillRow {
  skillId: string;
  name: string;
  xp: number;
  level: number;
  xpToNext: number;
  /** Profession id selected, if any. */
  professionId: string | null;
  /** Available choices when level threshold met but no pick yet. */
  pendingChoices?: Array<{ id: string; label: string; description: string }>;
}
export interface ProfessionPanelOptions {
  rows: ProfessionPanelSkillRow[];
  masteryXp: number;
  onChoose: (skillId: string, professionId: string) => void;
  onClose: () => void;
}

export interface QuestPanelObjective {
  label: string;
  current: number;
  target: number;
  done: boolean;
}

export interface QuestPanelRow {
  id: string;
  name: string;
  category: string;
  kind: string;
  status: 'active' | 'available' | 'complete' | 'failed';
  description: string;
  objectives: QuestPanelObjective[];
  rewardSummary: string;
  /** Display name of the quest giver, when any. */
  giver?: string | null;
  canAccept: boolean;
  canCancel: boolean;
  /** e.g. "3 days left" — shown only on timed active quests. */
  timeLeftLabel?: string;
}

export interface QuestPanelOptions {
  rows: QuestPanelRow[];
  /** Summary line, e.g. "2 active · 6 available · 1 done". */
  summary: string;
  onAccept: (id: string) => void;
  onCancel: (id: string) => void;
  onClose: () => void;
}

export interface CivicBoardRequirement {
  label: string;
  kind: 'item' | 'gold' | 'relationship';
  current: number;
  target: number;
  met: boolean;
  /** True for item/gold reqs offering a "Give" button (false for relationship gates). */
  contributable: boolean;
}

export interface CivicBoardRow {
  id: string;
  name: string;
  description: string;
  unlocks: string;
  complete: boolean;
  /** e.g. "Phase 1/2 · Clear the salvage". */
  phaseLabel: string;
  phaseDescription: string;
  requirements: CivicBoardRequirement[];
  rewardSummary: string;
  giver?: string | null;
}

export interface CivicBoardOptions {
  rows: CivicBoardRow[];
  /** Summary line, e.g. "2 in progress · 1 restored". */
  summary: string;
  onContribute: (projectId: string, reqIndex: number) => void;
  onClose: () => void;
}

export interface CeremonyReactionLine {
  speaker: string;
  line: string;
}

export interface CeremonyOptions {
  projectName: string;
  unlocks: string;
  reactions: CeremonyReactionLine[];
  onClose: () => void;
}

export interface FestivalPanelMinigame {
  name: string;
  description: string;
  rewardSummary: string;
  bestScore: number;
  goal: number;
  /** True when the once-per-year prize has already been won this year. */
  claimedThisYear: boolean;
}

export interface FestivalPanelRelationship {
  npcName: string;
  rewardSummary: string;
  /** True when the moment has already been shared this year. */
  claimedThisYear: boolean;
}

export interface FestivalPanelOptions {
  name: string;
  description: string;
  /** "9:00 AM–10:00 PM". */
  windowLabel: string;
  /** True when the festival is within its active window right now. */
  activeNow: boolean;
  minigame?: FestivalPanelMinigame | null;
  stallName?: string | null;
  relationship?: FestivalPanelRelationship | null;
  onPlayMinigame: () => void;
  onVisitStall: () => void;
  onShareMoment: () => void;
  onClose: () => void;
}

export interface FestivalMinigameOptions {
  title: string;
  instruction: string;
  /** Flavor noun for one target ("pod", "lantern", "dish", "cast"). */
  targetLabel: string;
  slots: number;
  /** The lit slot the player should tap this round. */
  activeSlot: number;
  round: number;
  rounds: number;
  score: number;
  goal: number;
  phase: 'play' | 'won' | 'lost';
  /** Reward summary shown on a win, when a prize was granted. */
  resultSummary?: string | null;
  onTap: (slot: number) => void;
  onReplay: () => void;
  onClose: () => void;
}

export interface MailboxPanelRow {
  id: string;
  sender: string;
  subject: string;
  read: boolean;
  hasAttachments: boolean;
}

export interface MailboxPanelOptions {
  rows: MailboxPanelRow[];
  /** Summary line, e.g. "2 unread · 6 letters". */
  summary: string;
  onOpen: (id: string) => void;
  onClose: () => void;
}

export interface LetterPanelOptions {
  sender: string;
  subject: string;
  body: string;
  /** Summary of granted attachments ("3× Bell Pea Seeds · Town progress"), or empty. */
  attachmentSummary: string;
  /** Display name of a quest the letter started, if any. */
  startsQuest?: string | null;
  onBack: () => void;
}

export interface NoticeBoardPanelOptions {
  forecast: string[];
  /** Help-wanted + birthday lines (the "reasons to visit town"). */
  requests: string[];
  news: string[];
  summary: string;
  onClose: () => void;
}

export interface CookingPanelRecipe {
  id: string;
  name: string;
  outputName: string;
  outputQty: number;
  ingredients: Array<{ itemName: string; need: number; have: number }>;
  canCook: boolean;
  /** Buff the cooked dish grants, e.g. "Quick step +20%". */
  buffLabel?: string | null;
}

export interface CookingPantryRow {
  itemId: string;
  name: string;
  qty: number;
  /** "+30 stamina · Quick step +20%" or just the stamina. */
  effectLabel: string;
}

export interface CookingBuffRow {
  label: string;
  magnitudeLabel: string;
  minutesLeft: number;
}

export interface CookingPanelOptions {
  recipes: CookingPanelRecipe[];
  /** Edible items the player is holding, with their effect. */
  pantry: CookingPantryRow[];
  /** Currently-active buffs. */
  activeBuffs: CookingBuffRow[];
  onCook: (recipeId: string) => void;
  onEat: (itemId: string) => void;
  onClose: () => void;
}

/* Home / decor / customization (Prompt 060) ------------------------------- */

export type HomeTab = 'decorate' | 'surfaces' | 'renovate' | 'wardrobe';

export interface HomeDecorateRow {
  id: string;
  name: string;
  categoryLabel: string;
  price: number;
  affordable: boolean;
}
export interface HomePlacedRow {
  id: string;
  name: string;
}
export interface HomeSurfaceRow {
  id: string;
  name: string;
  active: boolean;
}
export interface HomeRenovationRow {
  id: string;
  name: string;
  description: string;
  price: number;
  owned: boolean;
  affordable: boolean;
}
export interface HomeWardrobeSwatch {
  id: string;
  name: string;
  active: boolean;
}
export interface HomeWardrobePart {
  part: string;
  label: string;
  swatches: HomeWardrobeSwatch[];
}

export interface HomePanelOptions {
  activeTab: HomeTab;
  gold: number;
  onTab: (tab: HomeTab) => void;
  onPhotoMode: () => void;
  onClose: () => void;
  // Decorate
  furniture: HomeDecorateRow[];
  placed: HomePlacedRow[];
  onPlace: (furnitureId: string) => void;
  onPickUp: (placementId: string) => void;
  // Surfaces
  wallpapers: HomeSurfaceRow[];
  floorings: HomeSurfaceRow[];
  onWallpaper: (id: string) => void;
  onFlooring: (id: string) => void;
  // Renovate
  renovations: HomeRenovationRow[];
  onRenovate: (id: string) => void;
  // Wardrobe
  wardrobe: HomeWardrobePart[];
  onSwatch: (part: string, swatchId: string) => void;
}

export interface PlacementBarOptions {
  /** Name of the piece being placed. */
  label: string;
  onRotate: () => void;
  onPlace: () => void;
  onCancel: () => void;
}

export interface PhotoModeBarOptions {
  note: string;
  onCapture: () => void;
  onExit: () => void;
}

export interface ElevatorPanelOption {
  level: number;
  name: string;
  isCurrent: boolean;
}

export interface ElevatorPanelOptions {
  options: ElevatorPanelOption[];
  onSelect: (level: number) => void;
  onClose: () => void;
}

export interface ReefPanelOptions {
  /** "open" | "wading" | "closed". */
  access: 'open' | 'wading' | 'closed';
  /** Oxygen 0..1. */
  oxygen: number;
  oxygenWarning: boolean;
  /** Reef restoration 0..1. */
  reefHealth: number;
  reefTier: number;
  fragmentsOnHand: number;
  fragmentsToNextTier: number;
  lastEncounter: string | null;
  onHarvest: () => void;
  onSurface: () => void;
  onDonate: () => void;
  onClose: () => void;
}

export interface FishingPanelOptions {
  /** Player's bait count. */
  baitCount: number;
  /** Assist-mode toggle hint to show in the panel header. */
  assist: boolean;
  /** "Cast" | "Waiting" | "Reel!" | "Caught" | "Got away". */
  phase: 'cast' | 'waiting' | 'reel' | 'caught' | 'lost';
  /** Player's last catch label (used during 'caught'). */
  lastCatchLabel?: string;
  /** Live minigame snapshot when phase === 'reel'. */
  minigame?: { fishPos: number; cursorPos: number; cursorWidth: number; progress: number };
  onCast: (withBait: boolean) => void;
  onToggleAssist: () => void;
  onDropPot: () => void;
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
   * Professions panel (Prompt 027). Lists every skill with XP +
   * level + xpToNext + the selected profession (or pending-choice
   * buttons). Mastery XP total surfaces at the bottom.
   */
  showProfessionPanel(opts: ProfessionPanelOptions): void {
    this.clear();
    const panel = this.createPanel('Skills & Professions', `Mastery XP: ${opts.masteryXp}`);
    panel.classList.add('profession-panel');
    panel.dataset.testid = 'profession-panel';

    const list = document.createElement('ul');
    list.className = 'profession-list';
    for (const r of opts.rows) {
      const li = document.createElement('li');
      li.className = 'profession-row';
      li.dataset.testid = `profession-row-${r.skillId}`;
      const title = document.createElement('div');
      title.className = 'profession-title';
      title.textContent = `${r.name} — Lv ${r.level}`;
      const meta = document.createElement('div');
      meta.className = 'profession-meta';
      meta.textContent = `XP ${r.xp}${r.xpToNext > 0 ? ` · ${r.xpToNext} to next` : ' · MAX'}` +
        (r.professionId ? ` · ${r.professionId}` : '');
      li.append(title, meta);
      if (r.pendingChoices && r.pendingChoices.length > 0) {
        const choices = document.createElement('div');
        choices.className = 'profession-choices';
        for (const choice of r.pendingChoices) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'menu-button menu-button-secondary';
          btn.textContent = `${choice.label}: ${choice.description}`;
          btn.dataset.testid = `profession-pick-${r.skillId}-${choice.id}`;
          btn.addEventListener('click', () => opts.onChoose(r.skillId, choice.id));
          choices.appendChild(btn);
        }
        li.appendChild(choices);
      }
      list.appendChild(li);
    }
    panel.appendChild(list);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'menu-button';
    close.textContent = 'Close';
    close.dataset.testid = 'profession-close';
    close.addEventListener('click', opts.onClose);
    panel.appendChild(close);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /**
   * Quest journal (Prompt 054). A scrollable, touch-friendly list of quests
   * sorted active → available → done → failed. Each card shows the giver,
   * category/kind chips, objective progress, the reward summary, and any time
   * limit; Accept/Cancel buttons appear for the rows that allow them.
   */
  showQuestPanel(opts: QuestPanelOptions): void {
    this.clear();
    const panel = this.createPanel('Quest Journal', opts.summary);
    panel.classList.add('quest-panel');
    panel.dataset.testid = 'quest-panel';

    if (opts.rows.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'panel-body';
      empty.textContent = 'No quests yet. Talk to the folks of Ballast Bay and check the town notice board.';
      panel.appendChild(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'quest-list';
      list.dataset.testid = 'quest-list';

      const STATUS_LABEL: Record<QuestPanelRow['status'], string> = {
        active: 'Active',
        available: 'Available',
        complete: 'Done',
        failed: 'Failed',
      };

      for (const row of opts.rows) {
        const li = document.createElement('li');
        li.className = `quest-row quest-status-${row.status}`;
        li.dataset.testid = `quest-row-${row.id}`;

        const head = document.createElement('div');
        head.className = 'quest-head';
        const title = document.createElement('span');
        title.className = 'quest-title';
        title.textContent = row.name;
        const status = document.createElement('span');
        status.className = `quest-badge quest-badge-${row.status}`;
        status.dataset.testid = `quest-status-${row.id}`;
        status.textContent = STATUS_LABEL[row.status];
        head.append(title, status);
        li.appendChild(head);

        const chips = document.createElement('div');
        chips.className = 'quest-chips';
        const chipParts = [row.category, row.kind];
        if (row.giver) chipParts.push(`from ${row.giver}`);
        if (row.timeLeftLabel) chipParts.push(row.timeLeftLabel);
        chips.textContent = chipParts.join(' · ');
        li.appendChild(chips);

        const desc = document.createElement('p');
        desc.className = 'quest-desc';
        desc.textContent = row.description;
        li.appendChild(desc);

        const objList = document.createElement('ul');
        objList.className = 'quest-objectives';
        row.objectives.forEach((obj, i) => {
          const oli = document.createElement('li');
          oli.className = `quest-objective${obj.done ? ' quest-objective-done' : ''}`;
          oli.dataset.testid = `quest-objective-${row.id}-${i}`;
          const mark = obj.done ? '✔' : '○';
          oli.textContent = `${mark} ${obj.label} — ${obj.current}/${obj.target}`;
          objList.appendChild(oli);
        });
        li.appendChild(objList);

        const reward = document.createElement('div');
        reward.className = 'quest-reward';
        reward.textContent = `Reward: ${row.rewardSummary}`;
        li.appendChild(reward);

        if (row.canAccept || row.canCancel) {
          const actions = document.createElement('div');
          actions.className = 'quest-actions';
          if (row.canAccept) {
            const accept = document.createElement('button');
            accept.type = 'button';
            accept.className = 'menu-button';
            accept.textContent = 'Accept';
            accept.dataset.testid = `quest-accept-${row.id}`;
            accept.addEventListener('click', () => opts.onAccept(row.id));
            actions.appendChild(accept);
          }
          if (row.canCancel) {
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'menu-button menu-button-secondary';
            cancel.textContent = 'Abandon';
            cancel.dataset.testid = `quest-cancel-${row.id}`;
            cancel.addEventListener('click', () => opts.onCancel(row.id));
            actions.appendChild(cancel);
          }
          li.appendChild(actions);
        }

        list.appendChild(li);
      }
      panel.appendChild(list);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'menu-button';
    close.textContent = 'Close';
    close.dataset.testid = 'quest-close';
    close.addEventListener('click', opts.onClose);
    panel.appendChild(close);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /**
   * Civic project board (Prompt 055). A scrollable, touch-friendly list of
   * community restoration projects. Each card shows the current phase, its
   * requirements (item/gold with a Give button, relationship gates as met/unmet
   * pips), the reward, and what completing it unlocks.
   */
  showCivicBoardPanel(opts: CivicBoardOptions): void {
    this.clear();
    const panel = this.createPanel('Community Restoration', opts.summary);
    panel.classList.add('civic-panel');
    panel.dataset.testid = 'civic-panel';

    const list = document.createElement('ul');
    list.className = 'civic-list';
    list.dataset.testid = 'civic-list';

    for (const row of opts.rows) {
      const li = document.createElement('li');
      li.className = `civic-row${row.complete ? ' civic-row-complete' : ''}`;
      li.dataset.testid = `civic-row-${row.id}`;

      const head = document.createElement('div');
      head.className = 'civic-head';
      const title = document.createElement('span');
      title.className = 'civic-title';
      title.textContent = row.name;
      const status = document.createElement('span');
      status.className = `civic-badge ${row.complete ? 'civic-badge-complete' : 'civic-badge-active'}`;
      status.dataset.testid = `civic-status-${row.id}`;
      status.textContent = row.complete ? 'Restored' : row.phaseLabel;
      head.append(title, status);
      li.appendChild(head);

      const desc = document.createElement('p');
      desc.className = 'civic-desc';
      desc.textContent = row.complete ? row.unlocks : row.phaseDescription;
      li.appendChild(desc);

      if (!row.complete) {
        const reqList = document.createElement('ul');
        reqList.className = 'civic-reqs';
        row.requirements.forEach((req, i) => {
          const rli = document.createElement('li');
          rli.className = `civic-req${req.met ? ' civic-req-met' : ''}`;
          rli.dataset.testid = `civic-req-${row.id}-${i}`;

          const text = document.createElement('span');
          text.className = 'civic-req-text';
          const mark = req.met ? '✔' : '○';
          text.textContent =
            req.kind === 'relationship'
              ? `${mark} ${req.label}`
              : `${mark} ${req.label} — ${req.current}/${req.target}`;
          rli.appendChild(text);

          if (req.contributable && !req.met) {
            const give = document.createElement('button');
            give.type = 'button';
            give.className = 'menu-button civic-give';
            give.textContent = 'Give';
            give.dataset.testid = `civic-give-${row.id}-${i}`;
            give.addEventListener('click', () => opts.onContribute(row.id, i));
            rli.appendChild(give);
          }
          reqList.appendChild(rli);
        });
        li.appendChild(reqList);
      }

      const reward = document.createElement('div');
      reward.className = 'civic-reward';
      reward.textContent = `Reward: ${row.rewardSummary} · Unlocks: ${row.unlocks}`;
      li.appendChild(reward);

      list.appendChild(li);
    }
    panel.appendChild(list);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'menu-button';
    close.textContent = 'Close';
    close.dataset.testid = 'civic-close';
    close.addEventListener('click', opts.onClose);
    panel.appendChild(close);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /**
   * Opening-ceremony panel (Prompt 055). Shown when a civic project completes:
   * the project name, what it unlocks, and a short run of NPC reaction lines.
   */
  showCeremony(opts: CeremonyOptions): void {
    this.clear();
    const panel = this.createPanel(`${opts.projectName} — Restored!`, opts.unlocks);
    panel.classList.add('ceremony-panel');
    panel.dataset.testid = 'ceremony-panel';

    const list = document.createElement('ul');
    list.className = 'ceremony-reactions';
    list.dataset.testid = 'ceremony-reactions';
    for (const reaction of opts.reactions) {
      const li = document.createElement('li');
      li.className = 'ceremony-reaction';
      const who = document.createElement('span');
      who.className = 'ceremony-speaker';
      who.textContent = reaction.speaker;
      const line = document.createElement('span');
      line.className = 'ceremony-line';
      line.textContent = `“${reaction.line}”`;
      li.append(who, line);
      list.appendChild(li);
    }
    panel.appendChild(list);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'menu-button';
    close.textContent = 'Continue';
    close.dataset.testid = 'ceremony-continue';
    close.addEventListener('click', opts.onClose);
    panel.appendChild(close);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /**
   * Festival hub panel (Prompt 056). Shown on a festival day: the festival name,
   * description, hours, and a touch-friendly stack of activity buttons — play the
   * non-sport minigame, visit the special stall, and share the relationship
   * moment. Once-per-year activities show a "done this year" badge when claimed.
   */
  showFestivalPanel(opts: FestivalPanelOptions): void {
    this.clear();
    const subtitle = `${opts.windowLabel}${opts.activeNow ? ' · happening now' : ''}`;
    const panel = this.createPanel(opts.name, subtitle);
    panel.classList.add('festival-panel');
    panel.dataset.testid = 'festival-panel';

    const desc = document.createElement('p');
    desc.className = 'festival-desc';
    desc.textContent = opts.description;
    panel.appendChild(desc);

    const actions = document.createElement('div');
    actions.className = 'festival-actions';

    if (opts.minigame) {
      const card = document.createElement('div');
      card.className = 'festival-card';
      card.dataset.testid = 'festival-minigame-card';
      const heading = document.createElement('div');
      heading.className = 'festival-card-title';
      heading.textContent = opts.minigame.name;
      const meta = document.createElement('div');
      meta.className = 'festival-card-meta';
      const prizeNote = opts.minigame.claimedThisYear ? 'Prize claimed this year' : `Prize: ${opts.minigame.rewardSummary}`;
      meta.textContent = `${opts.minigame.description} · Goal ${opts.minigame.goal} · Best ${opts.minigame.bestScore} · ${prizeNote}`;
      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'menu-button';
      play.textContent = 'Play';
      play.dataset.testid = 'festival-play-minigame';
      play.addEventListener('click', opts.onPlayMinigame);
      card.append(heading, meta, play);
      actions.appendChild(card);
    }

    if (opts.stallName) {
      const card = document.createElement('div');
      card.className = 'festival-card';
      card.dataset.testid = 'festival-stall-card';
      const heading = document.createElement('div');
      heading.className = 'festival-card-title';
      heading.textContent = opts.stallName;
      const visit = document.createElement('button');
      visit.type = 'button';
      visit.className = 'menu-button';
      visit.textContent = 'Visit stall';
      visit.dataset.testid = 'festival-visit-stall';
      visit.addEventListener('click', opts.onVisitStall);
      card.append(heading, visit);
      actions.appendChild(card);
    }

    if (opts.relationship) {
      const card = document.createElement('div');
      card.className = 'festival-card';
      card.dataset.testid = 'festival-relationship-card';
      const heading = document.createElement('div');
      heading.className = 'festival-card-title';
      heading.textContent = `Share the moment with ${opts.relationship.npcName}`;
      const meta = document.createElement('div');
      meta.className = 'festival-card-meta';
      meta.textContent = opts.relationship.claimedThisYear
        ? 'Shared this year'
        : opts.relationship.rewardSummary;
      const share = document.createElement('button');
      share.type = 'button';
      share.className = 'menu-button';
      share.textContent = opts.relationship.claimedThisYear ? 'Already shared' : 'Share';
      share.dataset.testid = 'festival-share-moment';
      share.disabled = opts.relationship.claimedThisYear;
      share.addEventListener('click', opts.onShareMoment);
      card.append(heading, meta, share);
      actions.appendChild(card);
    }

    panel.appendChild(actions);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'menu-button';
    close.textContent = 'Leave the festival';
    close.dataset.testid = 'festival-close';
    close.addEventListener('click', opts.onClose);
    panel.appendChild(close);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /**
   * Festival minigame board (Prompt 056). A row of target slots with the lit one
   * highlighted; tapping the lit slot scores a point. Re-rendered by the scene
   * each tap. On finish it shows a won/lost result with the prize summary +
   * Replay / Back. Deterministic + touch-friendly (full-width slot buttons).
   */
  showFestivalMinigame(opts: FestivalMinigameOptions): void {
    this.clear();
    const panel = this.createPanel(opts.title, `Round ${Math.min(opts.round + 1, opts.rounds)}/${opts.rounds} · Score ${opts.score}/${opts.goal}`);
    panel.classList.add('festival-minigame-panel');
    panel.dataset.testid = 'festival-minigame';

    const status = document.createElement('div');
    status.className = 'festival-minigame-status';
    status.dataset.testid = 'festival-minigame-status';
    status.textContent =
      opts.phase === 'won'
        ? `You won! Score ${opts.score}/${opts.goal}.`
        : opts.phase === 'lost'
          ? `Score ${opts.score}/${opts.goal} — try again next round.`
          : opts.instruction;
    panel.appendChild(status);

    if (opts.phase === 'play') {
      const board = document.createElement('div');
      board.className = 'festival-slots';
      board.dataset.testid = 'festival-slots';
      for (let i = 0; i < opts.slots; i++) {
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = `festival-slot${i === opts.activeSlot ? ' festival-slot-active' : ''}`;
        slot.dataset.testid = `festival-slot-${i}`;
        if (i === opts.activeSlot) slot.dataset.active = '1';
        slot.textContent = i === opts.activeSlot ? `★ ${opts.targetLabel}` : opts.targetLabel;
        slot.addEventListener('click', () => opts.onTap(i));
        board.appendChild(slot);
      }
      panel.appendChild(board);
    } else {
      if (opts.phase === 'won' && opts.resultSummary) {
        const reward = document.createElement('div');
        reward.className = 'festival-minigame-reward';
        reward.dataset.testid = 'festival-minigame-reward';
        reward.textContent = `Prize: ${opts.resultSummary}`;
        panel.appendChild(reward);
      }
      const replay = document.createElement('button');
      replay.type = 'button';
      replay.className = 'menu-button';
      replay.textContent = 'Play again';
      replay.dataset.testid = 'festival-minigame-replay';
      replay.addEventListener('click', opts.onReplay);
      panel.appendChild(replay);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'menu-button menu-button-secondary';
    close.textContent = 'Back';
    close.dataset.testid = 'festival-minigame-close';
    close.addEventListener('click', opts.onClose);
    panel.appendChild(close);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /**
   * Mailbox panel (Prompt 058). A touch-friendly list of delivered letters,
   * unread first, each opening into the letter read view. Letters with unopened
   * attachments show an "unopened" dot.
   */
  showMailboxPanel(opts: MailboxPanelOptions): void {
    this.clear();
    const panel = this.createPanel('Mailbox', opts.summary);
    panel.classList.add('mailbox-panel');
    panel.dataset.testid = 'mailbox-panel';

    if (opts.rows.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'panel-body';
      empty.textContent = 'The mailbox is empty. Letters arrive with the day.';
      panel.appendChild(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'mailbox-list';
      list.dataset.testid = 'mailbox-list';
      for (const row of opts.rows) {
        const li = document.createElement('li');
        li.className = `mailbox-row${row.read ? ' mailbox-row-read' : ''}`;
        li.dataset.testid = `mail-row-${row.id}`;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mailbox-open';
        btn.dataset.testid = `mail-open-${row.id}`;
        const dot = row.read ? '' : '● ';
        const clip = row.hasAttachments && !row.read ? ' 📎' : '';
        btn.textContent = `${dot}${row.sender} — ${row.subject}${clip}`;
        btn.addEventListener('click', () => opts.onOpen(row.id));
        li.appendChild(btn);
        list.appendChild(li);
      }
      panel.appendChild(list);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'menu-button';
    close.textContent = 'Close';
    close.dataset.testid = 'mailbox-close';
    close.addEventListener('click', opts.onClose);
    panel.appendChild(close);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /** Letter read view (Prompt 058): sender + subject + body + what it delivered. */
  showLetterPanel(opts: LetterPanelOptions): void {
    this.clear();
    const panel = this.createPanel(opts.subject, `From ${opts.sender}`);
    panel.classList.add('letter-panel');
    panel.dataset.testid = 'letter-panel';

    const body = document.createElement('p');
    body.className = 'letter-body';
    body.dataset.testid = 'letter-body';
    body.textContent = opts.body;
    panel.appendChild(body);

    if (opts.attachmentSummary) {
      const attach = document.createElement('div');
      attach.className = 'letter-attachment';
      attach.dataset.testid = 'letter-attachment';
      attach.textContent = `📎 Received: ${opts.attachmentSummary}`;
      panel.appendChild(attach);
    }
    if (opts.startsQuest) {
      const quest = document.createElement('div');
      quest.className = 'letter-attachment';
      quest.dataset.testid = 'letter-quest';
      quest.textContent = `🗒 New quest: ${opts.startsQuest}`;
      panel.appendChild(quest);
    }

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'menu-button';
    back.textContent = 'Back to mailbox';
    back.dataset.testid = 'letter-back';
    back.addEventListener('click', opts.onBack);
    panel.appendChild(back);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /**
   * Town notice board (Prompt 058). Three read-only sections: a weather/tide
   * forecast, the "reasons to visit town" (help-wanted + birthdays), and dynamic
   * news that reacts to restoration, festivals, and shipments.
   */
  showNoticeBoardPanel(opts: NoticeBoardPanelOptions): void {
    this.clear();
    const panel = this.createPanel('Town Notice Board', opts.summary);
    panel.classList.add('notice-panel');
    panel.dataset.testid = 'notice-panel';

    const section = (title: string, lines: string[], testid: string): void => {
      const heading = document.createElement('div');
      heading.className = 'notice-heading';
      heading.textContent = title;
      panel.appendChild(heading);
      const ul = document.createElement('ul');
      ul.className = 'notice-list';
      ul.dataset.testid = testid;
      if (lines.length === 0) {
        const li = document.createElement('li');
        li.className = 'notice-row notice-row-empty';
        li.textContent = '—';
        ul.appendChild(li);
      } else {
        for (const line of lines) {
          const li = document.createElement('li');
          li.className = 'notice-row';
          li.textContent = line;
          ul.appendChild(li);
        }
      }
      panel.appendChild(ul);
    };

    section('Forecast', opts.forecast, 'notice-forecast');
    section('Around the Bay', opts.requests, 'notice-requests');
    section('News', opts.news, 'notice-news');

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'menu-button';
    close.textContent = 'Close';
    close.dataset.testid = 'notice-close';
    close.addEventListener('click', opts.onClose);
    panel.appendChild(close);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /**
   * Kitchen / cooking panel (Prompt 059). Active buffs at the top, the cooking
   * recipes the player knows (with the buff each dish grants) to Cook, and a
   * pantry of edible items the player is holding to Eat (restoring stamina +
   * granting the dish's timed buff). Re-rendered by the scene after each action.
   */
  showCookingPanel(opts: CookingPanelOptions): void {
    this.clear();
    const panel = this.createPanel('Kitchen', `${opts.recipes.length} recipe${opts.recipes.length === 1 ? '' : 's'} known`);
    panel.classList.add('cooking-panel');
    panel.dataset.testid = 'cooking-panel';

    if (opts.activeBuffs.length > 0) {
      const buffs = document.createElement('div');
      buffs.className = 'cooking-buffs';
      buffs.dataset.testid = 'cooking-buffs';
      for (const b of opts.activeBuffs) {
        const chip = document.createElement('span');
        chip.className = 'cooking-buff-chip';
        chip.textContent = `${b.label} ${b.magnitudeLabel} · ${b.minutesLeft}m`;
        buffs.appendChild(chip);
      }
      panel.appendChild(buffs);
    }

    const cookHeading = document.createElement('div');
    cookHeading.className = 'cooking-heading';
    cookHeading.textContent = 'Cook';
    panel.appendChild(cookHeading);

    const recipeList = document.createElement('ul');
    recipeList.className = 'cooking-list';
    recipeList.dataset.testid = 'cooking-recipes';
    if (opts.recipes.length === 0) {
      const li = document.createElement('li');
      li.className = 'cooking-row cooking-row-empty';
      li.textContent = 'No cooking recipes known yet — find them through skills, friends, and shops.';
      recipeList.appendChild(li);
    }
    for (const r of opts.recipes) {
      const li = document.createElement('li');
      li.className = 'cooking-row';
      li.dataset.testid = `cooking-recipe-${r.id}`;
      const head = document.createElement('div');
      head.className = 'cooking-row-head';
      const title = document.createElement('span');
      title.className = 'cooking-title';
      title.textContent = `${r.name} → ${r.outputName} ×${r.outputQty}`;
      head.appendChild(title);
      const ing = document.createElement('div');
      ing.className = 'cooking-ingredients';
      ing.textContent = r.ingredients.map((i) => `${i.have}/${i.need} ${i.itemName}`).join(' · ') + (r.buffLabel ? ` · grants ${r.buffLabel}` : '');
      const cook = document.createElement('button');
      cook.type = 'button';
      cook.className = 'menu-button cooking-cook';
      cook.textContent = 'Cook';
      cook.dataset.testid = `cooking-cook-${r.id}`;
      cook.disabled = !r.canCook;
      cook.addEventListener('click', () => opts.onCook(r.id));
      li.append(head, ing, cook);
      recipeList.appendChild(li);
    }
    panel.appendChild(recipeList);

    const eatHeading = document.createElement('div');
    eatHeading.className = 'cooking-heading';
    eatHeading.textContent = 'Pantry';
    panel.appendChild(eatHeading);

    const pantry = document.createElement('ul');
    pantry.className = 'cooking-list';
    pantry.dataset.testid = 'cooking-pantry';
    if (opts.pantry.length === 0) {
      const li = document.createElement('li');
      li.className = 'cooking-row cooking-row-empty';
      li.textContent = 'Nothing to eat on hand. Cook a dish first.';
      pantry.appendChild(li);
    }
    for (const p of opts.pantry) {
      const li = document.createElement('li');
      li.className = 'cooking-row';
      li.dataset.testid = `pantry-row-${p.itemId}`;
      const head = document.createElement('div');
      head.className = 'cooking-row-head';
      const title = document.createElement('span');
      title.className = 'cooking-title';
      title.textContent = `${p.name} ×${p.qty}`;
      head.appendChild(title);
      const eff = document.createElement('div');
      eff.className = 'cooking-ingredients';
      eff.textContent = p.effectLabel;
      const eat = document.createElement('button');
      eat.type = 'button';
      eat.className = 'menu-button cooking-eat';
      eat.textContent = 'Eat';
      eat.dataset.testid = `pantry-eat-${p.itemId}`;
      eat.addEventListener('click', () => opts.onEat(p.itemId));
      li.append(head, eff, eat);
      pantry.appendChild(li);
    }
    panel.appendChild(pantry);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'menu-button';
    close.textContent = 'Close';
    close.dataset.testid = 'cooking-close';
    close.addEventListener('click', opts.onClose);
    panel.appendChild(close);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /**
   * Home / decor / customization panel (Prompt 060). A tabbed panel: Decorate
   * (buy + place furniture, pick up placed pieces), Surfaces (wallpaper +
   * flooring), Renovate (one-time gold upgrades), Wardrobe (change appearance).
   * The hosting scene keeps the active tab and re-renders on every action.
   */
  showHomePanel(opts: HomePanelOptions): void {
    this.clear();
    const panel = this.createPanel('Home', `${opts.gold} g`);
    panel.classList.add('home-panel');
    panel.dataset.testid = 'home-panel';

    // Tab strip.
    const tabs = document.createElement('div');
    tabs.className = 'home-tabs';
    const TAB_LABELS: Array<[HomeTab, string]> = [
      ['decorate', 'Decorate'],
      ['surfaces', 'Surfaces'],
      ['renovate', 'Renovate'],
      ['wardrobe', 'Wardrobe'],
    ];
    for (const [tab, label] of TAB_LABELS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-button home-tab';
      if (tab === opts.activeTab) btn.classList.add('home-tab-active');
      btn.textContent = label;
      btn.dataset.testid = `home-tab-${tab}`;
      btn.addEventListener('click', () => opts.onTab(tab));
      tabs.appendChild(btn);
    }
    panel.appendChild(tabs);

    const body = document.createElement('div');
    body.className = 'home-body';
    body.dataset.testid = 'home-body';
    if (opts.activeTab === 'decorate') this.renderHomeDecorate(body, opts);
    else if (opts.activeTab === 'surfaces') this.renderHomeSurfaces(body, opts);
    else if (opts.activeTab === 'renovate') this.renderHomeRenovate(body, opts);
    else this.renderHomeWardrobe(body, opts);
    panel.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'home-actions';
    const photo = document.createElement('button');
    photo.type = 'button';
    photo.className = 'menu-button';
    photo.textContent = '📷 Photo mode';
    photo.dataset.testid = 'home-photo';
    photo.addEventListener('click', opts.onPhotoMode);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'menu-button';
    close.textContent = 'Close';
    close.dataset.testid = 'home-close';
    close.addEventListener('click', opts.onClose);
    actions.append(photo, close);
    panel.appendChild(actions);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  private renderHomeDecorate(body: HTMLElement, opts: HomePanelOptions): void {
    const buyHeading = document.createElement('div');
    buyHeading.className = 'home-heading';
    buyHeading.textContent = 'Furniture catalog';
    body.appendChild(buyHeading);

    const list = document.createElement('ul');
    list.className = 'home-list';
    list.dataset.testid = 'home-furniture';
    for (const f of opts.furniture) {
      const li = document.createElement('li');
      li.className = 'home-row';
      const info = document.createElement('div');
      info.className = 'home-row-head';
      const title = document.createElement('span');
      title.className = 'home-title';
      title.textContent = `${f.name} — ${f.categoryLabel}`;
      const price = document.createElement('span');
      price.className = 'home-price';
      price.textContent = `${f.price} g`;
      info.append(title, price);
      const place = document.createElement('button');
      place.type = 'button';
      place.className = 'menu-button home-place';
      place.textContent = 'Place';
      place.dataset.testid = `home-place-${f.id}`;
      place.disabled = !f.affordable;
      place.addEventListener('click', () => opts.onPlace(f.id));
      li.append(info, place);
      list.appendChild(li);
    }
    body.appendChild(list);

    const placedHeading = document.createElement('div');
    placedHeading.className = 'home-heading';
    placedHeading.textContent = `Placed (${opts.placed.length})`;
    body.appendChild(placedHeading);
    const placedList = document.createElement('ul');
    placedList.className = 'home-list';
    placedList.dataset.testid = 'home-placed';
    if (opts.placed.length === 0) {
      const li = document.createElement('li');
      li.className = 'home-row home-row-empty';
      li.textContent = 'Nothing placed yet — buy a piece above and set it down.';
      placedList.appendChild(li);
    }
    for (const p of opts.placed) {
      const li = document.createElement('li');
      li.className = 'home-row';
      const title = document.createElement('span');
      title.className = 'home-title';
      title.textContent = p.name;
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'menu-button home-pickup';
      pick.textContent = 'Pick up';
      pick.dataset.testid = `home-pickup-${p.id}`;
      pick.addEventListener('click', () => opts.onPickUp(p.id));
      li.append(title, pick);
      placedList.appendChild(li);
    }
    body.appendChild(placedList);
  }

  private renderHomeSurfaces(body: HTMLElement, opts: HomePanelOptions): void {
    const section = (heading: string, rows: HomeSurfaceRow[], testid: string, onPick: (id: string) => void) => {
      const h = document.createElement('div');
      h.className = 'home-heading';
      h.textContent = heading;
      body.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'home-swatches';
      grid.dataset.testid = testid;
      for (const r of rows) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'menu-button home-swatch';
        if (r.active) btn.classList.add('home-swatch-active');
        btn.textContent = r.active ? `✓ ${r.name}` : r.name;
        btn.dataset.testid = `${testid}-${r.id}`;
        btn.addEventListener('click', () => onPick(r.id));
        grid.appendChild(btn);
      }
      body.appendChild(grid);
    };
    section('Walls', opts.wallpapers, 'home-wallpaper', opts.onWallpaper);
    section('Floor', opts.floorings, 'home-flooring', opts.onFlooring);
  }

  private renderHomeRenovate(body: HTMLElement, opts: HomePanelOptions): void {
    const list = document.createElement('ul');
    list.className = 'home-list';
    list.dataset.testid = 'home-renovations';
    for (const r of opts.renovations) {
      const li = document.createElement('li');
      li.className = 'home-row home-row-tall';
      const head = document.createElement('div');
      head.className = 'home-row-head';
      const title = document.createElement('span');
      title.className = 'home-title';
      title.textContent = r.name;
      const price = document.createElement('span');
      price.className = 'home-price';
      price.textContent = r.owned ? 'Built' : `${r.price} g`;
      head.append(title, price);
      const desc = document.createElement('div');
      desc.className = 'home-desc';
      desc.textContent = r.description;
      const build = document.createElement('button');
      build.type = 'button';
      build.className = 'menu-button';
      build.textContent = r.owned ? 'Built ✓' : 'Build';
      build.dataset.testid = `home-renovate-${r.id}`;
      build.disabled = r.owned || !r.affordable;
      build.addEventListener('click', () => opts.onRenovate(r.id));
      li.append(head, desc, build);
      list.appendChild(li);
    }
    body.appendChild(list);
  }

  private renderHomeWardrobe(body: HTMLElement, opts: HomePanelOptions): void {
    for (const part of opts.wardrobe) {
      const h = document.createElement('div');
      h.className = 'home-heading';
      h.textContent = part.label;
      body.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'home-swatches';
      grid.dataset.testid = `home-wardrobe-${part.part}`;
      for (const s of part.swatches) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'menu-button home-swatch';
        if (s.active) btn.classList.add('home-swatch-active');
        btn.textContent = s.active ? `✓ ${s.name}` : s.name;
        btn.dataset.testid = `home-swatch-${part.part}-${s.id}`;
        btn.addEventListener('click', () => opts.onSwatch(part.part, s.id));
        grid.appendChild(btn);
      }
      body.appendChild(grid);
    }
  }

  /**
   * Placement HUD (Prompt 060). Shown while a furniture piece is being placed:
   * the ghost follows the pointer; these controls rotate / commit / cancel.
   */
  showPlacementBar(opts: PlacementBarOptions): void {
    this.clear();
    const bar = document.createElement('div');
    bar.className = 'hud-bar placement-bar';
    bar.dataset.testid = 'placement-bar';

    const info = document.createElement('div');
    info.className = 'hud-info';
    const heading = document.createElement('div');
    heading.className = 'hud-title';
    heading.textContent = `Placing ${opts.label}`;
    const hint = document.createElement('div');
    hint.className = 'hud-status';
    hint.textContent = 'Tap the floor to position · then Place';
    info.append(heading, hint);

    const controls = document.createElement('div');
    controls.className = 'placement-controls';
    const rotate = document.createElement('button');
    rotate.type = 'button';
    rotate.className = 'menu-button';
    rotate.textContent = '⟳ Rotate';
    rotate.dataset.testid = 'placement-rotate';
    rotate.addEventListener('click', opts.onRotate);
    const place = document.createElement('button');
    place.type = 'button';
    place.className = 'menu-button';
    place.textContent = 'Place';
    place.dataset.testid = 'placement-confirm';
    place.addEventListener('click', opts.onPlace);
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'menu-button';
    cancel.textContent = 'Cancel';
    cancel.dataset.testid = 'placement-cancel';
    cancel.addEventListener('click', opts.onCancel);
    controls.append(rotate, place, cancel);

    bar.append(info, controls);
    this.root.appendChild(bar);
  }

  /**
   * Photo mode bar (Prompt 060). The HUD/panels are hidden for a clean shot;
   * only this minimal Capture / Exit strip remains.
   */
  showPhotoModeBar(opts: PhotoModeBarOptions): void {
    this.clear();
    const bar = document.createElement('div');
    bar.className = 'hud-bar photo-bar';
    bar.dataset.testid = 'photo-bar';

    const info = document.createElement('div');
    info.className = 'hud-info';
    const heading = document.createElement('div');
    heading.className = 'hud-title';
    heading.textContent = '📷 Photo mode';
    const note = document.createElement('div');
    note.className = 'hud-status';
    note.dataset.testid = 'photo-note';
    note.textContent = opts.note;
    info.append(heading, note);

    const controls = document.createElement('div');
    controls.className = 'placement-controls';
    const capture = document.createElement('button');
    capture.type = 'button';
    capture.className = 'menu-button';
    capture.textContent = 'Capture';
    capture.dataset.testid = 'photo-capture';
    capture.addEventListener('click', opts.onCapture);
    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'menu-button';
    exit.textContent = 'Exit';
    exit.dataset.testid = 'photo-exit';
    exit.addEventListener('click', opts.onExit);
    controls.append(capture, exit);

    bar.append(info, controls);
    this.root.appendChild(bar);
  }

  /**
   * Elevator panel (Prompt 025). A checkpoint list; player picks one and
   * the scene fast-travels to that level.
   */
  showElevatorPanel(opts: ElevatorPanelOptions): void {
    this.clear();
    const panel = this.createPanel('Elevator');
    panel.classList.add('elevator-panel');
    panel.dataset.testid = 'elevator-panel';

    const list = document.createElement('ul');
    list.className = 'elevator-list';
    for (const opt of opts.options) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-button';
      btn.textContent = `L${opt.level} — ${opt.name}${opt.isCurrent ? ' (here)' : ''}`;
      btn.dataset.testid = `elevator-jump-${opt.level}`;
      btn.disabled = opt.isCurrent;
      btn.addEventListener('click', () => opts.onSelect(opt.level));
      li.appendChild(btn);
      list.appendChild(li);
    }
    panel.appendChild(list);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'menu-button';
    close.textContent = 'Close';
    close.dataset.testid = 'elevator-close';
    close.addEventListener('click', opts.onClose);
    panel.appendChild(close);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /**
   * Reef panel (Prompt 022). Snorkeling readout: tide access status,
   * oxygen meter, reef-health restoration bar, and harvest / surface /
   * donate / close actions.
   */
  showReefPanel(opts: ReefPanelOptions): void {
    this.clear();
    const accessLabel = opts.access === 'open' ? 'Low tide — reef open' : opts.access === 'wading' ? 'Falling tide — wading' : 'High tide — reef closed';
    const panel = this.createPanel('Reef', accessLabel);
    panel.classList.add('reef-panel');
    panel.dataset.testid = 'reef-panel';

    const oxygen = document.createElement('div');
    oxygen.className = 'reef-oxygen';
    oxygen.dataset.testid = 'reef-oxygen';
    const oxygenFill = document.createElement('div');
    oxygenFill.className = 'reef-oxygen-fill';
    oxygenFill.style.width = `${Math.round(opts.oxygen * 100)}%`;
    if (opts.oxygenWarning) oxygenFill.classList.add('reef-oxygen-warning');
    oxygen.appendChild(oxygenFill);
    panel.appendChild(oxygen);
    const oxLabel = document.createElement('div');
    oxLabel.className = 'reef-meta';
    oxLabel.textContent = `Oxygen ${Math.round(opts.oxygen * 100)}%${opts.oxygenWarning ? ' — surface soon!' : ''}`;
    panel.appendChild(oxLabel);

    const health = document.createElement('div');
    health.className = 'reef-health';
    const healthFill = document.createElement('div');
    healthFill.className = 'reef-health-fill';
    healthFill.style.width = `${Math.round(opts.reefHealth * 100)}%`;
    healthFill.dataset.testid = 'reef-health';
    health.appendChild(healthFill);
    panel.appendChild(health);
    const healthMeta = document.createElement('div');
    healthMeta.className = 'reef-meta';
    healthMeta.textContent = `Reef tier ${opts.reefTier} / 4 — ${opts.fragmentsToNextTier} fragment${opts.fragmentsToNextTier === 1 ? '' : 's'} to next restoration`;
    panel.appendChild(healthMeta);

    if (opts.lastEncounter) {
      const enc = document.createElement('div');
      enc.className = 'reef-encounter';
      enc.dataset.testid = 'reef-encounter';
      enc.textContent = opts.lastEncounter;
      panel.appendChild(enc);
    }

    const actions = document.createElement('div');
    actions.className = 'reef-actions';
    const harvest = document.createElement('button');
    harvest.type = 'button';
    harvest.className = 'menu-button';
    harvest.textContent = 'Harvest';
    harvest.dataset.testid = 'reef-harvest';
    harvest.disabled = opts.access === 'closed';
    harvest.addEventListener('click', opts.onHarvest);
    actions.appendChild(harvest);
    const surface = document.createElement('button');
    surface.type = 'button';
    surface.className = 'menu-button menu-button-secondary';
    surface.textContent = 'Surface';
    surface.dataset.testid = 'reef-surface';
    surface.addEventListener('click', opts.onSurface);
    actions.appendChild(surface);
    const donate = document.createElement('button');
    donate.type = 'button';
    donate.className = 'menu-button menu-button-secondary';
    donate.textContent = `Donate ${opts.fragmentsOnHand} fragment${opts.fragmentsOnHand === 1 ? '' : 's'}`;
    donate.dataset.testid = 'reef-donate';
    donate.disabled = opts.fragmentsOnHand === 0 || opts.reefTier >= 4;
    donate.addEventListener('click', opts.onDonate);
    actions.appendChild(donate);
    panel.appendChild(actions);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'menu-button';
    close.textContent = 'Close';
    close.dataset.testid = 'reef-close';
    close.addEventListener('click', opts.onClose);
    panel.appendChild(close);

    this.root.appendChild(panel);
    this.focusFirstEnabled(panel);
  }

  /**
   * Fishing panel (Prompt 021). Cast / Wait / Reel / Catch flow rendered
   * as a single panel; the minigame bar is rendered as inline divs.
   * The panel emits intent through three callbacks (cast, drop pot,
   * toggle assist) and is re-rendered by the scene each tick.
   */
  showFishingPanel(opts: FishingPanelOptions): void {
    this.clear();
    const panel = this.createPanel('Fishing', `Bait: ${opts.baitCount} · ${opts.assist ? 'Assist on' : 'Assist off'}`);
    panel.classList.add('fishing-panel');
    panel.dataset.testid = 'fishing-panel';

    const status = document.createElement('div');
    status.className = 'fishing-status';
    status.dataset.testid = 'fishing-status';
    const labels: Record<FishingPanelOptions['phase'], string> = {
      cast: 'Cast your line.',
      waiting: 'Waiting for a bite…',
      reel: 'Reel! Keep the cursor on the fish.',
      caught: `Landed: ${opts.lastCatchLabel ?? 'something'}`,
      lost: 'Line slipped — they got away.',
    };
    status.textContent = labels[opts.phase];
    panel.appendChild(status);

    if (opts.phase === 'reel' && opts.minigame) {
      const bar = document.createElement('div');
      bar.className = 'fishing-bar';
      bar.dataset.testid = 'fishing-bar';
      const fish = document.createElement('div');
      fish.className = 'fishing-fish';
      fish.style.left = `${opts.minigame.fishPos * 100}%`;
      const cursor = document.createElement('div');
      cursor.className = 'fishing-cursor';
      cursor.style.left = `${(opts.minigame.cursorPos - opts.minigame.cursorWidth / 2) * 100}%`;
      cursor.style.width = `${opts.minigame.cursorWidth * 100}%`;
      bar.append(cursor, fish);
      panel.appendChild(bar);

      const progress = document.createElement('div');
      progress.className = 'fishing-progress';
      const fill = document.createElement('div');
      fill.className = 'fishing-progress-fill';
      fill.dataset.testid = 'fishing-progress';
      fill.style.width = `${opts.minigame.progress * 100}%`;
      progress.appendChild(fill);
      panel.appendChild(progress);

      const hint = document.createElement('div');
      hint.className = 'fishing-hint';
      hint.textContent = 'Hold SPACE / tap REEL to pull up. Release to drift down.';
      panel.appendChild(hint);
    }

    const actions = document.createElement('div');
    actions.className = 'fishing-actions';

    if (opts.phase === 'cast' || opts.phase === 'caught' || opts.phase === 'lost') {
      const cast = document.createElement('button');
      cast.type = 'button';
      cast.className = 'menu-button';
      cast.textContent = opts.baitCount > 0 ? 'Cast (uses 1 bait)' : 'Cast (no bait)';
      cast.dataset.testid = 'fishing-cast';
      cast.addEventListener('click', () => opts.onCast(opts.baitCount > 0));
      actions.appendChild(cast);

      const pot = document.createElement('button');
      pot.type = 'button';
      pot.className = 'menu-button menu-button-secondary';
      pot.textContent = 'Drop crab pot';
      pot.dataset.testid = 'fishing-drop-pot';
      pot.addEventListener('click', opts.onDropPot);
      actions.appendChild(pot);
    } else if (opts.phase === 'reel') {
      const reel = document.createElement('button');
      reel.type = 'button';
      reel.className = 'menu-button fishing-reel';
      reel.textContent = 'REEL (hold)';
      reel.dataset.testid = 'fishing-reel';
      panel.dataset.reel = '1';
      actions.appendChild(reel);
    }

    const assist = document.createElement('button');
    assist.type = 'button';
    assist.className = 'menu-button menu-button-secondary';
    assist.textContent = opts.assist ? 'Assist: on' : 'Assist: off';
    assist.dataset.testid = 'fishing-assist';
    assist.addEventListener('click', opts.onToggleAssist);
    actions.appendChild(assist);

    panel.appendChild(actions);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'menu-button';
    close.textContent = 'Close';
    close.dataset.testid = 'fishing-close';
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
