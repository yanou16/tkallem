export type ProgressMetrics = {
  mistakes_per_100: number;
  words_per_answer: number;
  hesitations_per_min: number;
  speaking_seconds: number;
};

export type ProgressData = {
  current: ProgressMetrics;
  baseline?: ProgressMetrics;
  top_mistakes: Array<Record<string, unknown>>;
};

/** Full answer of GET /me/progress (packages/contracts/openapi.yaml). */
export type MeProgress = {
  current: { mistakes_per_100: number | null; words_per_answer: number | null; hesitations_per_min: number | null; speaking_seconds: number | null };
  baseline: MeProgress["current"] | null;
  mistakes_change: number | null;
  top_mistakes: { id: string; category: string; original: string; correction: string; count: number }[];
  week_speaking_seconds: number;
  today_speaking_seconds: number;
  daily_goal_seconds: number;
  streak_days: number;
};

/** One line of GET /me/sessions. */
export type SessionSummary = {
  session_id: string;
  scenario_id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  answered: number;
  total_questions: number | null;
};
