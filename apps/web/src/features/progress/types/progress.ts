/* ---------- GET /me/progress as sent by the API (snake_case, times in seconds) ---------- */
export type ProgressMetricsDto = {
  mistakes_per_100: number | null;
  words_per_answer: number | null;
  hesitations_per_min: number | null;
  speaking_seconds: number | null;
};

export type TopMistakeDto = {
  id: string;
  category: string;
  original: string;
  correction: string;
  count: number;
};

export type ProgressDto = {
  current: ProgressMetricsDto;
  baseline: ProgressMetricsDto | null;
  mistakes_change: number | null;
  top_mistakes: TopMistakeDto[];
  week_speaking_seconds: number;
  today_speaking_seconds: number;
  daily_goal_seconds: number;
  streak_days: number;
};

/* ---------- what the screens use ---------- */
export type ProgressMetrics = {
  mistakesPer100: number | null;
  wordsPerAnswer: number | null;
  /** Needs spoken answers: null in text sessions. */
  hesitationsPerMin: number | null;
  /** Average speaking time per session, in seconds. Needs spoken answers. */
  speakingSeconds: number | null;
};

export type TopMistake = {
  id: string;
  /** The fine-grained rule (verb_tense, preposition...), else the correction type (grammar, vocabulary...). */
  category: string;
  original: string;
  correction: string;
  count: number;
};

export type Progress = {
  /** Recent sessions. Every metric is null before the first finished session. */
  current: ProgressMetrics;
  /** The first sessions, to compare with. Null until there are enough finished sessions. */
  baseline: ProgressMetrics | null;
  /** current minus baseline mistakes per 100 words: negative means fewer mistakes. */
  mistakesChange: number | null;
  topMistakes: TopMistake[];
  weekSpeakingSeconds: number;
  todaySpeakingSeconds: number;
  dailyGoalSeconds: number;
  streakDays: number;
};

/** Labels of the top mistake categories: the 9 rules, then the 4 correction types (used when there is no rule). */
export const MISTAKE_LABELS: Record<string, string> = {
  verb_tense: "Verb tenses",
  subject_verb_agreement: "Subject-verb agreement",
  verb_pattern: "Verb patterns",
  preposition: "Prepositions",
  article: "Articles",
  plural_uncountable: "Plurals and uncountables",
  word_order: "Word order",
  word_form: "Word forms",
  other: "Other",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  word_choice: "Word choice",
};

/** A category the front does not know yet is shown as the API sent it. */
export const mistakeLabel = (category: string) => MISTAKE_LABELS[category] ?? category;
