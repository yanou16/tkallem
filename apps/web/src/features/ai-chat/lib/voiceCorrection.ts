import type { AiSession, Correction, SentenceStatus } from "../types/ai";

export type VoiceCorrection = {
  utterance_id?: string;
  original: string;
  reply: string;
  sentence_status: SentenceStatus;
  corrections: Correction[];
};

/** Replace the provisional transcript with the server's checked answer, rather than showing a second answer. */
export function applyVoiceCorrection(session: AiSession, turn: VoiceCorrection): AiSession {
  const id = turn.utterance_id ? `voice-${turn.utterance_id}` : `${session.id}-${session.messages.length}`;
  if (turn.utterance_id && session.messages.some((m) => m.id === id)) return session;
  const lastUser = session.messages.findLastIndex((m) => m.role === "user");
  const provisional = lastUser >= 0 && session.messages[lastUser].status === undefined;
  const messages = provisional ? session.messages.slice(0, lastUser) : session.messages;
  return {
    ...session,
    messages: [
      ...messages,
      { id, role: "user", content: turn.original, status: turn.sentence_status, corrections: turn.corrections },
      { id: `${id}-reply`, role: "assistant", content: turn.reply },
    ],
  };
}
