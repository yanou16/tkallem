import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { mapMetrics } from "@/features/progress/api/progress";
import type {
  ReportLineDto, SessionReport, SessionReportDto, SessionStarted, SessionStartedDto, StartSessionDto, Turn, TurnDto,
} from "../types/ai";

export const mapSessionStarted = (s: SessionStartedDto): SessionStarted => ({
  sessionId: s.session_id,
  firstQuestion: s.first_question.text,
});

export const mapTurn = (t: TurnDto): Turn => ({
  transcript: t.transcript,
  reply: t.reply,
  corrections: t.corrections,
  sentenceStatus: t.sentence_status,
  finished: t.finished,
});

const mapReportLine = (l: ReportLineDto) => ({ role: l.role, text: l.text, status: l.status, corrections: l.corrections });

export const mapReport = (r: SessionReportDto): SessionReport => ({
  lines: r.lines.map(mapReportLine),
  note: r.note,
  metrics: mapMetrics(r.metrics),
  levels: {
    mistakesPer100: r.levels.mistakes_per_100,
    wordsPerAnswer: r.levels.words_per_answer,
    hesitationsPerMin: r.levels.hesitations_per_min,
  },
  redoIndex: r.redo_index,
});

/** Text sessions only for now. explain_lang is left out so the API uses the profile preference. */
export const startSession = (scenarioId: string) => {
  const body: StartSessionDto = { scenario_id: scenarioId, mode: "text" };
  return api.post<SessionStartedDto>(endpoints.ai.sessions, body).then(mapSessionStarted);
};

// TODO: voice answers, once POST /sessions/{id}/turn accepts an `audio` file (it only takes `text` for now).
export const sendAnswer = (sessionId: string, text: string) => {
  const form = new FormData();
  form.append("text", text);
  return api.post<TurnDto>(endpoints.ai.turn(sessionId), form).then(mapTurn);
};

export const endSession = (sessionId: string) =>
  api.post<SessionReportDto>(endpoints.ai.end(sessionId)).then(mapReport);
