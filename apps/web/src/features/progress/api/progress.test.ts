import { afterEach, describe, expect, it, vi } from "vitest";
import { getProgress, mapProgress } from "./progress";
import type { ProgressDto } from "../types/progress";

const NEW_STUDENT: ProgressDto = {
  current: { mistakes_per_100: null, words_per_answer: null, hesitations_per_min: null, speaking_seconds: null },
  baseline: null,
  mistakes_change: null,
  top_mistakes: [],
  week_speaking_seconds: 0,
  today_speaking_seconds: 0,
  daily_goal_seconds: 600,
  streak_days: 0,
};

afterEach(() => vi.unstubAllGlobals());

describe("mapProgress", () => {
  it("keeps null metrics and the missing baseline of a new student", () => {
    expect(mapProgress(NEW_STUDENT)).toEqual({
      current: { mistakesPer100: null, wordsPerAnswer: null, hesitationsPerMin: null, speakingSeconds: null },
      baseline: null,
      mistakesChange: null,
      topMistakes: [],
      weekSpeakingSeconds: 0,
      todaySpeakingSeconds: 0,
      dailyGoalSeconds: 600,
      streakDays: 0,
    });
  });

  it("converts metrics, baseline, mistakes and activity to camelCase", () => {
    const progress = mapProgress({
      current: { mistakes_per_100: 4, words_per_answer: 25, hesitations_per_min: null, speaking_seconds: 120 },
      baseline: { mistakes_per_100: 10, words_per_answer: 20, hesitations_per_min: null, speaking_seconds: null },
      mistakes_change: -6,
      top_mistakes: [
        { id: "grammar", category: "grammar", original: "I go yesterday", correction: "I went yesterday", count: 1 },
      ],
      week_speaking_seconds: 120,
      today_speaking_seconds: 120,
      daily_goal_seconds: 1200,
      streak_days: 1,
    });

    expect(progress.current).toEqual({ mistakesPer100: 4, wordsPerAnswer: 25, hesitationsPerMin: null, speakingSeconds: 120 });
    expect(progress.baseline?.mistakesPer100).toBe(10);
    expect(progress.mistakesChange).toBe(-6);
    expect(progress.topMistakes).toEqual([
      { id: "grammar", category: "grammar", original: "I go yesterday", correction: "I went yesterday", count: 1 },
    ]);
    expect(progress).toMatchObject({ weekSpeakingSeconds: 120, todaySpeakingSeconds: 120, dailyGoalSeconds: 1200, streakDays: 1 });
  });
});

describe("getProgress", () => {
  it("reads GET /me/progress", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(NEW_STUDENT)));
    vi.stubGlobal("fetch", fetchMock);

    const progress = await getProgress();

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/me\/progress$/);
    expect(progress.dailyGoalSeconds).toBe(600);
  });
});
