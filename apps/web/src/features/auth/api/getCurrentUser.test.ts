import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser, mapMe } from "./getCurrentUser";
import type { MeDto } from "../types/user";

const FIRST_VISIT: MeDto = {
  first_name: null,
  level: null,
  explain_lang: "fr",
  daily_goal_minutes: 10,
  learning_goal: null,
  practice_mode: null,
  focus_areas: [],
};

afterEach(() => vi.unstubAllGlobals());

describe("mapMe", () => {
  it("keeps the nulls of a profile created on first visit", () => {
    expect(mapMe(FIRST_VISIT)).toEqual({
      firstName: null,
      level: null,
      explainLang: "fr",
      dailyGoalMinutes: 10,
      learningGoal: null,
      practiceMode: null,
      focusAreas: [],
    });
  });

  it("converts a complete learning setup to camelCase", () => {
    const me = mapMe({
      ...FIRST_VISIT,
      level: "B1",
      explain_lang: "en",
      daily_goal_minutes: 20,
      learning_goal: "Pass my visa interview",
      practice_mode: "text",
      focus_areas: ["grammar", "fluency"],
    });

    expect(me).toMatchObject({
      level: "B1",
      explainLang: "en",
      dailyGoalMinutes: 20,
      learningGoal: "Pass my visa interview",
      practiceMode: "text",
      focusAreas: ["grammar", "fluency"],
    });
  });
});

describe("getCurrentUser", () => {
  it("reads GET /me with the given Clerk token", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(FIRST_VISIT)));
    vi.stubGlobal("fetch", fetchMock);

    const me = await getCurrentUser("clerk-jwt");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/me$/);
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer clerk-jwt");
    expect(me.explainLang).toBe("fr");
  });
});
