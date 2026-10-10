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

/** GET /me/achievements item, as sent by the API: the full catalog, each badge locked or not. */
export type AchievementDto = {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  /** An icon name from lib/icons.tsx. */
  icon: string;
  unlocked: boolean;
};
