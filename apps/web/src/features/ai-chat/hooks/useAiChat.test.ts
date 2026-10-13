import { describe, expect, it } from "vitest";
import { addTurn } from "./useAiChat";
import type { AiSession, Turn } from "../types/ai";

const AT = "2026-10-10T10:00:00.000Z";

const STARTED: AiSession = {
  id: "s1",
  scenarioId: "visa-us",
  finished: false,
  messages: [{ id: "s1-0", role: "assistant", content: "What is the purpose of your trip?", createdAt: AT }],
};

const TURN: Turn = {
  transcript: "I go to the US for study.",
  reply: "Good. Which university will you attend?",
  corrections: [{ original: "for study", fixed: "to study", type: "grammar", why: "Le but : to + verbe." }],
  sentenceStatus: "orange",
  praise: "Clear goal: 'I go to the US'.",
  priorityIndex: 0,
  finished: false,
};

describe("addTurn", () => {
  it("adds the student's answer with its status and corrections, then the coach reply", () => {
    const session = addTurn(STARTED, TURN, AT);

    expect(session.messages).toEqual([
      STARTED.messages[0],
      { id: "s1-1", role: "user", content: "I go to the US for study.", createdAt: AT, status: "orange", corrections: TURN.corrections, praise: TURN.praise, priorityIndex: 0 },
      { id: "s1-2", role: "assistant", content: "Good. Which university will you attend?", createdAt: AT },
    ]);
    expect(session.finished).toBe(false);
  });

  it("marks the session finished after the last question", () => {
    expect(addTurn(STARTED, { ...TURN, finished: true }, AT).finished).toBe(true);
  });

  it("does not change the previous session", () => {
    addTurn(STARTED, TURN, AT);

    expect(STARTED.messages).toHaveLength(1);
  });
});
