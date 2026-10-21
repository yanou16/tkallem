import { describe, expect, it } from "vitest";
import { addDays, readDays, recordDay, saidToday, streak } from "./days";

function memory(initial?: string) {
  let value = initial ?? null;
  return { getItem: () => value, setItem: (_: string, v: string) => { value = v; }, get value() { return value; } };
}

describe("days", () => {
  it("adds days across a month and a year", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("counts the days in a row ending today", () => {
    expect(streak(["2026-10-27", "2026-10-28", "2026-10-29"], "2026-10-29")).toBe(3);
    expect(streak(["2026-10-25", "2026-10-29"], "2026-10-29")).toBe(1); // a gap breaks it
  });

  it("keeps the streak alive until the end of the day when only yesterday is done", () => {
    expect(streak(["2026-10-27", "2026-10-28"], "2026-10-29")).toBe(2);
    expect(streak(["2026-10-26"], "2026-10-29")).toBe(0); // two days without: back to zero
    expect(streak([], "2026-10-29")).toBe(0);
  });

  it("knows if today's phrase is already said", () => {
    expect(saidToday(["2026-10-29"], "2026-10-29")).toBe(true);
    expect(saidToday(["2026-10-28"], "2026-10-29")).toBe(false);
  });

  it("remembers a day on this device, once, in order", () => {
    const store = memory();
    let days = recordDay(store, readDays(store), "2026-10-29");
    days = recordDay(store, days, "2026-10-28");
    days = recordDay(store, days, "2026-10-29");
    expect(days).toEqual(["2026-10-28", "2026-10-29"]);
    expect(readDays(store)).toEqual(["2026-10-28", "2026-10-29"]);
  });

  it("starts empty when the storage is missing, corrupted or blocked, and ignores wrong values", () => {
    expect(readDays(null)).toEqual([]);
    expect(readDays(memory("not json"))).toEqual([]);
    expect(readDays(memory('["2026-10-29", "tomorrow", 5, "2026-10-28"]'))).toEqual(["2026-10-28", "2026-10-29"]);
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readDays(blocked)).toEqual([]);
    expect(recordDay(blocked, [], "2026-10-29")).toEqual(["2026-10-29"]); // still shown for this visit
  });
});
