import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { MeProgress, SessionSummary } from "@/features/progress/types/progress";
import type { PracticeFocus, RecentSession, Scenario } from "../types/practice";

export const getScenarios = (category?: string) =>
  api.get<Scenario[]>(endpoints.practice.scenarios, { query: { category } });

const getMySessions = (limit = 5) => api.get<SessionSummary[]>(endpoints.practice.recent, { query: { limit } });

function progressLine(s: SessionSummary): string {
  if (s.ended_at) return `Finished · ${s.answered} answers`;
  return s.total_questions ? `${s.answered} of ${s.total_questions} questions answered` : `${s.answered} answers so far`;
}

/** "Continue from last session": the unfinished sessions of GET /me/sessions, with the scenario card details. */
export async function getRecentSessions(): Promise<RecentSession[]> {
  const [sessions, scenarios] = await Promise.all([getMySessions(10), getScenarios()]);
  const byId = new Map(scenarios.map((s) => [s.id, s]));
  return sessions
    .filter((s) => !s.ended_at && s.answered > 0)
    .map((s) => {
      const sc = byId.get(s.scenario_id);
      return {
        id: s.session_id,
        scenarioId: s.scenario_id,
        title: s.title,
        subtitle: progressLine(s),
        duration: sc?.duration ?? 0,
        level: sc?.level ?? "",
        icon: sc?.icon ?? "chat",
      };
    });
}

/** Scenarios the student has not tried yet first (computed here: there is no recommendation endpoint). */
export async function getRecommended(): Promise<Scenario[]> {
  const [sessions, scenarios] = await Promise.all([getMySessions(20), getScenarios()]);
  const tried = new Set(sessions.map((s) => s.scenario_id));
  return [...scenarios.filter((s) => !tried.has(s.id)), ...scenarios.filter((s) => tried.has(s.id))];
}

const FOCUS_SCENARIO: Record<string, string> = { grammar: "visa-us", vocabulary: "job-remote", word_choice: "job-remote" };

/** Today's focus: the most frequent mistake of the last sessions (GET /me/progress), null before any mistake. */
export async function getFocus(): Promise<PracticeFocus | null> {
  const p = await api.get<MeProgress>(endpoints.progress);
  const top = p.top_mistakes[0];
  if (!top) return null;
  return {
    scenarioId: FOCUS_SCENARIO[top.category],
    title: `Fix: ${top.original} → ${top.correction}`,
    description: `Your most frequent ${top.category.replace("_", " ")} mistake.`,
    reason: `It came back ${top.count} time${top.count > 1 ? "s" : ""} in your last sessions.`,
    icon: "target",
  };
}
