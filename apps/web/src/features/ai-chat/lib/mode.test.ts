import { describe, expect, it } from "vitest";
import { MODE_LABEL, feedbackModeFrom, modeHint } from "./mode";

describe("feedbackModeFrom", () => {
  it("is practice unless the link asks for the real interview", () => {
    expect(feedbackModeFrom("interview")).toBe("interview");
    expect(feedbackModeFrom("practice")).toBe("practice");
    expect(feedbackModeFrom(null)).toBe("practice");
    expect(feedbackModeFrom(undefined)).toBe("practice");
    expect(feedbackModeFrom("exam")).toBe("practice");
  });
});

describe("labels", () => {
  it("names each mode and tells what to expect", () => {
    expect(MODE_LABEL).toEqual({ practice: "Practice", interview: "Real interview" });
    expect(modeHint("interview")).toMatch(/No corrections or hints until the end/);
    expect(modeHint("practice")).toMatch(/Corrections after each answer/);
  });
});
