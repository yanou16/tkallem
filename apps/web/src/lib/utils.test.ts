import { describe, expect, it } from "vitest";
import { formatMinutes, formatNumber } from "./utils";

describe("formatNumber", () => {
  it("keeps at most one decimal", () => {
    expect(formatNumber(14.285714)).toBe("14.3");
    expect(formatNumber(25)).toBe("25");
    expect(formatNumber(-6.04)).toBe("-6");
  });

  it("shows a dash when the API has no value", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
  });

  it("never shows a negative zero", () => {
    expect(formatNumber(-0.01)).toBe("0");
  });
});

describe("formatMinutes", () => {
  it("formats minutes, with hours past 60", () => {
    expect(formatMinutes(600 / 60)).toBe("10 min");
    expect(formatMinutes(3900 / 60)).toBe("1h 5min");
  });
});
