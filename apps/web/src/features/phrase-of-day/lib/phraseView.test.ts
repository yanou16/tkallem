import { describe, expect, it } from "vitest";
import type { PhraseChecked, PhraseOfDay } from "../types/phraseOfDay";
import { checkView, meaningOf, meaningToggle, otherLang, streakText } from "./phraseView";

const P: PhraseOfDay = { date: "2026-10-29", id: "return-home", kind: "idiom", text: "I plan to return to Algeria after my studies.", fr: "Je prévois de rentrer.", en: "I will come back.", example: "x" };
const MISS: PhraseChecked = { nailed: false, similarity: 0.5, missing: [], target: P.text, heard: "I want to stay in France" };

describe("phrase view", () => {
  it("explains the phrase in the student's language", () => {
    expect(meaningOf(P, "fr")).toBe("Je prévois de rentrer.");
    expect(meaningOf(P, "en")).toBe("I will come back.");
  });

  it("congratulates a phrase said right", () => {
    expect(checkView({ ...MISS, nailed: true, similarity: 1 })).toEqual({ nailed: true, title: "Nailed it", text: "That is today's phrase, said right." });
  });

  it("is gentle on a miss: says what was heard and one thing to do", () => {
    const v = checkView(MISS);
    expect(v.nailed).toBe(false);
    expect(v.title).toBe("Almost");
    expect(v.text).toBe("I heard: “I want to stay in France”. Say the whole phrase, a little slower.");
    expect(checkView({ ...MISS, heard: "  " }).text).toBe("Say the whole phrase, a little slower.");
  });

  it("names the language of the meaning on the button that opens it, and can switch", () => {
    expect(meaningToggle("fr")).toBe("Meaning in French");
    expect(meaningToggle("en")).toBe("Meaning in English");
    expect(otherLang("fr")).toBe("en");
    expect(otherLang("en")).toBe("fr");
  });

  it("writes the streak in days", () => {
    expect(streakText(0)).toBe("");
    expect(streakText(1)).toBe("1 day in a row");
    expect(streakText(5)).toBe("5 days in a row");
  });
});
