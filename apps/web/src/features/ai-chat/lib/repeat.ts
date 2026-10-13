/** "Say it again" wording (docs/JURY_BRIEF.md, improvement 2), kept pure so it is tested in repeat.test.ts.
 *  The verdict itself comes from the server (code, not the model). */
import type { RepeatDto } from "../types/ai";

export type RepeatView = { nailed: boolean; title: string; text: string };

/** Gentle on a miss: name the corrected words to say, never list what was wrong. */
export function repeatView(r: RepeatDto): RepeatView {
  if (r.nailed) return { nailed: true, title: "Nailed it", text: "That is the corrected sentence." };
  const words = r.missing.map((m) => `“${m}”`);
  const say = words.length === 0 ? "Say the whole corrected sentence, a little closer to it."
    : words.length === 1 ? `Almost. This time, say ${words[0]}.`
    : `Almost. This time, say ${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}.`;
  return { nailed: false, title: "Almost", text: say };
}

export function triesText(left: number): string {
  if (left <= 0) return "No more tries for this answer. You can go on.";
  return left === 1 ? "1 more try." : `${left} more tries.`;
}
