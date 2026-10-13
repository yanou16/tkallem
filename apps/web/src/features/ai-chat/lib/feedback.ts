/** "Reassure before correcting" (docs/JURY_BRIEF.md, improvement 4), kept pure so it is tested in feedback.test.ts. */
import type { Correction } from "../types/ai";

export type FeedbackView = {
  priority: Correction | null; // shown in full
  others: Correction[]; // folded under `moreLabel`
  moreLabel: string;
};

/** The correction to show first (the agent's priority, the first one when the index is out of range), the rest folded. */
export function feedbackView(corrections: Correction[], priorityIndex = 0): FeedbackView {
  if (corrections.length === 0) return { priority: null, others: [], moreLabel: "" };
  const i = Number.isInteger(priorityIndex) && priorityIndex >= 0 && priorityIndex < corrections.length ? priorityIndex : 0;
  const others = corrections.filter((_, j) => j !== i);
  const moreLabel = others.length === 0 ? "" : others.length === 1 ? "1 more small fix" : `${others.length} more small fixes`;
  return { priority: corrections[i], others, moreLabel };
}
