/** GET /scenarios item, as sent by the API. */
export type ScenarioDto = {
  id: string;
  title: string;
  mode: "guided" | "free";
  minutes: number | null;
  total_questions: number | null;
  description: string | null;
  category: string | null;
  level: string | null;
  icon: string | null;
};

/** A practice scenario. description, category, level and icon stay null until the agent's scenarios have them. */
export type Scenario = {
  id: string;
  title: string;
  /** guided: fixed questions, then a report. free: open conversation, ended by the student. */
  mode: "guided" | "free";
  /** Shown on the card. Null for free talk. */
  minutes: number | null;
  /** Null for free talk. */
  totalQuestions: number | null;
  description: string | null;
  category: string | null;
  level: string | null;
  /** An icon name from lib/icons.tsx. */
  icon: string | null;
};

/** GET /me/sessions item, as sent by the API. */
export type SessionSummaryDto = {
  session_id: string;
  scenario_id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  answered: number;
  total_questions: number | null;
};

/** One of the student's sessions, newest first. */
export type SessionSummary = {
  id: string;
  scenarioId: string;
  title: string;
  startedAt: string;
  /** Null while the session is not finished. */
  endedAt: string | null;
  answered: number;
  /** Null in free talk (no fixed questions). */
  totalQuestions: number | null;
};
