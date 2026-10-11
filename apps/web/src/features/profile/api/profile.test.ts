import { afterEach, describe, expect, it, vi } from "vitest";
import { getAchievements, mapAchievement, mapProfileUpdate, updateProfile } from "./profile";
import type { MeDto } from "@/features/auth/types/user";
import type { AchievementDto } from "../types/profile";

afterEach(() => vi.unstubAllGlobals());

const FIRST_SESSION: AchievementDto = {
  id: "first_session",
  title: "First session",
  description: "Finish your first practice session.",
  icon: "star",
  unlocked: true,
};

describe("mapAchievement", () => {
  it("keeps the badge and whether it is unlocked", () => {
    expect(mapAchievement(FIRST_SESSION)).toEqual(FIRST_SESSION);
    expect(mapAchievement({ ...FIRST_SESSION, unlocked: false }).unlocked).toBe(false);
  });
});

describe("getAchievements", () => {
  it("reads GET /me/achievements", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify([FIRST_SESSION])));
    vi.stubGlobal("fetch", fetchMock);

    const badges = await getAchievements();

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/me\/achievements$/);
    expect(badges.map((b) => b.id)).toEqual(["first_session"]);
  });
});

describe("mapProfileUpdate", () => {
  it("sends only the changed field", () => {
    expect(mapProfileUpdate({ level: "B2" })).toEqual({ level: "B2" });
    expect(mapProfileUpdate({ dailyGoalMinutes: 20 })).toEqual({ daily_goal_minutes: 20 });
  });

  it("converts every field to the API names", () => {
    expect(
      mapProfileUpdate({
        level: "C1",
        explainLang: "en",
        dailyGoalMinutes: 5,
        learningGoal: "Speak at work",
        practiceMode: "voice",
        focusAreas: ["fluency"],
      }),
    ).toEqual({
      level: "C1",
      explain_lang: "en",
      daily_goal_minutes: 5,
      learning_goal: "Speak at work",
      practice_mode: "voice",
      focus_areas: ["fluency"],
    });
  });

  it("keeps null to clear the learning goal and the practice mode", () => {
    expect(mapProfileUpdate({ learningGoal: null, practiceMode: null })).toEqual({ learning_goal: null, practice_mode: null });
  });
});

describe("updateProfile", () => {
  it("sends PATCH /me and returns the updated profile", async () => {
    const updated: MeDto = {
      first_name: null,
      level: "B2",
      explain_lang: "fr",
      daily_goal_minutes: 10,
      learning_goal: null,
      practice_mode: null,
      focus_areas: [],
    };
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(updated)));
    vi.stubGlobal("fetch", fetchMock);

    const me = await updateProfile({ level: "B2" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/me$/);
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe('{"level":"B2"}');
    expect(me.level).toBe("B2");
  });
});
