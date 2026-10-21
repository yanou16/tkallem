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
export type FeedbackMode = "practice" | "interview";
/** The student's own 1-to-5 answers, before and after (null while not given). */
export type ConfidenceDto = { before: number | null; after: number | null };

/* ---------- GET /sessions/{id}, POST /sessions, /sessions/{id}/turn and /sessions/{id}/end as sent by the API ---------- */
export type TurnDetailDto = {
  position: number;
  transcript: string;
  reply: string;
  sentence_status: SentenceStatus | null;
  corrections: Correction[];
  praise?: string | null;
  priority_index?: number;
};

export type SessionDetailDto = {
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
  feedback_mode?: FeedbackMode;
  confidence?: ConfidenceDto | null;
  metrics: ProgressMetricsDto | null;
  progress?: string | null;
  freeze?: FreezeDto | null;
  verdict?: VerdictDto | null;
};

export type StartSessionDto = {
  scenario_id: string;
  mode: "text" | "voice";
  /** Omitted: the API uses the student's profile preference. */
  explain_lang?: "en" | "fr";
  /** Improvement 3. Omitted: practice. */
  feedback_mode?: FeedbackMode;
};

export type SessionStartedDto = {
  session_id: string;
  first_question: { text: string; audio_url: string | null };
  feedback_mode?: FeedbackMode;
};

export type TurnDto = {
  transcript: string;
  reply: string;
  reply_audio_url: string | null;
  corrections: Correction[];
  sentence_status: SentenceStatus | null;
  /** Improvement 4: one short true positive, checked by the agent's code (null when refused). */
  praise?: string | null;
  priority_index?: number;
  finished: boolean;
  /** Balance after this answer (docs/CREDITS.md). */
  credits?: Credits;
};

/** POST /sessions/{id}/speak: the coach's last line again, spoken (switch to voice in the middle of a session). */
export type SpokenDto = { text: string; audio_url: string | null };

/** "Help me start" (POST /sessions/{id}/hint). A translation refused by the code comes back as the scenario's starter. */
export type HintRequestDto = { type: "starter" } | { type: "translate"; text: string };
/** "Say it again" (POST /sessions/{id}/repeat): judged by code on the server, never by the model. */
export type RepeatDto = {
  nailed: boolean; heard: string; target: string; missing: string[]; similarity: number; tries_left: number;
};
/** Freeze meter: the time before starting to answer, averaged by the server (POST /end, GET /sessions/{id}). */
export type FreezeDto = { seconds: number; answers: number; kind: "voice" | "text" | "mixed"; previous?: number | null };
export type HintDto = { kind: "starter" | "translation"; lines: string[]; fallback: boolean; remaining: number };

export type ReportLineDto = {
  role: "coach" | "student";
  text: string;
  status: SentenceStatus | null;
  corrections: Correction[];
};

export type VerdictMetric = "mistakes_per_100" | "words_per_answer" | "hesitations_per_min";
export type VerdictDto = {
  status: "ready" | "almost" | "not_yet";
  /** The level the practice was judged at (the session's): the same numbers mean less at A2 than at C1. */
  level: "A2" | "B1" | "B2" | "C1";
  reasons: { metric: VerdictMetric; level: SentenceStatus; value: number }[];
};

export type SessionReportDto = {
  lines: ReportLineDto[];
  note: string;
  /** Improvement 4: the report's first line, progress since the last finished session, written by code. */
  progress?: string | null;
  feedback_mode?: FeedbackMode;
  confidence?: ConfidenceDto | null;
  freeze?: FreezeDto | null;
  /** Real interview with at least 3 answers: ready / almost / not yet, computed by the API. */
  verdict?: VerdictDto | null;
  metrics: ProgressMetricsDto;
  levels: {
    mistakes_per_100: SentenceStatus | null;
    words_per_answer: SentenceStatus | null;
    hesitations_per_min: SentenceStatus | null;
  };
  redo_index: number | null;
};

/* ---------- what the chat uses ---------- */
export type SessionStarted = { sessionId: string; firstQuestion: string; firstQuestionAudio: string | null; feedbackMode: FeedbackMode };

export type Turn = {
  /** The student's answer as the API kept it. */
  transcript: string;
  reply: string;
  corrections: Correction[];
  /** Null in a real interview: nothing is shown before the report. */
  sentenceStatus: SentenceStatus | null;
  praise: string | null;
  /** The correction shown in full; the others are folded. */
  priorityIndex: number;
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
  lines: ReportLine[];
  note: string;
  /** Progress since the last finished session (or the starting point), shown before the mistakes. */
  progress: string | null;
  feedbackMode: FeedbackMode;
  confidence: ConfidenceDto;
  /** Time before starting to answer, with the previous session's when comparable. */
  freeze: FreezeDto | null;
  /** Null in practice, with fewer than 3 answers, or before the end. */
  verdict: VerdictDto | null;
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
  /** Student answers only. Null in a real interview (nothing is shown before the report). */
  status?: SentenceStatus | null;
  corrections?: Correction[];
  /** Student answers: a short true positive shown before the corrections, and the correction shown in full. */
  praise?: string | null;
  priorityIndex?: number;
  /** Coach lines spoken by the server (data: URL), for the Listen button. */
  audioUrl?: string | null;
  /** Shown at once while the answer is processed (a recording not transcribed yet). */
  pending?: boolean;
};

export type AiSession = {
  id: string;
  scenarioId: string;
  /** Improvement 3: a real interview shows no feedback before the report. */
  feedbackMode: FeedbackMode;
  confidence: ConfidenceDto;
  /** From GET /sessions/{id}; a new session takes its title from the scenario list. */
  title?: string;
  messages: ChatMessage[];
  finished: boolean;
  /** Set once the session is ended. For a reloaded session, only what the API stored (no levels, no redo). */
  report?: SessionReport;
};
