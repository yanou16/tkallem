import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { Phrase, PhraseDto } from "../types/phrases";

export const mapPhrase = (p: PhraseDto): Phrase => ({
  sessionId: p.session_id,
  scenarioId: p.scenario_id,
  title: p.title,
  startedAt: p.started_at,
  turn: p.turn,
  original: p.original,
  corrected: p.corrected,
  corrections: p.corrections,
});

/** The student's corrected answers from all their sessions, newest first (the API accepts 1 to 100). */
export const getPhrases = (limit = 50) =>
  api.get<PhraseDto[]>(endpoints.myCorrections, { query: { limit } }).then((list) => list.map(mapPhrase));
