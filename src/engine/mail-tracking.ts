import { loadGameContent } from '../data/content';
import { getActiveSave, persistActiveSave } from './gameState';
import { completedProjectFlags } from './civic';
import { grantRewards, summarizeRewards, type RewardNameResolvers } from './rewards';
import { acceptActiveQuest } from './quest-tracking';
import {
  deliverMail,
  mailboxRows,
  markMailRead,
  mailStateFor,
  unreadCount,
  type MailContext,
  type MailboxRow,
} from './mail';
import type { SaveData } from './saveModel';

/**
 * Runtime glue between the scenes and the pure mail engine (`mail.ts`). Reads /
 * mutates the active save, grants attachment rewards through the shared granter,
 * starts a mail-delivered quest, and persists.
 */

function mailNames(): RewardNameResolvers {
  const content = loadGameContent();
  const items = new Map(content.items.map((i) => [i.id, i.name] as const));
  const npcs = new Map(content.npcs.map((n) => [n.id, n.name] as const));
  const recipes = new Map(content.recipes.map((r) => [r.id, r.name] as const));
  return {
    item: (id) => items.get(id) ?? id,
    npc: (id) => npcs.get(id) ?? id,
    recipe: (id) => recipes.get(id) ?? id,
  };
}

export function mailContextFor(save: SaveData): MailContext {
  const civic = new Set(completedProjectFlags(save.projects));
  return {
    year: save.calendar.year,
    season: save.calendar.season,
    day: save.calendar.day,
    isFirstVisit: !save.flags['mailbox-seeded'],
    hasFlag: (flag) => Boolean(save.flags[flag]) || civic.has(flag),
  };
}

/** Deliver every due letter to the active save's mailbox; returns the ids delivered now. */
export function deliverActiveMail(): string[] {
  const save = getActiveSave();
  if (!save) return [];
  const letters = loadGameContent().mail;
  const { record, deliveredIds } = deliverMail(letters, save.mail, mailContextFor(save));
  save.mail = record;
  save.flags['mailbox-seeded'] = true;
  persistActiveSave();
  return deliveredIds;
}

export function activeUnreadMailCount(): number {
  const save = getActiveSave();
  if (!save) return 0;
  return unreadCount(loadGameContent().mail, save.mail);
}

export interface ReadMailResult {
  read: boolean;
  attachmentSummary: string;
  startedQuestId: string | null;
}

/**
 * Read a delivered letter: marks it read, grants its attachments (once), and
 * starts its quest if any. Re-reading grants nothing.
 */
export function readActiveMail(id: string): ReadMailResult {
  const save = getActiveSave();
  if (!save) return { read: false, attachmentSummary: '', startedQuestId: null };
  const letter = loadGameContent().mail.find((m) => m.id === id);
  if (!letter) return { read: false, attachmentSummary: '', startedQuestId: null };
  const state = mailStateFor(save.mail, id);
  if (!state.delivered || state.read) return { read: false, attachmentSummary: '', startedQuestId: null };

  save.mail = markMailRead(save.mail, id);
  if (letter.attachments.length > 0) grantRewards(save, letter.attachments);
  persistActiveSave();

  let startedQuestId: string | null = null;
  if (letter.startsQuestId) {
    acceptActiveQuest(letter.startsQuestId); // persists internally
    startedQuestId = letter.startsQuestId;
  }
  return {
    read: true,
    attachmentSummary: letter.attachments.length > 0 ? summarizeRewards(letter.attachments, mailNames()) : '',
    startedQuestId,
  };
}

export function activeMailboxRows(): MailboxRow[] {
  const save = getActiveSave();
  if (!save) return [];
  const content = loadGameContent();
  const questNames = new Map(content.quests.map((q) => [q.id, q.name] as const));
  return mailboxRows(content.mail, save.mail, mailNames(), (id) => questNames.get(id) ?? id);
}
