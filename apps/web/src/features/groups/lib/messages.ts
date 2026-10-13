/** The message list of a group, kept pure so it is tested in messages.test.ts. */
import type { GroupDetail, GroupMessage, Member, MessageLog } from "../types/groups";

/**
 * Each id once, oldest first. A message can come twice: the POST answer and its own message.created event, or a live
 * event and the catch-up after a reconnection. The last copy wins.
 */
export function mergeMessages(current: GroupMessage[], incoming: GroupMessage[]): GroupMessage[] {
  const byId = new Map<number, GroupMessage>();
  for (const m of current) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return Array.from(byId.values()).sort((a, b) => a.id - b.id);
}

/** The latest page. A full page means older messages may still exist. */
export const firstPage = (page: GroupMessage[], pageSize: number): MessageLog => ({
  messages: mergeMessages([], page),
  hasOlder: page.length >= pageSize,
});

/** A page loaded by scrolling up: fewer than a full page means nothing older is left. */
export const addOlder = (log: MessageLog, page: GroupMessage[], pageSize: number): MessageLog => ({
  messages: mergeMessages(log.messages, page),
  hasOlder: page.length >= pageSize,
});

/** New messages (sent, received live or caught up): the older pages do not change. */
export const addNewer = (log: MessageLog, incoming: GroupMessage[]): MessageLog => ({
  ...log,
  messages: mergeMessages(log.messages, incoming),
});

/** message.hidden: reported by 3 members, gone for the whole group. */
export const hideMessage = (log: MessageLog, id: number): MessageLog => ({
  ...log,
  messages: log.messages.filter((m) => m.id !== id),
});

/** member.left / member.joined: their messages say "former member", or not any more. */
export const markAuthor = (log: MessageLog, memberId: number, left: boolean): MessageLog => ({
  ...log,
  messages: log.messages.map((m) => (m.author.id === memberId ? { ...m, authorLeft: left } : m)),
});

/** The id to catch up from after a reconnection; undefined when nothing is loaded. */
export const lastId = (log?: MessageLog): number | undefined =>
  log && log.messages.length > 0 ? log.messages[log.messages.length - 1].id : undefined;

/**
 * Every message after `afterId`, page by page (a long disconnection can miss more than one page). `complete` is false
 * when more than `maxPages` pages were missed: reload the latest page instead of showing a hole.
 */
export async function catchUp(
  fetchAfter: (afterId: number) => Promise<GroupMessage[]>,
  afterId: number,
  pageSize: number,
  maxPages = 10,
): Promise<{ messages: GroupMessage[]; complete: boolean }> {
  const messages: GroupMessage[] = [];
  let cursor = afterId;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchAfter(cursor);
    messages.push(...page);
    if (page.length < pageSize) return { messages, complete: true };
    cursor = page[page.length - 1].id;
  }
  return { messages, complete: false };
}

/** member.joined / member.left on the group's member list (each member once). */
export function applyMemberEvent(detail: GroupDetail, type: "member.joined" | "member.left", member: Member): GroupDetail {
  const others = detail.members.filter((m) => m.id !== member.id);
  return { ...detail, members: type === "member.joined" ? [...others, member] : others };
}
