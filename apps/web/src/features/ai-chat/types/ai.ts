import type { ProgressMetrics, ProgressMetricsDto } from "@/features/progress/types/progress";

export type Correction = {
  original: string;
  fixed: string;
  type: "grammar" | "vocabulary" | "word_choice" | "other";
  why: string;
};

/** Traffic light of one answer: green clean, orange small fixes, red redo it. */
export type SentenceStatus = "green" | "orange" | "red";

/* ---------- POST /sessions, /sessions/{id}/turn and /sessions/{id}/end as sent by the API ---------- */
export type StartSessionDto = {
  scenario_id: string;
  mode: "text" | "voice";
  /** Omitted: the API uses the student's profile preference. */
  explain_lang?: "en" | "fr";
};

export type SessionStartedDto = {
  session_id: string;
  first_question: { text: string; audio_url: string | null };
};

export type TurnDto = {
  transcript: string;
  reply: string;
  reply_audio_url: string | null;
  corrections: Correction[];
  sentence_status: SentenceStatus;
  finished: boolean;
};

export type ReportLineDto = {
  role: "coach" | "student";
  text: string;
  status: SentenceStatus | null;
  corrections: Correction[];
};

export type SessionReportDto = {
  lines: ReportLineDto[];
  note: string;
  metrics: ProgressMetricsDto;
  levels: {
    mistakes_per_100: SentenceStatus | null;
    words_per_answer: SentenceStatus | null;
    hesitations_per_min: SentenceStatus | null;
  };
  redo_index: number | null;
};

/* ---------- what the chat uses ---------- */
export type SessionStarted = { sessionId: string; firstQuestion: string };

export type Turn = {
  /** The student's answer as the API kept it. */
  transcript: string;
  reply: string;
  corrections: Correction[];
  sentenceStatus: SentenceStatus;
  /** Guided scenario: every question is answered, time for the report. Always false in free talk. */
  finished: boolean;
};

export type ReportLine = {
  role: "coach" | "student";
  text: string;
  status: SentenceStatus | null;
  corrections: Correction[];
};

export type SessionReport = {
  lines: ReportLine[];
  note: string;
  metrics: ProgressMetrics;
  /** Traffic light per metric, null when the metric is not available (hesitations in text mode). */
  levels: {
    mistakesPer100: SentenceStatus | null;
    wordsPerAnswer: SentenceStatus | null;
    hesitationsPerMin: SentenceStatus | null;
  };
  /** Index in `lines` of the answer to redo first. */
  redoIndex: number | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  /** Student answers only. */
  status?: SentenceStatus;
  corrections?: Correction[];
};

export type AiSession = {
  id: string;
  scenarioId: string;
  messages: ChatMessage[];
  finished: boolean;
  /** Set once the session is ended. */
  report?: SessionReport;
};
