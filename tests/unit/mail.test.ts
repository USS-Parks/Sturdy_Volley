import { describe, it, expect } from 'vitest';
import { mailSchema, type Mail } from '../../src/data/schemas';
import { loadGameContent } from '../../src/data/content';
import { createNewSave } from '../../src/engine/saveModel';
import { grantRewards } from '../../src/engine/rewards';
import {
  deliverMail,
  mailboxRows,
  markMailRead,
  mailStateFor,
  unreadCount,
  type MailContext,
} from '../../src/engine/mail';

function letter(partial: Record<string, unknown>): Mail {
  return mailSchema.parse(partial);
}

const ctx = (over: Partial<MailContext> = {}): MailContext => ({
  year: 1,
  season: 'spring',
  day: 5,
  isFirstVisit: false,
  hasFlag: () => false,
  ...over,
});

const WELCOME = letter({
  id: 'welcome',
  sender: 'Aunt Nessa',
  subject: 'Welcome',
  body: 'hello',
  trigger: { kind: 'arrival' },
  attachments: [{ kind: 'item', itemId: 'bell-pea-seeds', qty: 3 }],
});
const DATED = letter({
  id: 'dated',
  sender: 'Town',
  subject: 'Spring note',
  body: 'note',
  trigger: { kind: 'date', season: 'spring', day: 5, recurring: false },
  attachments: [{ kind: 'gold', amount: 50 }],
});
const RECURRING = letter({
  id: 'recurring',
  sender: 'Co-op',
  subject: 'Seeds',
  body: 'seeds',
  trigger: { kind: 'date', season: 'spring', day: 1, recurring: true },
});
const FLAGGED = letter({
  id: 'flagged',
  sender: 'Mara',
  subject: 'Beacon',
  body: 'lit',
  trigger: { kind: 'flag', flag: 'civic:netlight-beacon' },
  attachments: [{ kind: 'gold', amount: 200 }],
});

const LETTERS = [WELCOME, DATED, RECURRING, FLAGGED];

describe('mail delivery', () => {
  it('delivers an arrival letter only on the first visit', () => {
    const off = deliverMail(LETTERS, {}, ctx({ isFirstVisit: false, day: 9 }));
    expect(off.deliveredIds).not.toContain('welcome');
    const on = deliverMail(LETTERS, {}, ctx({ isFirstVisit: true, day: 9 }));
    expect(on.deliveredIds).toContain('welcome');
    expect(on.record['welcome']).toEqual({ delivered: true, deliveredYear: 1, read: false });
  });

  it('delivers a dated letter on its day and not before', () => {
    expect(deliverMail(LETTERS, {}, ctx({ day: 4 })).deliveredIds).not.toContain('dated');
    expect(deliverMail(LETTERS, {}, ctx({ day: 5 })).deliveredIds).toContain('dated');
  });

  it('delivers a flag letter once the flag is set', () => {
    expect(deliverMail(LETTERS, {}, ctx({ day: 9 })).deliveredIds).not.toContain('flagged');
    const fired = deliverMail(LETTERS, {}, ctx({ day: 9, hasFlag: (f) => f === 'civic:netlight-beacon' }));
    expect(fired.deliveredIds).toContain('flagged');
  });

  it('does not re-deliver a non-recurring letter', () => {
    const first = deliverMail(LETTERS, {}, ctx({ day: 5 }));
    const second = deliverMail(LETTERS, first.record, ctx({ day: 5 }));
    expect(second.deliveredIds).not.toContain('dated');
  });

  it('re-delivers a recurring date letter once per year', () => {
    const y1 = deliverMail(LETTERS, {}, ctx({ day: 1 }));
    expect(y1.deliveredIds).toContain('recurring');
    // Same year: no re-delivery.
    expect(deliverMail(LETTERS, y1.record, ctx({ day: 1 })).deliveredIds).not.toContain('recurring');
    // Next year: re-delivered + reset to unread.
    const y2 = deliverMail(LETTERS, y1.record, ctx({ day: 1, year: 2 }));
    expect(y2.deliveredIds).toContain('recurring');
    expect(y2.record['recurring']).toEqual({ delivered: true, deliveredYear: 2, read: false });
  });
});

describe('reading + selectors', () => {
  it('markMailRead flips read once; unreadCount tracks it', () => {
    const { record } = deliverMail(LETTERS, {}, ctx({ isFirstVisit: true, day: 5 }));
    expect(unreadCount(LETTERS, record)).toBe(2); // welcome + dated
    const read = markMailRead(record, 'welcome');
    expect(mailStateFor(read, 'welcome').read).toBe(true);
    expect(unreadCount(LETTERS, read)).toBe(1);
    // Reading again is a no-op.
    expect(markMailRead(read, 'welcome')).toBe(read);
  });

  it('mailboxRows lists delivered letters unread-first with an attachment summary', () => {
    const { record } = deliverMail(LETTERS, {}, ctx({ isFirstVisit: true, day: 5 }));
    const afterRead = markMailRead(record, 'welcome');
    const rows = mailboxRows(LETTERS, afterRead, { item: (id) => (id === 'bell-pea-seeds' ? 'Bell Pea Seeds' : id) });
    // Two delivered (welcome read, dated unread); unread first.
    expect(rows.map((r) => r.id)).toEqual(['dated', 'welcome']);
    expect(rows.find((r) => r.id === 'welcome')!.attachmentSummary).toContain('Bell Pea Seeds');
    expect(rows.find((r) => r.id === 'dated')!.read).toBe(false);
  });

  it('the granted attachments actually land on a save', () => {
    const save = createNewSave({ name: 'Wren', farmName: 'Saltbreak' }, 1000);
    const before = save.wallet.gold;
    grantRewards(save, FLAGGED.attachments);
    expect(save.wallet.gold).toBe(before + 200);
  });
});

describe('content acceptance — mail (Prompt 058)', () => {
  const mail = loadGameContent().mail;

  it('ships letters covering items, recipes, quests, and story flags', () => {
    expect(mail.length).toBeGreaterThanOrEqual(4);
    const kinds = new Set(mail.flatMap((m) => m.attachments.map((a) => a.kind)));
    expect(kinds.has('item')).toBe(true);
    expect(kinds.has('recipe')).toBe(true);
    expect(kinds.has('flag')).toBe(true); // story
    expect(mail.some((m) => m.startsQuestId !== null)).toBe(true); // quests
  });

  it('covers every trigger kind', () => {
    const triggers = new Set(mail.map((m) => m.trigger.kind));
    expect(triggers.has('arrival')).toBe(true);
    expect(triggers.has('date')).toBe(true);
    expect(triggers.has('flag')).toBe(true);
  });

  it('includes a restoration progress note and a lost-and-found return', () => {
    expect(mail.some((m) => m.trigger.kind === 'flag' && m.trigger.flag.startsWith('civic:'))).toBe(true);
    expect(mail.some((m) => m.id.includes('lost-and-found'))).toBe(true);
  });
});
