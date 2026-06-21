import type { Mail, MailTrigger, QuestReward, Season } from '../data/schemas';
import type { MailRecord, MailState } from './saveModel';
import { summarizeRewards, type RewardNameResolvers } from './rewards';

/**
 * Mail engine (Prompt 058). Pure + deterministic over the letter definitions
 * (`content.mail`) and the per-save mail record (`save.mail`). A letter is
 * delivered to the farm mailbox when its trigger fires, then read once; reading
 * grants its attachments and can start a quest. Nothing here touches the DOM,
 * renderer, globals, or clock.
 *
 * Triggers:
 *   - `arrival`   — delivered on the player's first farm visit.
 *   - `date`      — delivered on a calendar day; `recurring` re-delivers yearly.
 *   - `flag`      — delivered when a save flag or `civic:<id>` completion flag is
 *                   set (restoration progress notes + lost-and-found returns).
 */

export interface MailContext {
  year: number;
  season: Season;
  day: number;
  isFirstVisit: boolean;
  hasFlag: (flag: string) => boolean;
}

export function emptyMailState(): MailState {
  return { delivered: false, deliveredYear: null, read: false };
}

export function mailStateFor(record: MailRecord, id: string): MailState {
  return record[id] ?? emptyMailState();
}

function triggerFires(trigger: MailTrigger, ctx: MailContext): boolean {
  switch (trigger.kind) {
    case 'arrival':
      return ctx.isFirstVisit;
    case 'date':
      return trigger.season === ctx.season && trigger.day === ctx.day;
    case 'flag':
      return ctx.hasFlag(trigger.flag);
  }
}

/** True when a letter should be (re-)delivered now and isn't already in the box for this cycle. */
function shouldDeliver(letter: Mail, state: MailState, ctx: MailContext): boolean {
  if (!triggerFires(letter.trigger, ctx)) return false;
  if (!state.delivered) return true;
  // A recurring date letter re-delivers once per year.
  if (letter.trigger.kind === 'date' && letter.trigger.recurring) {
    return state.deliveredYear !== ctx.year;
  }
  return false;
}

export interface DeliverMailResult {
  record: MailRecord;
  /** Ids delivered by this pass (for a "new mail" notice). */
  deliveredIds: string[];
}

/**
 * Deliver every letter whose trigger fires and that isn't already in the box
 * (recurring date letters re-deliver once per year). A re-delivered letter is
 * marked unread again so the player sees it.
 */
export function deliverMail(
  letters: readonly Mail[],
  record: MailRecord,
  ctx: MailContext,
): DeliverMailResult {
  const next: MailRecord = { ...record };
  const deliveredIds: string[] = [];
  for (const letter of letters) {
    const state = mailStateFor(record, letter.id);
    if (shouldDeliver(letter, state, ctx)) {
      next[letter.id] = { delivered: true, deliveredYear: ctx.year, read: false };
      deliveredIds.push(letter.id);
    }
  }
  return { record: next, deliveredIds };
}

/** Mark a delivered letter read (idempotent). */
export function markMailRead(record: MailRecord, id: string): MailRecord {
  const state = mailStateFor(record, id);
  if (!state.delivered || state.read) return record;
  return { ...record, [id]: { ...state, read: true } };
}

/** Count of delivered-but-unread letters. */
export function unreadCount(letters: readonly Mail[], record: MailRecord): number {
  return letters.reduce((n, l) => {
    const s = record[l.id];
    return n + (s?.delivered && !s.read ? 1 : 0);
  }, 0);
}

/* Selectors for the UI ----------------------------------------------- */

export interface MailboxRow {
  id: string;
  sender: string;
  senderNpcId: string | null;
  subject: string;
  body: string;
  read: boolean;
  /** Summary of what reading the letter grants ("3× Bell Pea Seeds · Town progress"). */
  attachmentSummary: string;
  /** Display name of the quest the letter starts, if any. */
  startsQuest: string | null;
  hasAttachments: boolean;
}

export function attachmentSummary(attachments: readonly QuestReward[], names: RewardNameResolvers = {}): string {
  return attachments.length > 0 ? summarizeRewards(attachments, names) : '';
}

/** Delivered letters as display rows, unread first, then by sender. */
export function mailboxRows(
  letters: readonly Mail[],
  record: MailRecord,
  names: RewardNameResolvers = {},
  questName: (id: string) => string = (id) => id,
): MailboxRow[] {
  const rows: MailboxRow[] = [];
  for (const letter of letters) {
    const state = record[letter.id];
    if (!state?.delivered) continue;
    rows.push({
      id: letter.id,
      sender: letter.sender,
      senderNpcId: letter.senderNpcId,
      subject: letter.subject,
      body: letter.body,
      read: state.read,
      attachmentSummary: attachmentSummary(letter.attachments, names),
      startsQuest: letter.startsQuestId ? questName(letter.startsQuestId) : null,
      hasAttachments: letter.attachments.length > 0 || letter.startsQuestId !== null,
    });
  }
  rows.sort((a, b) => Number(a.read) - Number(b.read) || a.sender.localeCompare(b.sender));
  return rows;
}
