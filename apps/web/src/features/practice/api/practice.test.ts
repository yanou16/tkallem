import { afterEach, describe, expect, it, vi } from "vitest";
import { getMySessions, getScenarios, mapScenario, mapSessionSummary } from "./practice";
import type { ScenarioDto, SessionSummaryDto } from "../types/practice";

const VISA_SCENARIO: ScenarioDto = {
  id: "visa-us",
  title: "Visa interview",
  mode: "guided",
  minutes: 8,
  total_questions: 6,
  description: null,
  category: null,
  level: null,
  icon: null,
};

describe("mapScenario", () => {
  it("converts a scenario to camelCase and keeps the fields the agent does not have yet as null", () => {
    expect(mapScenario(VISA_SCENARIO)).toEqual({
      id: "visa-us",
      title: "Visa interview",
      mode: "guided",
      minutes: 8,
      totalQuestions: 6,
      description: null,
      category: null,
      level: null,
      icon: null,
    });
  });
});

describe("getScenarios", () => {
  it("reads GET /scenarios", async () => {
    const free: ScenarioDto = { ...VISA_SCENARIO, id: "free-talk", title: "Free talk", mode: "free", minutes: null, total_questions: null };
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify([free, VISA_SCENARIO])));
    vi.stubGlobal("fetch", fetchMock);

    const scenarios = await getScenarios();

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/scenarios$/);
    expect(scenarios.map((s) => [s.id, s.totalQuestions])).toEqual([["free-talk", null], ["visa-us", 6]]);
  });
});

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
