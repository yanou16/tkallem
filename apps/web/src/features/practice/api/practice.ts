import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { Scenario, ScenarioDto, SessionSummary, SessionSummaryDto } from "../types/practice";

export const mapScenario = (s: ScenarioDto): Scenario => ({
  id: s.id,
  title: s.title,
  mode: s.mode,
  minutes: s.minutes,
  totalQuestions: s.total_questions,
  description: s.description,
  category: s.category,
  level: s.level,
  icon: s.icon,
});

export const getScenarios = () => api.get<ScenarioDto[]>(endpoints.scenarios).then((list) => list.map(mapScenario));

export const mapSessionSummary = (s: SessionSummaryDto): SessionSummary => ({
  id: s.session_id,
  scenarioId: s.scenario_id,
  title: s.title,
  startedAt: s.started_at,
  endedAt: s.ended_at,
  answered: s.answered,
  totalQuestions: s.total_questions,
});

/** The student's latest sessions, newest first (the API accepts 1 to 20). */
export const getMySessions = (limit = 5) =>
  api.get<SessionSummaryDto[]>(endpoints.mySessions, { query: { limit } }).then((list) => list.map(mapSessionSummary));
