/** "How confident do you feel?" before and after a session (docs/IMPACT.md), kept pure so it is tested in confidence.test.ts. */
export type Confidence = { before: number | null; after: number | null };

export const SCALE = [
  { value: 1, label: "Not at all" },
  { value: 2, label: "A little" },
  { value: 3, label: "So-so" },
  { value: 4, label: "Quite" },
  { value: 5, label: "Very" },
] as const;

export const EMPTY_CONFIDENCE: Confidence = { before: null, after: null };

/** The report line, only when both answers exist. Neutral when it went down: a hard interview is not a failure. */
export function confidenceLine(c: Confidence | null | undefined): string | null {
  if (!c || c.before === null || c.after === null) return null;
  if (c.after > c.before) return `You feel more confident: ${c.before}/5 before, ${c.after}/5 now.`;
  if (c.after === c.before) return `Confidence: ${c.before}/5 before and now.`;
  return `Confidence: ${c.before}/5 before, ${c.after}/5 now. A hard interview teaches the most.`;
}

/** The question stays on screen, with the chosen number, until the first answer is sent (it can still be changed);
 *  after that it would no longer be a "before", and a skip hides it. */
export function shouldAskBefore(answers: number, skipped: boolean): boolean {
  return answers === 0 && !skipped;
}
