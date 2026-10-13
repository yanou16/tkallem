import { afterEach, describe, expect, it, vi } from "vitest";
import { checkDraft, getMessages, getMyGroup, joinAGroup, leaveGroup, mapMessage, reportMessage, saveFirstName } from "./groups";
import type { GroupMessageDto, GroupSummaryDto } from "../types/groups";

const GROUP: GroupSummaryDto = {
  id: 7,
  name: "English B1 Club #1",
  level: "B1",
  member_count: 3,
  last_activity: null,
  theme: { id: "travel", title: "Travel", category: "travel" },
};

const MESSAGE: GroupMessageDto = {
  id: 12,
  body: "Hello everyone",
  created_at: "2026-10-13T10:00:00Z",
  author: { id: 4, first_name: "Amina" },
  author_left: false,
};

/** fetch answers `body` (JSON) or nothing (204); returns the mock to read what was sent. */
function answer(body?: unknown, status = 200) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const sent = (f: ReturnType<typeof answer>) => ({ url: f.mock.calls[0][0], method: f.mock.calls[0][1].method, body: f.mock.calls[0][1].body });

afterEach(() => vi.unstubAllGlobals());

describe("mapMessage", () => {
  it("converts a message to camelCase", () => {
    expect(mapMessage(MESSAGE)).toEqual({
      id: 12, body: "Hello everyone", createdAt: "2026-10-13T10:00:00Z", author: { id: 4, firstName: "Amina" }, authorLeft: false,
    });
  });
});

describe("groups API", () => {
  it("GET /me/group: the group, or null when she has none", async () => {
    answer(GROUP);
    expect(await getMyGroup()).toMatchObject({ id: 7, memberCount: 3, lastActivity: null });
    const f = answer(null);
    expect(await getMyGroup()).toBeNull();
    expect(sent(f).url).toMatch(/\/me\/group$/);
  });

  it("POST /groups/join", async () => {
    const f = answer(GROUP);
    expect((await joinAGroup()).name).toBe("English B1 Club #1");
    expect(sent(f)).toMatchObject({ method: "POST" });
    expect(sent(f).url).toMatch(/\/groups\/join$/);
  });

  it("GET /groups/{id}/messages: the latest page, scrolling up with before_id, catching up with after_id", async () => {
    let f = answer([MESSAGE]);
    await getMessages(7);
    expect(sent(f).url).toMatch(/\/groups\/7\/messages\?limit=50$/);

    f = answer([]);
    await getMessages(7, { beforeId: 12 });
    expect(sent(f).url).toMatch(/\?before_id=12&limit=50$/);

    f = answer([]);
    await getMessages(7, { afterId: 12, limit: 100 });
    expect(sent(f).url).toMatch(/\?after_id=12&limit=100$/);
  });

  it("DELETE /groups/{id}/members/me to leave (204, no body)", async () => {
    const f = answer(undefined, 204);
    await leaveGroup(7);
    expect(sent(f)).toMatchObject({ method: "DELETE" });
    expect(sent(f).url).toMatch(/\/groups\/7\/members\/me$/);
  });

  it("POST /groups/{id}/messages/{mid}/report with the reason", async () => {
    const f = answer({ hidden: true });
    expect(await reportMessage(7, 12, "spam")).toEqual({ hidden: true });
    expect(sent(f).url).toMatch(/\/groups\/7\/messages\/12\/report$/);
    expect(JSON.parse(sent(f).body as string)).toEqual({ reason: "spam" });
  });

  it("POST /groups/{id}/check: correction, explanation, type and rule", async () => {
    const f = answer([{ original: "for study", correction: "to study", explanation: "Le but : to + verbe.", type: "grammar", rule: "verb_pattern" }]);
    const [c] = await checkDraft(7, "I came for study");
    expect(c).toEqual({ original: "for study", correction: "to study", explanation: "Le but : to + verbe.", type: "grammar", rule: "verb_pattern" });
    expect(JSON.parse(sent(f).body as string)).toEqual({ text: "I came for study" });
  });

  it("a 429 becomes an ApiError with its status", async () => {
    answer({ detail: "Too many messages: wait a minute before sending more" }, 429);
    await expect(checkDraft(7, "hi")).rejects.toMatchObject({ status: 429 });
  });

  it("PATCH /me with the first name only", async () => {
    const f = answer({ first_name: "Amina", level: "B1", explain_lang: "fr", daily_goal_minutes: 10, learning_goal: null, practice_mode: null, focus_areas: [] });
    expect((await saveFirstName("Amina")).firstName).toBe("Amina");
    expect(sent(f)).toMatchObject({ method: "PATCH" });
    expect(JSON.parse(sent(f).body as string)).toEqual({ first_name: "Amina" });
  });
});
