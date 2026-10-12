import type { Correction } from "../types/ai";

export type Piece = { text: string; kind: "plain" | "wrong" | "fixed" };

/**
 * The student's sentence twice, as DESIGN.md's correction component shows it: once with each wrong part marked, once
 * with each fixed part marked. `unplaced` holds corrections whose words could not be found in the sentence (they are
 * shown on their own, "original → fixed").
 */
export function markSentence(text: string, corrections: Correction[]): { before: Piece[]; after: Piece[]; unplaced: Correction[] } {
  const lower = text.toLowerCase();
  const placed: { start: number; end: number; c: Correction }[] = [];
  const unplaced: Correction[] = [];
  for (const c of corrections) {
    const needle = c.original.trim().toLowerCase();
    let at = needle ? lower.indexOf(needle) : -1;
    while (at >= 0 && placed.some((p) => at < p.end && at + needle.length > p.start)) at = lower.indexOf(needle, at + 1);
    if (at < 0) unplaced.push(c);
    else placed.push({ start: at, end: at + needle.length, c });
  }
  placed.sort((a, b) => a.start - b.start);
  const before: Piece[] = [];
  const after: Piece[] = [];
  let pos = 0;
  for (const p of placed) {
    if (p.start > pos) {
      before.push({ text: text.slice(pos, p.start), kind: "plain" });
      after.push({ text: text.slice(pos, p.start), kind: "plain" });
    }
    before.push({ text: text.slice(p.start, p.end), kind: "wrong" });
    after.push({ text: p.c.fixed, kind: "fixed" });
    pos = p.end;
  }
  if (pos < text.length) {
    before.push({ text: text.slice(pos), kind: "plain" });
    after.push({ text: text.slice(pos), kind: "plain" });
  }
  return { before, after, unplaced };
}
