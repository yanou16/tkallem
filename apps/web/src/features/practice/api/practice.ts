import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { Scenario, SessionSummary, SessionSummaryDto } from "../types/practice";

// TODO: GET /scenarios. The API does not list scenarios yet: these are copied from
// packages/agent/tkallem_agent/scenarios/*.json (id, title, mode, minutes). Keep them in sync until then.
const SCENARIOS: Scenario[] = [
  { id: "visa-us", title: "Visa interview", mode: "guided", minutes: 8 },
  { id: "campus-france", title: "Campus France interview", mode: "guided", minutes: 8 },
  { id: "job-remote", title: "Remote job interview", mode: "guided", minutes: 10 },
  { id: "ielts-part2", title: "IELTS Speaking, part 2", mode: "guided", minutes: 6 },
  { id: "free-talk", title: "Free talk", mode: "free", minutes: null },
];

export const getScenarios = async (): Promise<Scenario[]> => SCENARIOS;

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
