import { afterEach, describe, expect, it, vi } from "vitest";
import { endSession, mapReport, mapTurn, sendAnswer, startSession } from "./ai";
import type { SessionReportDto, TurnDto } from "../types/ai";

const TURN: TurnDto = {
  transcript: "I go to the US for study.",
  reply: "Good. Which university will you attend?",
  reply_audio_url: null,
  corrections: [{ original: "for study", fixed: "to study", type: "grammar", why: "Le but : to + verbe." }],
  sentence_status: "orange",
  finished: false,
};

const REPORT: SessionReportDto = {
  lines: [
    { role: "coach", text: "What is the purpose of your trip?", status: null, corrections: [] },
    { role: "student", text: "I go to the US for study.", status: "orange", corrections: TURN.corrections },
  ],
  note: "Honest note.",
  metrics: { mistakes_per_100: 14.3, words_per_answer: 7, hesitations_per_min: null, speaking_seconds: null },
  levels: { mistakes_per_100: "red", words_per_answer: "orange", hesitations_per_min: null },
  redo_index: 1,
};

function serverReplies(body: unknown) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(body)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("mapTurn", () => {
  it("converts the coach reply, corrections, status and finished flag", () => {
    expect(mapTurn(TURN)).toEqual({
      transcript: "I go to the US for study.",
      reply: "Good. Which university will you attend?",
      corrections: TURN.corrections,
      sentenceStatus: "orange",
      finished: false,
    });
  });
});

describe("mapReport", () => {
  it("converts lines, metrics, levels and the answer to redo", () => {
    const report = mapReport(REPORT);

    expect(report.lines[1]).toEqual({ role: "student", text: "I go to the US for study.", status: "orange", corrections: TURN.corrections });
    expect(report.note).toBe("Honest note.");
    expect(report.metrics).toEqual({ mistakesPer100: 14.3, wordsPerAnswer: 7, hesitationsPerMin: null, speakingSeconds: null });
    expect(report.levels).toEqual({ mistakesPer100: "red", wordsPerAnswer: "orange", hesitationsPerMin: null });
    expect(report.redoIndex).toBe(1);
  });
});

describe("session calls", () => {
  it("starts a text session and lets the API pick the explanation language", async () => {
    const fetchMock = serverReplies({ session_id: "s1", first_question: { text: "What is the purpose of your trip?", audio_url: null } });

    const started = await startSession("visa-us");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/sessions$/);
    expect(JSON.parse(String(init.body))).toEqual({ scenario_id: "visa-us", mode: "text" });
    expect(started).toEqual({ sessionId: "s1", firstQuestion: "What is the purpose of your trip?" });
  });

  it("sends an answer as the form field `text`", async () => {
    const fetchMock = serverReplies(TURN);

    const turn = await sendAnswer("s1", "I go to the US for study.");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/sessions\/s1\/turn$/);
    expect((init.body as FormData).get("text")).toBe("I go to the US for study.");
    expect(turn.sentenceStatus).toBe("orange");
  });

  it("ends the session and returns the report", async () => {
    const fetchMock = serverReplies(REPORT);

    const report = await endSession("s1");

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/sessions\/s1\/end$/);
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(report.redoIndex).toBe(1);
  });
});
