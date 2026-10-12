import { describe, expect, it } from "vitest";
import { repeatView, triesText } from "./repeat";

const base = { heard: "", target: "I go to the US to study.", similarity: 0.9, tries_left: 2 };

describe("repeatView", () => {
  it("celebrates a nailed repetition", () => {
    expect(repeatView({ ...base, nailed: true, missing: [] })).toEqual({ nailed: true, title: "Nailed it", text: "That is the corrected sentence." });
  });

  it("names the corrected words to say, gently", () => {
    expect(repeatView({ ...base, nailed: false, missing: ["to study"] }).text).toBe("Almost. This time, say “to study”.");
    expect(repeatView({ ...base, nailed: false, missing: ["I went", "agree", "the US"] }).text)
      .toBe("Almost. This time, say “I went”, “agree” and “the US”.");
  });

  it("asks for the whole sentence when the fixes were there but too many words differ", () => {
    expect(repeatView({ ...base, nailed: false, missing: [], similarity: 0.5 }).text).toMatch(/whole corrected sentence/);
  });
});

describe("triesText", () => {
  it("counts the tries left and lets the student go on at the end", () => {
    expect(triesText(2)).toBe("2 more tries.");
    expect(triesText(1)).toBe("1 more try.");
    expect(triesText(0)).toMatch(/go on/);
  });
});
