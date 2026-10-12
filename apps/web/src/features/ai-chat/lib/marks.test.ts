import { describe, expect, it } from "vitest";
import { markSentence } from "./marks";
import type { Correction } from "../types/ai";

const fix = (original: string, fixed: string): Correction => ({ original, fixed, type: "grammar", why: "x" });
const join = (pieces: { text: string }[]) => pieces.map((p) => p.text).join("");

describe("markSentence", () => {
  it("marks the wrong words and the fixed words in place", () => {
    const { before, after, unplaced } = markSentence("I go to the US for study.", [fix("for study", "to study")]);
    expect(join(before)).toBe("I go to the US for study.");
    expect(join(after)).toBe("I go to the US to study.");
    expect(before.find((p) => p.kind === "wrong")?.text).toBe("for study");
    expect(after.find((p) => p.kind === "fixed")?.text).toBe("to study");
    expect(unplaced).toEqual([]);
  });

  it("handles several corrections in sentence order, whatever their order in the list", () => {
    const { after } = markSentence("Yesterday I go to embassy.", [fix("embassy", "the embassy"), fix("I go", "I went")]);
    expect(join(after)).toBe("Yesterday I went to the embassy.");
  });

  it("finds the words whatever their case", () => {
    const { after } = markSentence("My Family support me.", [fix("family support", "family supports")]);
    expect(join(after)).toBe("My family supports me.");
  });

  it("keeps a correction it cannot place apart instead of breaking the sentence", () => {
    const { before, unplaced } = markSentence("I am fine.", [fix("not here", "elsewhere")]);
    expect(join(before)).toBe("I am fine.");
    expect(unplaced).toHaveLength(1);
  });
});
