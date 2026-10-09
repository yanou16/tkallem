export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  audioUrl?: string;
};

export type Correction = {
  id: string;
  kind: "grammar" | "phrasing";
  original: string;
  improved: string;
  explanation?: string;
  saved?: boolean;
};

export type VocabularyItem = { id: string; word: string; meaning?: string };

export type AiSession = {
  id: string;
  scenarioId?: string;
  scenarioTitle?: string;
  scenarioIcon?: string;
  level?: string;
  messages: ChatMessage[];
  corrections: Correction[];
  vocabulary: VocabularyItem[];
  savedMistakesCount: number;
};

export type SendMessageInput = { sessionId: string; message: string; mode: "text" | "voice" };
export type SendMessageResponse = {
  userMessage?: ChatMessage;
  message: ChatMessage;
  corrections?: Correction[];
  newVocabulary?: VocabularyItem[];
};

export type VoiceState = "idle" | "recording" | "uploading" | "processing" | "speaking" | "error";
