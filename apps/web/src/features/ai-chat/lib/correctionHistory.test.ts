import { describe, expect, it } from "vitest";
import { correctionHistory } from "./correctionHistory";
import { applyVoiceCorrection, type VoiceCorrection } from "./voiceCorrection";
import { mapSessionDetail } from "../api/ai";
import type { AiSession, ChatMessage, Correction, SessionDetailDto } from "../types/ai";

const correction: Correction = { original: "goed", fixed: "went", why: "Go has the irregular past went.", type: "grammar" };
const checked: ChatMessage = { id: "checked", role: "user", content: "I goed", status: "orange", corrections: [correction] };
const session: AiSession = { id: "s", scenarioId: "free-talk", finished: false, messages: [checked] };

describe("session correction history", () => {
  it("keeps earlier errors after a clean answer or a provisional voice transcript", () => {
    const messages: ChatMessage[] = [checked,
      { id: "reply", role: "assistant", content: "And then?" },
      { id: "clean", role: "user", content: "I went home.", status: "green", corrections: [] },
      { id: "provisional", role: "user", content: "I am speaking" },
    ];
    expect(correctionHistory(messages)).toEqual([{ messageId: "checked", answerNumber: 1, corrections: [correction] }]);
  });
  it("keeps every explanation and groups corrections by their answer", () => {
    const second = { ...correction, original: "a books", fixed: "a book", why: "Use a singular noun after a." };
    expect(correctionHistory([checked, { ...checked, id: "second", corrections: [correction, second] }]))
      .toEqual([{ messageId: "checked", answerNumber: 1, corrections: [correction] },
        { messageId: "second", answerNumber: 2, corrections: [correction, second] }]);
  });
  it("accumulates voice errors without duplicating repeated events", () => {
    const turn: VoiceCorrection = { utterance_id: "u2", original: "I goed", reply: "Where?", sentence_status: "orange", corrections: [correction] };
    const updated = applyVoiceCorrection(session, turn);
    expect(correctionHistory(applyVoiceCorrection(updated, turn).messages)).toHaveLength(2);
    const clean = applyVoiceCorrection(updated, { ...turn, utterance_id: "u3", original: "I went home", corrections: [], sentence_status: "green" });
    expect(correctionHistory(clean.messages)).toEqual(correctionHistory(updated.messages));
  });
  it("rebuilds corrections and explanations from the persisted session response", () => {
    const stored: SessionDetailDto = { session_id: "s", scenario_id: "free-talk", title: "Free talk", mode: "voice",
      started_at: "2026-10-21T00:00:00Z", ended_at: null, finished: false, total_questions: null,
      first_question: "How was your day?", note: null, metrics: null, turns: [
        { position: 0, transcript: "I goed", reply: "Where?", sentence_status: "orange", corrections: [correction] },
        { position: 1, transcript: "Home", reply: "Okay.", sentence_status: "green", corrections: [] },
      ] };
    const restored = mapSessionDetail(JSON.parse(JSON.stringify(stored)));
    expect(correctionHistory(restored.messages)[0]).toMatchObject({ answerNumber: 1, corrections: [correction] });
  });
  it("does not invent errors for empty or unchecked answers", () => {
    expect(correctionHistory([])).toEqual([]);
    expect(correctionHistory([{ ...checked, corrections: undefined }, { ...checked, pending: true }])).toEqual([]);
  });
});
