import { describe, expect, it } from "vitest";
import { NUDGE_AFTER_MS, hintView, remainingText, shouldNudge } from "./hint";

const idle = { questionShownAt: 1000, now: 1000 + NUDGE_AFTER_MS, typing: false, recording: false, busy: false };

describe("shouldNudge", () => {
  it("highlights the button 5 seconds after the question when the student has not started", () => {
    expect(shouldNudge(idle)).toBe(true);
    expect(shouldNudge({ ...idle, now: idle.now - 1 })).toBe(false);
  });

  it("stays quiet while the student types or records, while the coach talks, and with no question", () => {
    expect(shouldNudge({ ...idle, typing: true })).toBe(false);
    expect(shouldNudge({ ...idle, recording: true })).toBe(false);
    expect(shouldNudge({ ...idle, busy: true })).toBe(false);
    expect(shouldNudge({ ...idle, questionShownAt: null })).toBe(false);
  });
});

describe("hintView", () => {
  it("shows starters with an ellipsis, each one ready to go in the answer field", () => {
    const v = hintView({ kind: "starter", lines: ["The main purpose of my trip is to", "I am going to"], fallback: false, remaining: 1 }, "starter");
    expect(v.lines).toEqual(["The main purpose of my trip is to…", "I am going to…"]);
    expect(v.fills).toEqual(["The main purpose of my trip is to ", "I am going to "]);
    expect(v.title).toBe("You can start with:");
  });

  it("shows the English version of the student's idea as is", () => {
    const v = hintView({ kind: "translation", lines: ["My father will pay for my studies."], fallback: false, remaining: 1 }, "translate");
    expect(v.lines).toEqual(["My father will pay for my studies."]);
    expect(v.fills).toEqual(["My father will pay for my studies."]);
  });

  it("says so when a translation was refused and a starter came back instead", () => {
    const v = hintView({ kind: "starter", lines: ["My studies will be paid by"], fallback: true, remaining: 0 }, "translate");
    expect(v.title).toMatch(/could not turn this into English/);
    expect(v.lines).toEqual(["My studies will be paid by…"]);
  });
});

describe("remainingText", () => {
  it("counts the hints left for this question", () => {
    expect(remainingText(1)).toBe("1 more hint for this question.");
    expect(remainingText(0)).toBe("No more hints for this question.");
  });
});
