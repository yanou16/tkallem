/** The verdict at the top of a real interview report (ready / almost / not yet), as words. The API decides the status and
 *  the two reasons from the report's traffic lights; this file only writes them, in the language of the note, and is
 *  kept pure so it is tested in verdict.test.ts. It speaks of THIS practice, never of the real interview. */
import type { ExplainLang } from "@/features/auth/types/user";
import { formatNumber } from "@/lib/utils";
import type { FeedbackMode, SentenceStatus, VerdictDto, VerdictMetric } from "../types/ai";

export type VerdictTone = "good" | "warn" | "bad";

export type VerdictView = {
  status: VerdictDto["status"];
  tone: VerdictTone;
  label: string;
  reasons: string[];
  /** "redo": jump to the answer to redo; "practice": go back to the situations. */
  action: { kind: "redo" | "practice"; label: string };
  disclaimer: string;
};

const LABEL: Record<ExplainLang, Record<VerdictDto["status"], string>> = {
  en: { ready: "Ready", almost: "Almost ready", not_yet: "Not ready yet" },
  fr: { ready: "Prêt", almost: "Presque prêt", not_yet: "Pas encore prêt" },
};

const TONE: Record<VerdictDto["status"], VerdictTone> = { ready: "good", almost: "warn", not_yet: "bad" };

/** One sentence per metric and traffic light. `n` is the value, already formatted. */
const REASON: Record<ExplainLang, Record<VerdictMetric, Record<SentenceStatus, (n: string) => string>>> = {
  en: {
    mistakes_per_100: {
      green: (n) => `Only ${n} mistakes per 100 words.`,
      orange: (n) => `${n} mistakes per 100 words: a few small fixes to make.`,
      red: (n) => `${n} mistakes per 100 words: too many to be ready.`,
    },
    words_per_answer: {
      green: (n) => `Your answers are developed (${n} words on average).`,
      orange: (n) => `Your answers are a little short (${n} words on average).`,
      red: (n) => `Your answers are too short (${n} words on average): add a reason and an example.`,
    },
    hesitations_per_min: {
      green: (n) => `You spoke smoothly (${n} hesitations per minute).`,
      orange: (n) => `${n} hesitations per minute: take a breath instead of filling the silence.`,
      red: (n) => `${n} hesitations per minute: pause and think, then speak.`,
    },
  },
  fr: {
    mistakes_per_100: {
      green: (n) => `Seulement ${n} erreurs pour 100 mots.`,
      orange: (n) => `${n} erreurs pour 100 mots : quelques petites corrections à faire.`,
      red: (n) => `${n} erreurs pour 100 mots : c'est trop pour être prêt.`,
    },
    words_per_answer: {
      green: (n) => `Tes réponses sont développées (${n} mots en moyenne).`,
      orange: (n) => `Tes réponses sont un peu courtes (${n} mots en moyenne).`,
      red: (n) => `Tes réponses sont trop courtes (${n} mots en moyenne) : ajoute une raison et un exemple.`,
    },
    hesitations_per_min: {
      green: (n) => `Tu as parlé avec aisance (${n} hésitations par minute).`,
      orange: (n) => `${n} hésitations par minute : respire plutôt que de remplir le silence.`,
      red: (n) => `${n} hésitations par minute : fais une pause pour réfléchir, puis parle.`,
    },
  },
};

const ACTION: Record<ExplainLang, { redo: string; practice: string; next: string }> = {
  en: { redo: "Redo your weakest answer", practice: "Practice again", next: "Try another situation" },
  fr: { redo: "Refais ta réponse la plus faible", practice: "Pratiquer encore", next: "Essayer une autre situation" },
};

const DISCLAIMER: Record<ExplainLang, string> = {
  en: "A check on this practice, not a promise about the real interview.",
  fr: "Un point sur cet entraînement, pas une promesse pour le vrai entretien.",
};

const NO_VERDICT: Record<ExplainLang, string> = {
  en: "Answer at least 3 questions to get a verdict.",
  fr: "Réponds à au moins 3 questions pour avoir un verdict.",
};
export const noVerdictText = (lang: ExplainLang) => NO_VERDICT[lang];

/** The card's small title: a real interview speaks of the interview, a practice session of the practice. */
export const verdictTitle = (lang: ExplainLang, mode: FeedbackMode) =>
  lang === "fr" ? (mode === "interview" ? "Verdict de l'entretien" : "Verdict de l'entraînement")
    : mode === "interview" ? "Interview verdict" : "Practice verdict";

/** `redoIndex` is the report's answer to redo first (null for a report opened again later: it is not stored). */
export function verdictView(verdict: VerdictDto, lang: ExplainLang, redoIndex: number | null): VerdictView {
  const action =
    verdict.status !== "ready" && redoIndex !== null
      ? { kind: "redo" as const, label: ACTION[lang].redo }
      : { kind: "practice" as const, label: verdict.status === "ready" ? ACTION[lang].next : ACTION[lang].practice };
  return {
    status: verdict.status,
    tone: TONE[verdict.status],
    label: LABEL[lang][verdict.status],
    reasons: verdict.reasons.map((r) => REASON[lang][r.metric][r.level](formatNumber(r.value))),
    action,
    disclaimer: DISCLAIMER[lang],
  };
}
