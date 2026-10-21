/** Wording of the phrase of the day, kept pure so it is tested in phraseView.test.ts. The verdict comes from the server
 *  (code, not the model). Gentle on a miss: say what was heard, then one thing to do. */
import type { ExplainLang } from "@/features/auth/types/user";
import type { PhraseChecked, PhraseKind, PhraseOfDay } from "../types/phraseOfDay";

/** An idiom is fun to know but is not for an interview: say it, so nobody learns it for the wrong place. */
export const KIND_NOTE: Record<PhraseKind, string | null> = {
  interview: null,
  everyday: null,
  idiom: "An idiom: fun to know, not for an interview.",
};

/** The label that opens the meaning: it names the language the meaning is written in. */
export const meaningToggle = (lang: ExplainLang) => (lang === "fr" ? "Meaning in French" : "Meaning in English");
export const otherLang = (lang: ExplainLang): ExplainLang => (lang === "fr" ? "en" : "fr");

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
