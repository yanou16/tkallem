import { describe, expect, it } from "vitest";
import { formatMinutes, formatNumber, timeAgo } from "./utils";

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

  it("puts a separator in the thousands", () => {
    expect(formatNumber(1284)).toBe("1,284");
    expect(formatNumber(12345.678)).toBe("12,345.7");
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
  it("keeps a separator for a very long time", () => {
    expect(formatMinutes(4622400 / 60)).toBe("1,284h 0min");
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-10-20T12:00:00Z").getTime();
  it("counts minutes, hours and days within a week", () => {
    expect(timeAgo("2026-10-20T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-10-20T11:30:00Z", now)).toBe("30 min ago");
    expect(timeAgo("2026-10-20T10:00:00Z", now)).toBe("2 hours ago");
    expect(timeAgo("2026-10-19T12:00:00Z", now)).toBe("1 day ago");
  });
  it("gives the date after a week, with the year when it is another year", () => {
    expect(timeAgo("2026-09-01T12:00:00Z", now)).toBe("1 Sep");
    expect(timeAgo("2025-12-31T12:00:00Z", now)).toBe("31 Dec 2025");
    expect(timeAgo("1970-01-01T12:00:00Z", now)).toBe("1 Jan 1970");
  });
  it("does not count a date in the future", () => {
    expect(timeAgo("2026-11-30T10:00:00Z", now)).toBe("just now");
  });
});
