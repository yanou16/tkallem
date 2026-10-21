/** Wording of the phrase of the day, kept pure so it is tested in phraseView.test.ts. The verdict comes from the server
 *  (code, not the model). Gentle on a miss: say what was heard, then one thing to do. */
import type { ExplainLang } from "@/features/auth/types/user";
import type { PhraseChecked, PhraseKind, PhraseOfDay } from "../types/phraseOfDay";

export const KIND_LABEL: Record<PhraseKind, string> = { interview: "Interview", everyday: "Everyday", idiom: "Idiom" };

/** An idiom is fun to know but is not for an interview: say it, so nobody learns it for the wrong place. */
export const KIND_NOTE: Record<PhraseKind, string | null> = {
  interview: null,
  everyday: null,
  idiom: "An expression to know, not to use in an interview.",
};

export const meaningOf = (p: PhraseOfDay, lang: ExplainLang) => (lang === "fr" ? p.fr : p.en);

export type CheckView = { nailed: boolean; title: string; text: string };

export function checkView(r: PhraseChecked): CheckView {
  if (r.nailed) return { nailed: true, title: "Nailed it", text: "That is today's phrase, said right." };
  const heard = r.heard.trim();
  const said = heard ? `I heard: “${heard}”. ` : "";
  return { nailed: false, title: "Almost", text: `${said}Say the whole phrase, a little slower.` };
}

export function streakText(days: number): string {
  if (days <= 0) return "";
  return days === 1 ? "1 day in a row" : `${days} days in a row`;
}
