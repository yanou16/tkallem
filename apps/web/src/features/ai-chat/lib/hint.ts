/** "Help me start" decisions (docs/JURY_BRIEF.md, improvement 1), kept pure so they are tested in hint.test.ts. */
import type { HintDto } from "../types/ai";

/** The button is highlighted when the student has not started 5 seconds after the coach's question. */
export const NUDGE_AFTER_MS = 5000;

export type NudgeState = {
  questionShownAt: number | null; // when the coach's question was on screen and done (null: no question to answer)
  now: number;
  typing: boolean; // something in the answer field
  recording: boolean;
  busy: boolean; // the coach is thinking or speaking
};

export function shouldNudge(s: NudgeState): boolean {
  return s.questionShownAt !== null && !s.typing && !s.recording && !s.busy && s.now - s.questionShownAt >= NUDGE_AFTER_MS;
}

export type HintView = {
  title: string;
  lines: string[]; // as shown
  fill: string; // what "Use it" puts in the answer field
};

/** What the student reads. `asked` is what they asked for: a refused translation comes back as a starter. */
export function hintView(hint: HintDto, asked: "starter" | "translate"): HintView {
  if (hint.kind === "translation") {
    return { title: "In English, read it aloud:", lines: hint.lines, fill: hint.lines[0] };
  }
  const title = asked === "translate" ? "We could not turn this into English. You can start with:" : "You can start with:";
  return { title, lines: hint.lines.map((l) => `${l}…`), fill: `${hint.lines[0]} ` };
}

export function remainingText(remaining: number): string {
  if (remaining <= 0) return "No more hints for this question.";
  return remaining === 1 ? "1 more hint for this question." : `${remaining} more hints for this question.`;
}
