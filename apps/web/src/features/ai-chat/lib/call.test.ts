import { describe, expect, it } from "vitest";
import type { AiSession, Correction } from "../types/ai";
import { addCoachLine, addHeard, applyCallTurn, callError } from "./call";

const fix: Correction = { original: "for study", fixed: "to study", type: "grammar", why: "to + verb" };
const session = (): AiSession => ({
  id: "s", scenarioId: "visa-us", feedbackMode: "practice", confidence: { before: null, after: null }, finished: false,
  messages: [{ id: "s-0", role: "assistant", content: "What is the purpose of your trip?" }],
});
const turn = (id: string, original = "I go to the US for study.") => ({ utterance_id: id, original, reply: "I see. Which university?", sentence_status: "orange" as const, corrections: [fix] });

describe("call turns on the session", () => {
  it("does not repeat the first question when the coach greets", () => {
    const s = addCoachLine(session(), "What is the purpose of your trip?");
    expect(s.messages).toHaveLength(1);
  });

  it("shows what was heard, then replaces it with the checked answer and the reply", () => {
    let s = addHeard(session(), "I go to the US for study");
    s = addCoachLine(s, "I see. Which university?"); // streamed before the check arrives
    expect(s.messages.map((m) => m.role)).toEqual(["assistant", "user", "assistant"]);
    s = applyCallTurn(s, turn("u1"), false);
    expect(s.messages.map((m) => [m.role, m.content])).toEqual([
      ["assistant", "What is the purpose of your trip?"],
      ["user", "I go to the US for study."],
      ["assistant", "I see. Which university?"],
    ]);
    expect(s.messages[1].corrections).toEqual([fix]);
    expect(s.messages[1].status).toBe("orange");
  });

  it("keeps earlier answers when a second one is heard", () => {
    let s = applyCallTurn(addHeard(session(), "one"), turn("u1", "One."), false);
    s = applyCallTurn(addHeard(s, "two"), turn("u2", "Two."), false);
    expect(s.messages.filter((m) => m.role === "user").map((m) => m.content)).toEqual(["One.", "Two."]);
  });

  it("ignores a turn delivered twice, and a reply that arrives after the check", () => {
    let s = applyCallTurn(addHeard(session(), "x"), turn("u1"), false);
    s = applyCallTurn(s, turn("u1"), false);
    s = addCoachLine(s, "I see. Which university?");
    expect(s.messages).toHaveLength(3);
  });

  it("shows nothing before the report in a real interview", () => {
    const s = applyCallTurn(addHeard(session(), "x"), turn("u1"), true);
    expect(s.messages[1].corrections).toEqual([]);
    expect(s.messages[1].status).toBeNull();
  });

  it("does not mutate the session it was given", () => {
    const before = session();
    addHeard(before, "x");
    applyCallTurn(before, turn("u1"), false);
    expect(before.messages).toHaveLength(1);
  });
});

describe("call errors", () => {
  it("explains a blocked microphone", () => {
    const e = new Error("Permission denied");
    e.name = "NotAllowedError";
    expect(callError(e).kind).toBe("mic-denied");
  });
  it("explains a missing microphone", () => {
    const e = new Error("Requested device not found");
    e.name = "NotFoundError";
    expect(callError(e).message).toMatch(/No microphone/);
  });
  it("explains a timeout and always offers the voice message", () => {
    const e = new Error("x");
    e.name = "CallTimeout";
    expect(callError(e)).toMatchObject({ kind: "timeout" });
    expect(callError(e).message).toMatch(/voice message/i);
  });
  it("tells a guest who is out of answers what to do", () => {
    expect(callError(new Error("You are out of credits."), "no_credits")).toMatchObject({ kind: "no-credits" });
    expect(callError(new Error("x"), "daily_budget_reached").message).toMatch(/tomorrow/);
  });
  it("says the call is switched off", () => {
    expect(callError(new Error("The live call is switched off")).kind).toBe("unavailable");
  });
  it("has a catch-all", () => {
    expect(callError("boom").kind).toBe("other");
  });
});
