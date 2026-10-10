/** A practice scenario, as the agent describes it (id, title, mode, minutes). */
export type Scenario = {
  id: string;
  title: string;
  /** guided: fixed questions, then a report. free: open conversation, ended by the student. */
  mode: "guided" | "free";
  /** Shown on the card. Null for free talk. */
  minutes: number | null;
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

export type RecentSession = {
  id: string;
  scenarioId: string;
  title: string;
  subtitle: string; // e.g. "You were practicing introductions."
  duration: number;
  level: string;
  icon: string;
};

export type PracticeFocus = {
  scenarioId?: string;
  title: string;
  description: string;
  reason: string;
  icon: string;
};
