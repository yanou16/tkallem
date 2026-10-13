import { describe, expect, it, vi } from "vitest";
import { addNewer, addOlder, applyMemberEvent, catchUp, firstPage, hideMessage, lastId, markAuthor, mergeMessages } from "./messages";
import type { GroupDetail, GroupMessage } from "../types/groups";

const AMINA = { id: 1, firstName: "Amina" };
const YACINE = { id: 2, firstName: "Yacine" };
const msg = (id: number, author = AMINA, body = `message ${id}`): GroupMessage => ({
  id, body, createdAt: "2026-10-13T10:00:00Z", author, authorLeft: false,
});
const ids = (list: GroupMessage[]) => list.map((m) => m.id);

describe("mergeMessages", () => {
  it("keeps each id once, oldest first", () => {
    expect(ids(mergeMessages([msg(3), msg(1)], [msg(2), msg(3), msg(4)]))).toEqual([1, 2, 3, 4]);
  });

  it("keeps the last copy of a message that comes twice (the POST answer and its own live event)", () => {
    const merged = mergeMessages([msg(5, AMINA, "old copy")], [msg(5, AMINA, "new copy")]);
    expect(merged).toEqual([msg(5, AMINA, "new copy")]);
  });
});

describe("pages", () => {
  it("a full first page means older messages may exist, a short one that it is the whole history", () => {
    expect(firstPage([msg(1), msg(2)], 2).hasOlder).toBe(true);
    expect(firstPage([msg(1)], 2).hasOlder).toBe(false);
  });

  it("an older page goes above, and a short one says nothing older is left", () => {
    const log = firstPage([msg(10), msg(11)], 2);
    const older = addOlder(log, [msg(8), msg(9)], 2);
    expect(ids(older.messages)).toEqual([8, 9, 10, 11]);
    expect(older.hasOlder).toBe(true);
    expect(addOlder(older, [msg(7)], 2).hasOlder).toBe(false);
  });

  it("new messages go below without changing whether older ones exist", () => {
    const log = addNewer(firstPage([msg(10), msg(11)], 2), [msg(11), msg(12)]);
    expect(ids(log.messages)).toEqual([10, 11, 12]);
    expect(log.hasOlder).toBe(true);
  });
});

describe("live events", () => {
  it("message.hidden removes the message for everyone", () => {
    expect(ids(hideMessage(firstPage([msg(1), msg(2)], 50), 1).messages)).toEqual([2]);
  });

  it("member.left marks their messages as a former member's, member.joined unmarks them", () => {
    const log = firstPage([msg(1, AMINA), msg(2, YACINE)], 50);
    const left = markAuthor(log, YACINE.id, true);
    expect(left.messages.map((m) => m.authorLeft)).toEqual([false, true]);
    expect(markAuthor(left, YACINE.id, false).messages.map((m) => m.authorLeft)).toEqual([false, false]);
  });

  it("member events keep each member once", () => {
    const detail: GroupDetail = {
      id: 7, name: "English B1 Club #1", level: "B1", members: [AMINA],
      theme: { id: "travel", title: "Travel", category: "travel", question: "Where?" },
    };
    const joined = applyMemberEvent(detail, "member.joined", YACINE);
    expect(applyMemberEvent(joined, "member.joined", YACINE).members).toEqual([AMINA, YACINE]);
    expect(applyMemberEvent(joined, "member.left", AMINA).members).toEqual([YACINE]);
  });
});

describe("catching up after a reconnection", () => {
  it("starts after the last message shown", () => {
    expect(lastId(firstPage([msg(4), msg(9)], 50))).toBe(9);
    expect(lastId(firstPage([], 50))).toBeUndefined();
    expect(lastId(undefined)).toBeUndefined();
  });

  it("asks for every page after the cursor until a short one", async () => {
    const pages: Record<number, GroupMessage[]> = { 9: [msg(10), msg(11)], 11: [msg(12), msg(13)], 13: [msg(14)] };
    const fetchAfter = vi.fn(async (afterId: number) => pages[afterId] ?? []);

    const result = await catchUp(fetchAfter, 9, 2);

    expect(fetchAfter.mock.calls.map((c) => c[0])).toEqual([9, 11, 13]);
    expect(result).toEqual({ messages: [msg(10), msg(11), msg(12), msg(13), msg(14)], complete: true });
  });

  it("nothing missed: one call, nothing added", async () => {
    const fetchAfter = vi.fn(async () => []);
    expect(await catchUp(fetchAfter, 9, 100)).toEqual({ messages: [], complete: true });
    expect(fetchAfter).toHaveBeenCalledTimes(1);
  });

  it("too much missed: stops and says it is incomplete (the page reloads the latest messages instead)", async () => {
    let next = 1;
    const fetchAfter = vi.fn(async () => [msg(next++), msg(next++)]);

    const result = await catchUp(fetchAfter, 0, 2, 3);

    expect(fetchAfter).toHaveBeenCalledTimes(3);
    expect(result.complete).toBe(false);
  });
});
