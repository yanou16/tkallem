/** A practice scenario, as the agent describes it (id, title, mode, minutes). */
export type Scenario = {
  id: string;
  title: string;
  /** guided: fixed questions, then a report. free: open conversation, ended by the student. */
  mode: "guided" | "free";
  /** Shown on the card. Null for free talk. */
  minutes: number | null;
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
