import { afterEach, describe, expect, it, vi } from "vitest";
import { getMySessions, mapSessionSummary } from "./practice";
import type { SessionSummaryDto } from "../types/practice";

const VISA: SessionSummaryDto = {
  session_id: "5f0c4a3e8d0b4c5f9a2e1b7c6d4e3f21",
  scenario_id: "visa-us",
  title: "Visa interview",
  started_at: "2026-10-09T18:30:00Z",
  ended_at: null,
  answered: 3,
  total_questions: 6,
};

afterEach(() => vi.unstubAllGlobals());

describe("mapSessionSummary", () => {
  it("converts a session summary to camelCase", () => {
    expect(mapSessionSummary(VISA)).toEqual({
      id: "5f0c4a3e8d0b4c5f9a2e1b7c6d4e3f21",
      scenarioId: "visa-us",
      title: "Visa interview",
      startedAt: "2026-10-09T18:30:00Z",
      endedAt: null,
      answered: 3,
      totalQuestions: 6,
    });
  });

  it("keeps a null total for free talk", () => {
    expect(mapSessionSummary({ ...VISA, scenario_id: "free-talk", total_questions: null }).totalQuestions).toBeNull();
  });
});

describe("getMySessions", () => {
  it("reads GET /me/sessions with the limit", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify([VISA])));
    vi.stubGlobal("fetch", fetchMock);

    const sessions = await getMySessions(5);

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/me\/sessions\?limit=5$/);
    expect(sessions.map((s) => s.scenarioId)).toEqual(["visa-us"]);
  });
});
