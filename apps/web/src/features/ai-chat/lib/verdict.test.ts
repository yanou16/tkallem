import { describe, expect, it } from "vitest";
import type { VerdictDto } from "../types/ai";
import { noVerdictText, verdictTitle, verdictView } from "./verdict";

const NOT_YET: VerdictDto = {
  status: "not_yet",
  reasons: [
    { metric: "mistakes_per_100", level: "red", value: 16.7 },
    { metric: "words_per_answer", level: "orange", value: 6 },
  ],
};
const READY: VerdictDto = {
  status: "ready",
  reasons: [
    { metric: "mistakes_per_100", level: "green", value: 2 },
    { metric: "hesitations_per_min", level: "green", value: 1.2 },
  ],
};

describe("verdictView", () => {
  it("says the status and the two reasons, with the numbers of the report", () => {
    const v = verdictView(NOT_YET, "en", 2);
    expect(v.label).toBe("Not ready yet");
    expect(v.tone).toBe("bad");
    expect(v.reasons).toEqual(["16.7 mistakes per 100 words: too many to be ready.", "Your answers are a little short (6 words on average)."]);
  });

  it("writes the same verdict in French", () => {
    const v = verdictView(NOT_YET, "fr", 2);
    expect(v.label).toBe("Pas encore prêt");
    expect(v.reasons[0]).toBe("16.7 erreurs pour 100 mots : c'est trop pour être prêt.");
  });

  it("points to the answer to redo when there is one, and to the situations when there is none", () => {
    expect(verdictView(NOT_YET, "en", 2).action).toEqual({ kind: "redo", label: "Redo your weakest answer" });
    expect(verdictView(NOT_YET, "en", null).action).toEqual({ kind: "practice", label: "Practice again" });
  });

  it("sends a ready student to another situation, not back to the same answer", () => {
    const v = verdictView(READY, "en", 1);
    expect(v.label).toBe("Ready");
    expect(v.tone).toBe("good");
    expect(v.action).toEqual({ kind: "practice", label: "Try another situation" });
    expect(v.reasons[1]).toBe("You spoke smoothly (1.2 hesitations per minute).");
  });

  it("never promises the real interview", () => {
    expect(verdictView(READY, "en", null).disclaimer).toMatch(/not a promise/);
    expect(verdictView(READY, "fr", null).disclaimer).toMatch(/pas une promesse/);
  });

  it("tells a student with too few answers what is missing", () => {
    expect(noVerdictText("en")).toMatch(/at least 3/);
    expect(noVerdictText("fr")).toMatch(/au moins 3/);
  });

  it("names the card after the interview or the practice", () => {
    expect(verdictTitle("en", "interview")).toBe("Interview verdict");
    expect(verdictTitle("en", "practice")).toBe("Practice verdict");
    expect(verdictTitle("fr", "practice")).toBe("Verdict de l'entraînement");
  });
});
