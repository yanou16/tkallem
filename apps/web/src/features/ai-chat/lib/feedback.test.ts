import { describe, expect, it } from "vitest";
import { feedbackView } from "./feedback";
import type { Correction } from "../types/ai";

const fix = (original: string, fixed: string): Correction => ({ original, fixed, type: "grammar", why: "x" });
const GO = fix("I go", "I went"), HAVE = fix("he have", "he has"), STUDY = fix("my study", "my studies");

describe("feedbackView", () => {
  it("shows the priority correction in full and folds the others", () => {
    const v = feedbackView([GO, HAVE, STUDY], 1);
    expect(v.priority).toBe(HAVE);
    expect(v.others).toEqual([GO, STUDY]);
    expect(v.moreLabel).toBe("2 more small fixes");
  });

  it("says 1 more small fix, and nothing to fold for a single correction", () => {
    expect(feedbackView([GO, HAVE]).moreLabel).toBe("1 more small fix");
    expect(feedbackView([GO])).toEqual({ priority: GO, others: [], moreLabel: "" });
  });

  it("falls back to the first correction when the priority index is out of range", () => {
    expect(feedbackView([GO, HAVE], 5).priority).toBe(GO);
    expect(feedbackView([GO, HAVE], -1).priority).toBe(GO);
  });

  it("has nothing to show for a clean answer", () => {
    expect(feedbackView([])).toEqual({ priority: null, others: [], moreLabel: "" });
  });
});
