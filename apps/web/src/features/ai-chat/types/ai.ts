import type { ProgressMetrics, ProgressMetricsDto } from "@/features/progress/types/progress";
import type { Credits } from "@/features/credits/types/credits";

export type Correction = {
  original: string;
  fixed: string;
  type: "grammar" | "vocabulary" | "word_choice" | "other";
  why: string;
};

/** Traffic light of one answer: green clean, orange small fixes, red redo it. */
export type SentenceStatus = "green" | "orange" | "red";

/* ---------- GET /sessions/{id}, POST /sessions, /sessions/{id}/turn and /sessions/{id}/end as sent by the API ---------- */
export type TurnDetailDto = {
  position: number;
  transcript: string;
  reply: string;
  sentence_status: SentenceStatus;
  corrections: Correction[];
};

export type SessionDetailDto = {
  verdict?: VerdictDto | null;
  feedback_mode?: FeedbackMode;
  session_id: string;
  scenario_id: string;
  title: string;
  mode: "text" | "voice";
  started_at: string;
  ended_at: string | null;
  finished: boolean;
  total_questions: number | null;
  /** Null when the scenario no longer exists. */
  first_question: string | null;
  turns: TurnDetailDto[];
  /** What /end stored, null before. levels and redo_index are not stored. */
  note: string | null;
  metrics: ProgressMetricsDto | null;
};

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
  /** Balance after this answer (docs/CREDITS.md). */
  credits?: Credits;
};

/** POST /sessions/{id}/speak: the coach's last line again, spoken (switch to voice in the middle of a session). */
export type SpokenDto = { text: string; audio_url: string | null };

export type ReportLineDto = {
  role: "coach" | "student";
  text: string;
  status: SentenceStatus | null;
  corrections: Correction[];
};

export type SessionReportDto = {
  verdict?: VerdictDto | null;
  feedback_mode?: FeedbackMode;
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
export type SessionStarted = { sessionId: string; firstQuestion: string; firstQuestionAudio: string | null };

export type Turn = {
  /** The student's answer as the API kept it. */
  transcript: string;
  reply: string;
  corrections: Correction[];
  sentenceStatus: SentenceStatus;
  /** Guided scenario: every question is answered, time for the report. Always false in free talk. */
  finished: boolean;
  /** The coach's reply spoken (data: URL), voice sessions and spoken answers only. */
  audioUrl?: string | null;
  credits?: Credits;
};

export type ReportLine = {
  role: "coach" | "student";
  text: string;
  status: SentenceStatus | null;
  corrections: Correction[];
};

export type SessionReport = {
  verdict?: VerdictDto | null;
  feedbackMode?: FeedbackMode;
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
  /** Unknown for a reloaded session: the API does not send the time of each turn. */
  createdAt?: string;
  /** Student answers only. */
  status?: SentenceStatus;
  corrections?: Correction[];
  /** Coach lines spoken by the server (data: URL), for the Listen button. */
  audioUrl?: string | null;
  /** Shown at once while the answer is processed (a recording not transcribed yet). */
  pending?: boolean;
};

export type AiSession = {
  confidence?: { before: number | null; after: number | null };
  id: string;
  scenarioId: string;
  /** From GET /sessions/{id}; a new session takes its title from the scenario list. */
  title?: string;
  messages: ChatMessage[];
  finished: boolean;
  /** Set once the session is ended. For a reloaded session, only what the API stored (no levels, no redo). */
  report?: SessionReport;
};

/** "Help me start" (POST /sessions/{id}/hint). A translation refused by the code comes back as the scenario's starter. */
export type HintRequestDto = { type: "starter" } | { type: "translate"; text: string };
/** "Say it again" (POST /sessions/{id}/repeat): judged by code on the server, never by the model. */
export type RepeatDto = {
  nailed: boolean; heard: string; target: string; missing: string[]; similarity: number; tries_left: number;
};
/** Freeze meter: the time before starting to answer, averaged by the server (POST /end, GET /sessions/{id}). */
export type FreezeDto = { seconds: number; answers: number; kind: "voice" | "text" | "mixed"; previous?: number | null };
export type HintDto = { kind: "starter" | "translation"; lines: string[]; fallback: boolean; remaining: number };

export type FeedbackMode = "practice" | "interview";
export type VerdictMetric = "mistakes_per_100" | "words_per_answer" | "hesitations_per_min";
export type VerdictDto = {
  status: "ready" | "almost" | "not_yet";
  /** The level the practice was judged at (the session's): the same numbers mean less at A2 than at C1. */
  level: "A2" | "B1" | "B2" | "C1";
  reasons: { metric: VerdictMetric; level: SentenceStatus; value: number }[];
};
