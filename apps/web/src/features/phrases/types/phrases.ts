import type { Correction } from "@/features/ai-chat/types/ai";

/** GET /me/corrections item, as sent by the API. */
export type PhraseDto = {
  session_id: string;
  scenario_id: string;
  title: string;
  started_at: string;
  turn: number;
  original: string;
  corrected: string;
  corrections: Correction[];
};

/** One answer of the student that had corrections, to say again. */
export type Phrase = {
  sessionId: string;
  scenarioId: string;
  title: string;
  startedAt: string;
  /** The index "Say it again" takes (0 = first answer of the session). */
  turn: number;
  original: string;
  corrected: string;
  corrections: Correction[];
};
