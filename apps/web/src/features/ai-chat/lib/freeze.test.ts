import { describe, expect, it } from "vitest";
import { freezeView, thinkSeconds } from "./freeze";

describe("thinkSeconds", () => {
  it("is the wait between the question being done and the first sound or letter", () => {
    expect(thinkSeconds(1000, 10_400)).toBe(9.4);
    expect(thinkSeconds(5000, 5000)).toBe(0);
  });

  it("is not measured without both moments, and never negative", () => {
    expect(thinkSeconds(null, 4000)).toBeUndefined();
    expect(thinkSeconds(4000, null)).toBeUndefined();
    expect(thinkSeconds(9000, 4000)).toBe(0); // typed while the coach was still speaking
  });
});

describe("freezeView", () => {
  const base = { seconds: 3, answers: 4, kind: "voice" as const, previous: null };

  it("names the kind of answer", () => {
    expect(freezeView(base).title).toBe("Time before you speak");
    expect(freezeView({ ...base, kind: "text" }).title).toBe("Time before you write");
    expect(freezeView({ ...base, kind: "mixed" }).title).toBe("Time before you answer");
  });

  it("says what went down since last time, and stays neutral when it did not", () => {
    expect(freezeView({ ...base, seconds: 3.4, previous: 9 })).toEqual({ title: "Time before you speak", value: "3.4 s on average", note: "Down from 9 s last time." });
    expect(freezeView({ ...base, seconds: 8, previous: 5 }).note).toBe("Last time: 5 s.");
  });

  it("counts the answers when there is nothing to compare with", () => {
    expect(freezeView(base).note).toBe("Measured on 4 answers.");
    expect(freezeView({ ...base, answers: 1 }).note).toBe("Measured on 1 answer.");
  });
});
