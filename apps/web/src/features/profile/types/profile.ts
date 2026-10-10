import type { DailyGoalMinutes, ExplainLang, FocusArea, Level } from "@/features/auth/types/user";

/** A change to the learning setup. learningGoal and practiceMode accept null to clear them. */
export type UpdateProfileInput = Partial<{
  level: Level;
  explainLang: ExplainLang;
  dailyGoalMinutes: DailyGoalMinutes;
  learningGoal: string | null;
  practiceMode: string | null;
  focusAreas: FocusArea[];
}>;

/** PATCH /me body. The API rejects unknown fields and an empty body. */
export type MeUpdateDto = Partial<{
  level: Level;
  explain_lang: ExplainLang;
  daily_goal_minutes: DailyGoalMinutes;
  learning_goal: string | null;
  practice_mode: string | null;
  focus_areas: FocusArea[];
}>;
