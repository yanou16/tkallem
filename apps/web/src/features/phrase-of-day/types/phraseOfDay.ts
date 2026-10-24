export type PhraseKind = "idiom";

/** GET /phrase-of-the-day: today's phrase (date in Algiers). */
export type PhraseOfDay = { date: string; id: string; kind: PhraseKind; text: string; fr: string; en: string; example: string };

/** POST /phrase-of-the-day/check: what the code decided about the recording. */
export type PhraseChecked = { nailed: boolean; similarity: number; missing: string[]; target: string; heard: string };
