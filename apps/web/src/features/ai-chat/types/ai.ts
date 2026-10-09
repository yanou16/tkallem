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
  createdAt: string;
};

export type AiSession = {
  id: string;
  scenarioId?: string;
  scenarioTitle?: string;
  messages: ChatMessage[];
  corrections: Correction[];
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
  sentence_status: "green" | "orange" | "red";
};

export type VoiceState = "idle" | "recording" | "uploading" | "processing" | "speaking" | "error";
