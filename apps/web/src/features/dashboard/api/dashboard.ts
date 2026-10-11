import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { MeProgress } from "@/features/progress/types/progress";
import type { DashboardData, TopMistake } from "../types/dashboard";

/** The home screen is computed from GET /me/progress: there is no separate dashboard endpoint. */
export const getMeProgress = () => api.get<MeProgress>(endpoints.progress);

const minutes = (seconds: number) => Math.round(seconds / 60);
const oneDecimal = (n: number) => Math.round(n * 10) / 10;

export function toDashboard(p: MeProgress): DashboardData {
  return {
    speakingMinutesThisWeek: minutes(p.week_speaking_seconds),
    streakDays: p.streak_days,
    mistakesPer100Words: p.current.mistakes_per_100 === null ? null : oneDecimal(p.current.mistakes_per_100),
    mistakesChange: p.mistakes_change === null ? null : oneDecimal(p.mistakes_change),
    mistakesChangeLabel: "since your first sessions",
    dailyGoalMinutes: minutes(p.daily_goal_seconds),
    dailyCompletedMinutes: minutes(p.today_speaking_seconds),
  };
}

const CATEGORY_LABEL: Record<string, string> = { grammar: "Grammar", vocabulary: "Vocabulary", word_choice: "Word choice", other: "Other" };

export function toTopMistakes(p: MeProgress): TopMistake[] {
  return p.top_mistakes.map((m) => ({ ...m, category: CATEGORY_LABEL[m.category] ?? m.category }));
}
