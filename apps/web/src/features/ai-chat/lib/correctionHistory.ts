import type { ChatMessage, Correction } from "../types/ai";
export type CorrectionEntry = { messageId: string; answerNumber: number; corrections: Correction[] };
/** Session turns are the source of truth: a later clean/pending answer must not erase earlier fixes. */
export function correctionHistory(messages: readonly ChatMessage[]): CorrectionEntry[] {
  let answerNumber = 0;
  return messages.flatMap((message) => {
    if (message.role !== "user" || message.pending) return [];
    answerNumber += 1;
    return message.corrections?.length ? [{ messageId: message.id, answerNumber, corrections: message.corrections }] : [];
  });
}
