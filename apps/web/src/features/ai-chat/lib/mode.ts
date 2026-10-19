/** Practice and Real interview (docs/JURY_BRIEF.md, improvement 3), kept pure so it is tested in mode.test.ts. */
export type FeedbackMode = "practice" | "interview";

export const MODE_LABEL: Record<FeedbackMode, string> = { practice: "Practice", interview: "Real interview" };

/** The mode asked by the link (?mode=interview); anything else is practice, the default. */
export function feedbackModeFrom(param: string | null | undefined): FeedbackMode {
  return param === "interview" ? "interview" : "practice";
}

/** One line under the mode, so the student knows what to expect. */
export function modeHint(mode: FeedbackMode): string {
  return mode === "interview"
    ? "No corrections or hints until the end: answer as you would in the real one. Everything is in your report."
    : "Corrections after each answer, help to start, and Say it again.";
}
