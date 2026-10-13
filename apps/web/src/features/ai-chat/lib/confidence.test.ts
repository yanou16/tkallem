import { describe, expect, it } from "vitest";
import { SCALE, confidenceLine, shouldAskBefore } from "./confidence";

describe("confidenceLine", () => {
  it("compares the two answers", () => {
    expect(confidenceLine({ before: 2, after: 4 })).toBe("You feel more confident: 2/5 before, 4/5 now.");
    expect(confidenceLine({ before: 3, after: 3 })).toBe("Confidence: 3/5 before and now.");
    expect(confidenceLine({ before: 4, after: 3 })).toBe("Confidence: 4/5 before, 3/5 now. A hard interview teaches the most.");
  });

  it("says nothing until both answers exist", () => {
    expect(confidenceLine({ before: 2, after: null })).toBeNull();
    expect(confidenceLine({ before: null, after: 4 })).toBeNull();
    expect(confidenceLine(null)).toBeNull();
  });
});

describe("shouldAskBefore", () => {
  it("is on screen before the first answer, also once answered (the number stays and can change)", () => {
    expect(shouldAskBefore(0, false)).toBe(true);
  });

  it("is gone after the first answer or a skip", () => {
    expect(shouldAskBefore(1, false)).toBe(false);
    expect(shouldAskBefore(0, true)).toBe(false);
  });
});

describe("SCALE", () => {
  it("runs from 1 to 5", () => {
    expect(SCALE.map((s) => s.value)).toEqual([1, 2, 3, 4, 5]);
  });
});
