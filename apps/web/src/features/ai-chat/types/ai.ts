import type { Credits } from "@/features/credits/types/credits";
export type Correction = {
  original: string;
  fixed: string;
  type: "grammar" | "vocabulary" | "word_choice" | "other";
  why: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string; // absent for messages reloaded from the server (no time is stored per line)
  status?: SentenceStatus;
  audioUrl?: string | null; // coach lines spoken by the server (data: URL), for the replay button
  pending?: boolean; // shown at once while the answer is processed, replaced by the real lines
};

export type SentenceStatus = "green" | "orange" | "red";

export type AiSession = {
  id: string;
  scenarioId?: string;
  scenarioTitle?: string;
  messages: ChatMessage[];
  corrections: Correction[];
  finished?: boolean; // every question answered: offer the report
  ended?: boolean; // the report was made: no more answers
};

/** GET /sessions/{id} */
export type SessionDetail = {
  session_id: string;
  scenario_id: string;
  title: string;
  mode: "text" | "voice";
  lines: { role: "coach" | "student"; text: string; status?: SentenceStatus | null; corrections: Correction[] }[];
  finished: boolean;
  ended: boolean;
};

/** POST /sessions/{id}/end */
export type SessionReport = {
  lines: { role: "coach" | "student"; text: string; status?: SentenceStatus | null; corrections: Correction[] }[];
  note: string;
  metrics: { mistakes_per_100: number | null; words_per_answer: number | null; hesitations_per_min: number | null; speaking_seconds: number | null };
  levels: { mistakes_per_100: SentenceStatus | null; words_per_answer: SentenceStatus | null; hesitations_per_min: SentenceStatus | null };
  redo_index: number | null;
};

export type StartSessionInput = {
  scenario_id: string;
  mode?: "text" | "voice";
  explain_lang?: "en" | "fr";
};

export type StartSessionResponse = {
  session_id: string;
  first_question: {
    text: string;
    audio_url: string | null;
  };
};

export type TurnResponse = {
  transcript: string;
  reply: string;
  reply_audio_url: string | null;
  corrections: Correction[];
  sentence_status: SentenceStatus;
  finished?: boolean;
  credits?: Credits; // balance after this answer
};

export type Spoken = { text: string; audio_url: string | null };
