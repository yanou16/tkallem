import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { mapMetrics } from "@/features/progress/api/progress";
import type {
  AiSession, ChatMessage, ReportLine, ReportLineDto, SessionDetailDto, SessionReport, SessionReportDto, SessionStarted,
  SessionStartedDto, StartSessionDto, Turn, TurnDto,
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

/** Rebuilds the chat from GET /sessions/{id}: the first question, then each answer and the coach reply. */
export function mapSessionDetail(s: SessionDetailDto): AiSession {
  const messages: ChatMessage[] = [];
  const add = (message: Omit<ChatMessage, "id">) => messages.push({ id: `${s.session_id}-${messages.length}`, ...message });
  if (s.first_question) add({ role: "assistant", content: s.first_question });
  for (const t of s.turns) {
    add({ role: "user", content: t.transcript, status: t.sentence_status, corrections: t.corrections });
    add({ role: "assistant", content: t.reply });
  }

  // An ended session shows what /end stored. levels and redo_index are not stored, so they stay empty.
  const lines: ReportLine[] = messages.map((m) => ({
    role: m.role === "user" ? "student" : "coach",
    text: m.content,
    status: m.status ?? null,
    corrections: m.corrections ?? [],
  }));
  const report: SessionReport | undefined =
    s.ended_at && s.metrics
      ? {
          lines,
          note: s.note ?? "",
          metrics: mapMetrics(s.metrics),
          levels: { mistakesPer100: null, wordsPerAnswer: null, hesitationsPerMin: null },
          redoIndex: null,
        }
      : undefined;

  return { id: s.session_id, scenarioId: s.scenario_id, title: s.title, messages, finished: s.finished, report };
}

export const getSession = (sessionId: string) =>
  api.get<SessionDetailDto>(endpoints.ai.session(sessionId)).then(mapSessionDetail);

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
