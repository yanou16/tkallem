import { afterEach, describe, expect, it, vi } from "vitest";
import { checkDraft, getGroupPreview, getMessages, getMyGroup, joinAGroup, leaveGroup, mapGroupPreview, mapMessage, reportMessage, saveFirstName, sendMessage } from "./groups";
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
  it("loads real preview data from /groups/preview without a demo fallback", async () => {
    const theme = { id: "work", title: "Work", category: "work", question: "Office or home?" };
    const f = answer({ theme, groups: [GROUP] });
    expect((await getGroupPreview()).groups[0].id).toBe(7);
    expect(sent(f).url).toMatch(/\/groups\/preview$/);
    answer({ detail: "Not found" }, 404);
    await expect(getGroupPreview()).rejects.toMatchObject({ status: 404 });
  });

  it("sends a message to the backend and returns the persisted message", async () => {
    const f = answer(MESSAGE);
    expect(await sendMessage(7, "Hello everyone")).toMatchObject({ id: 12, body: "Hello everyone" });
    expect(sent(f).url).toMatch(/\/groups\/7\/messages$/);
    expect(sent(f).method).toBe("POST");
    expect(JSON.parse(sent(f).body as string)).toEqual({ body: "Hello everyone" });
  });

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

describe("mapGroupPreview", () => {
  it("keeps the theme and question and maps the groups, with no member in it", () => {
    const theme = { id: "work", title: "Work and jobs", category: "work" as const, question: "Office or home?" };
    const preview = mapGroupPreview({ theme, groups: [{ id: 3, name: "English B1 Club #1", level: "B1", member_count: 2, last_activity: null, theme }] });
    expect(preview.theme.question).toBe("Office or home?");
    expect(preview.groups).toEqual([expect.objectContaining({ id: 3, level: "B1", memberCount: 2, lastActivity: null })]);
    expect(JSON.stringify(preview)).not.toContain("first_name");
  });
});
