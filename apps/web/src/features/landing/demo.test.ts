import { describe, expect, it } from "vitest";
import { ANSWERS, CALLOUTS, INITIAL_CHAT, REGIONS, REPORTS, TABS, chatReducer, feedbackFor, nextVoiceState, numbers, stepView } from "./demo";

describe("tabs and captions", () => {
  it("has the four tabs, each with captions on both sides", () => {
    expect(TABS.map((t) => t.id)).toEqual(["web", "phone", "voice", "report"]);
    for (const t of TABS) {
      const sides = new Set(CALLOUTS[t.id].map((c) => c.side));
      expect(sides).toEqual(new Set(["left", "right"]));
    }
  });

  it("points every caption at a part the preview renders, with unique ids per tab", () => {
    for (const t of TABS) {
      const ids = CALLOUTS[t.id].map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const c of CALLOUTS[t.id]) expect(REGIONS[t.id]).toContain(c.region);
    }
  });
});

describe("the mini chat", () => {
  it("goes from the question to a help, an answer and Nailed it, in practice", () => {
    let s = chatReducer(INITIAL_CHAT, { type: "help" });
    expect(s.step).toBe("helped");
    s = chatReducer(s, { type: "pick", index: 0 });
    expect(s.step).toBe("answered");
    expect(feedbackFor(s)).toEqual({ kind: "shown", answer: ANSWERS[0] });
    s = chatReducer(s, { type: "nail" });
    expect(s.step).toBe("nailed");
  });

  it("shows nothing during a real interview, no help, no Say it again", () => {
    let s = chatReducer(INITIAL_CHAT, { type: "mode", mode: "interview" });
    expect(chatReducer(s, { type: "help" })).toBe(s);
    s = chatReducer(s, { type: "pick", index: 1 });
    expect(feedbackFor(s)).toEqual({ kind: "hidden" });
    expect(chatReducer(s, { type: "nail" })).toBe(s);
  });

  it("starts over when the mode changes, and keeps the mode on reset", () => {
    const answered = chatReducer(INITIAL_CHAT, { type: "pick", index: 0 });
    expect(chatReducer(answered, { type: "mode", mode: "interview" })).toEqual({ ...INITIAL_CHAT, mode: "interview" });
    expect(chatReducer({ ...answered, mode: "interview" }, { type: "reset" }).mode).toBe("interview");
  });

  it("ignores an unknown answer and folds or unfolds the other fixes", () => {
    expect(chatReducer(INITIAL_CHAT, { type: "pick", index: 9 })).toBe(INITIAL_CHAT);
    expect(chatReducer(INITIAL_CHAT, { type: "fold" }).foldedOpen).toBe(true);
    expect(feedbackFor(INITIAL_CHAT)).toEqual({ kind: "none" });
  });

  it("only offers praise that is about the example answer", () => {
    for (const a of ANSWERS) expect(a.text.toLowerCase()).toContain(a.fix.original.toLowerCase());
  });
});

describe("voice and report previews", () => {
  it("cycles idle, listening, thinking, speaking, idle", () => {
    expect(["idle", "listening", "thinking", "speaking"].map((s) => nextVoiceState(s as never))).toEqual(["listening", "thinking", "speaking", "idle"]);
  });

  it("shows the freeze going down between the first and the third session", () => {
    expect(REPORTS[1].freeze).toBe("9.3 s");
    expect(REPORTS[1].freezeNote).not.toMatch(/average/); // the card already says "average"
    expect(REPORTS[3].freezeNote).toBe("Down from 9.3 s last time.");
  });
});


describe("the guided tour", () => {
  it("shows each part of the web preview already in action", () => {
    const at = (i: number) => stepView("web", i).chat;
    expect(at(0).step).toBe("asking");
    expect(at(2).step).toBe("helped");                       // Help me start
    expect(at(4).step).toBe("answered");                     // the feedback is on screen
    expect(feedbackFor(at(4)).kind).toBe("shown");
    expect(at(5).step).toBe("nailed");                       // Say it again
  });

  it("walks the voice preview through listening, thinking and speaking", () => {
    expect([0, 1, 2, 3].map((i) => stepView("voice", i).voice)).toEqual(["idle", "listening", "thinking", "speaking"]);
  });

  it("stays inside the captions of the tab", () => {
    expect(stepView("web", 99).chat).toEqual(stepView("web", 5).chat);
    expect(stepView("report", -3).report).toBe(3);
  });

  it("numbers the parts in reading order, a shared part keeping its first number", () => {
    expect(numbers("web")).toEqual({ mode: 1, question: 2, help: 3, answer: 4, feedback: 5, again: 6 });
    expect(numbers("phone")).toEqual({ screen: 1, thumb: 3 });
    expect(numbers("voice")).toEqual({ mic: 1, state: 2, transcript: 3 });
  });
});
