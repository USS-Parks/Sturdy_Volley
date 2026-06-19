import { describe, it, expect, beforeEach } from 'vitest';
import { UIOverlay, tooltipLines } from '../../src/ui/overlay';
import { buildTitleMenu } from '../../src/ui/menuModel';
import { addItem, createContainer } from '../../src/engine/inventory';
import { buildItemCatalog } from '../../src/engine/itemCatalog';
import type { Item, Npc } from '../../src/data/schemas';

const ITEMS: Item[] = [
  { id: 'bell-peas', name: 'Bell Peas', description: 'Sweet pods.', category: 'crop', sellPrice: 24, stackable: true, tags: ['spring'] },
  { id: 'driftwood', name: 'Driftwood', description: 'Storm wood.', category: 'material', sellPrice: 5, stackable: true, tags: ['material'] },
];
const NPCS: Npc[] = [
  {
    id: 'mara',
    name: 'Mara',
    role: 'r',
    description: 'd',
    birthday: { season: 'summer', day: 14 },
    lovedGiftItemIds: ['bell-peas'],
    romanceable: true,
  },
];
const CATALOG = buildItemCatalog(ITEMS, NPCS);

// jsdom ships neither DataTransfer nor DragEvent. Stub a string-payload
// dataTransfer and fire plain Events with that stamped on — enough to exercise
// the overlay's drag/drop wiring (it only uses getData/setData/dataTransfer).
interface DragLike {
  getData(type: string): string;
  setData(type: string, value: string): void;
}

function makeDataTransfer(): DragLike {
  const data = new Map<string, string>();
  return {
    getData: (t) => data.get(t) ?? '',
    setData: (t, v) => {
      data.set(t, v);
    },
  };
}

function fireDrag(target: Element, type: 'dragstart' | 'drop', dt: DragLike): void {
  const evt = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(evt, 'dataTransfer', { value: dt });
  target.dispatchEvent(evt);
}

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

  it('tooltipLines lists name, source, sell, quality, and loved-by NPCs', () => {
    const lines = tooltipLines(
      { itemId: 'bell-peas', qty: 4, quality: 2 },
      ITEMS[0]!,
      [NPCS[0]!],
    );
    expect(lines[0]).toBe('Bell Peas');
    expect(lines).toContain('Source: crop');
    expect(lines.find((l) => l.startsWith('Tags:'))).toBe('Tags: spring');
    // quality 2 = 1.5× of 24 = 36 each, ×4 = 144 total.
    expect(lines.find((l) => l.startsWith('Sell:'))).toBe('Sell: 36 g each (144 g for 4)');
    expect(lines.find((l) => l.startsWith('Quality:'))).toBe('Quality: Gold');
    expect(lines.find((l) => l.startsWith('Loved by:'))).toBe('Loved by: Mara');
  });

  it('showHotbar renders one button per slot with the active highlight', () => {
    const overlay = new UIOverlay();
    let c = createContainer(8);
    c = addItem(c, 'bell-peas', 5).container;
    overlay.showHotbar({ slots: c.slots, selectedIndex: 0, catalog: CATALOG, onSelect: () => {} });
    expect(document.querySelectorAll('.hotbar-slot')).toHaveLength(8);
    const active = document.querySelector('.hotbar-slot-active');
    expect(active).toBeTruthy();
    expect(active?.querySelector('.hotbar-item')?.textContent).toBe('Bell Peas');
    expect(active?.querySelector('.hotbar-qty')?.textContent).toBe('×5');
  });

  it('showHotbar invokes onSelect with the slot index', () => {
    const overlay = new UIOverlay();
    const picked: number[] = [];
    overlay.showHotbar({
      slots: createContainer(8).slots,
      selectedIndex: 0,
      catalog: CATALOG,
      onSelect: (i) => picked.push(i),
    });
    document.querySelector<HTMLButtonElement>('[data-testid="hotbar-slot-3"]')?.click();
    expect(picked).toEqual([3]);
  });

  it('showInventory renders both grids and a trash slot', () => {
    const overlay = new UIOverlay();
    let player = createContainer(24);
    player = addItem(player, 'bell-peas', 4).container;
    let partner = createContainer(16);
    partner = addItem(partner, 'driftwood', 3).container;

    overlay.showInventory({
      title: 'Inventory',
      player,
      hotbarSize: 8,
      partner: { id: 'porch-chest', title: 'Porch Chest', container: partner },
      catalog: CATALOG,
      onMove: () => {},
      onClose: () => {},
    });
    expect(document.querySelector('[data-testid="inventory-panel"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="inventory-player"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="inventory-partner-porch-chest"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="inventory-trash"]')).toBeTruthy();
    const first = document.querySelector('[data-testid="slot-player-0"]');
    expect(first?.textContent).toContain('Bell Peas');
    expect(first?.textContent).toContain('×4');
  });

  it('showInventory drag-drop produces a SlotMove between containers', () => {
    const overlay = new UIOverlay();
    let player = createContainer(24);
    player = addItem(player, 'bell-peas', 4).container;
    const partner = createContainer(8);
    const moves: unknown[] = [];

    overlay.showInventory({
      title: 'Inventory',
      player,
      hotbarSize: 8,
      partner: { id: 'shipping-bin', title: 'Shipping Bin', container: partner },
      catalog: CATALOG,
      onMove: (m) => moves.push(m),
      onClose: () => {},
    });

    const from = document.querySelector<HTMLDivElement>('[data-testid="slot-player-0"]')!;
    const to = document.querySelector<HTMLDivElement>('[data-testid="slot-partner-0"]')!;
    const dt = makeDataTransfer();
    fireDrag(from, 'dragstart', dt);
    fireDrag(to, 'drop', dt);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toEqual({
      fromContainer: 'player',
      fromIndex: 0,
      toContainer: 'partner',
      toIndex: 0,
    });
  });

  it('showInventory trash drop produces a trash SlotMove', () => {
    const overlay = new UIOverlay();
    let player = createContainer(24);
    player = addItem(player, 'bell-peas', 1).container;
    const moves: unknown[] = [];
    overlay.showInventory({
      title: 'Inventory',
      player,
      hotbarSize: 8,
      catalog: CATALOG,
      onMove: (m) => moves.push(m),
      onClose: () => {},
    });
    const dt = makeDataTransfer();
    const from = document.querySelector<HTMLDivElement>('[data-testid="slot-player-0"]')!;
    fireDrag(from, 'dragstart', dt);
    const trash = document.querySelector<HTMLButtonElement>('[data-testid="inventory-trash"]')!;
    fireDrag(trash, 'drop', dt);
    expect(moves[0]).toEqual({
      fromContainer: 'player',
      fromIndex: 0,
      toContainer: 'trash',
      toIndex: null,
    });
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
