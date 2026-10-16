import { ApiError, api, apiStream } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { mapMetrics } from "@/features/progress/api/progress";
import type {
  AiSession, ChatMessage, ReportLine, ReportLineDto, SessionDetailDto, SessionReport, SessionReportDto, SessionStarted,
  SessionStartedDto, SpokenDto, StartSessionDto, Turn, TurnDto,
} from "../types/ai";

export const mapSessionStarted = (s: SessionStartedDto): SessionStarted => ({
  sessionId: s.session_id,
  firstQuestion: s.first_question.text,
  firstQuestionAudio: s.first_question.audio_url,
});

export const mapTurn = (t: TurnDto): Turn => ({
  transcript: t.transcript,
  reply: t.reply,
  corrections: t.corrections,
  sentenceStatus: t.sentence_status,
  finished: t.finished,
  audioUrl: t.reply_audio_url ?? null,
  credits: t.credits,
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

/** explain_lang is left out so the API uses the profile preference. In a voice session the first question is spoken. */
export const startSession = (scenarioId: string, mode: StartSessionDto["mode"] = "text") => {
  const body: StartSessionDto = { scenario_id: scenarioId, mode };
  return api.post<SessionStartedDto>(endpoints.ai.sessions, body).then(mapSessionStarted);
};

/** Answer without streaming (JSON). The chat uses streamAnswer; kept for scripts and tests. */
export const sendAnswer = (sessionId: string, text: string) => {
  const form = new FormData();
  form.append("text", text);
  return api.post<TurnDto>(endpoints.ai.turn(sessionId), form).then(mapTurn);
};

export const endSession = (sessionId: string) =>
  api.post<SessionReportDto>(endpoints.ai.end(sessionId)).then(mapReport);

export type AnswerInput = { text: string } | { audio: Blob };

/** What is known so far about an answer being processed (Server-Sent Events from POST /turn). */
export type LiveTurn = { transcript?: string; reply?: string; corrections?: Turn["corrections"]; status?: Turn["sentenceStatus"] };

/**
 * One answer, typed or spoken, read as a stream: `onLive` gets the transcript, the coach's text and the corrections
 * as soon as they exist, `onAudio` the coach's voice; resolves with the saved turn (the "done" event).
 */
export async function streamAnswer(
  sessionId: string,
  input: AnswerInput,
  onLive: (update: LiveTurn) => void,
  onAudio: (url: string | null, reply: string) => void,
): Promise<Turn> {
  const form = new FormData();
  if ("text" in input) form.append("text", input.text);
  else form.append("audio", input.audio, "recording.webm");
  let reply = "";
  let audioUrl: string | null = null;
  let done: TurnDto | null = null;
  let error: ApiError | null = null;
  await apiStream(endpoints.ai.turn(sessionId), form, (name, data) => {
    if (name === "transcript") onLive({ transcript: data.text });
    else if (name === "reply") { reply = data.text; onLive({ reply }); }
    else if (name === "corrections") onLive({ corrections: data.corrections, status: data.sentence_status });
    else if (name === "audio") { audioUrl = data.audio_url; onAudio(audioUrl, reply); }
    else if (name === "done") done = { ...data, reply_audio_url: audioUrl ?? data.reply_audio_url ?? null };
    else if (name === "error") error = new ApiError(data.detail, data.status, data);
  });
  if (error) throw error;
  if (!done) throw new ApiError("The answer was interrupted. Send it again.", 0);
  return mapTurn(done);
}

export const speakLastLine = (sessionId: string) => api.post<SpokenDto>(endpoints.ai.speak(sessionId));
