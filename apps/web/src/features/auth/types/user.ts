/** The values accepted by the API for the learning setup (GET and PATCH /me). */
export type Level = "A2" | "B1" | "B2" | "C1";
export type ExplainLang = "en" | "fr";
export type DailyGoalMinutes = 5 | 10 | 15 | 20 | 30;
export type FocusArea = "conversation" | "pronunciation" | "vocabulary" | "grammar" | "fluency" | "confidence";

export const LEVELS: Level[] = ["A2", "B1", "B2", "C1"];
export const DAILY_GOALS: DailyGoalMinutes[] = [5, 10, 15, 20, 30];
export const FOCUS_AREAS: FocusArea[] = ["conversation", "pronunciation", "vocabulary", "grammar", "fluency", "confidence"];

/** GET /me (and the PATCH /me response) as sent by the API. */
export type MeDto = {
  first_name: string | null;
  level: Level | null;
  explain_lang: ExplainLang;
  daily_goal_minutes: DailyGoalMinutes;
  learning_goal: string | null;
  practice_mode: string | null;
  focus_areas: FocusArea[];
};

/** The learning setup stored by our API. */
export type Me = {
  firstName: string | null;
  /** Null until the student picks a level: starting a session needs one. */
  level: Level | null;
  explainLang: ExplainLang;
  dailyGoalMinutes: DailyGoalMinutes;
  learningGoal: string | null;
  practiceMode: string | null;
  focusAreas: FocusArea[];
};

/** The signed-in student: name, photo and email from Clerk, learning setup from GET /me. */
export type User = Omit<Me, "firstName"> & {
  firstName: string;
  lastName?: string;
  email: string;
  avatarUrl?: string;
};
