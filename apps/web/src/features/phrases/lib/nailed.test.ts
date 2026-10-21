import { describe, expect, it } from "vitest";
import type { Phrase } from "../types/phrases";
import { markNailed, nailedCount, phraseKey, readNailed } from "./nailed";

const P = (sessionId: string, turn: number): Phrase => ({
  sessionId, scenarioId: "visa-us", title: "Visa interview", startedAt: "2026-10-20T10:00:00Z", turn,
  original: "I go to the US for study.", corrected: "I go to the US to study.", corrections: [],
});

function memory(initial?: string) {
  let value = initial ?? null;
  return { getItem: () => value, setItem: (_: string, v: string) => { value = v; }, get value() { return value; } };
}

describe("nailed phrases", () => {
  it("identifies a phrase by its session and its answer", () => {
    expect(phraseKey(P("abc", 2))).toBe("abc:2");
  });

  it("remembers a nailed phrase on this device", () => {
    const store = memory();
    const nailed = markNailed(store, readNailed(store), "abc:2");
    expect([...readNailed(store)]).toEqual(["abc:2"]);
    expect(nailed.has("abc:2")).toBe(true);
  });

  it("starts empty when the storage is missing, corrupted or blocked", () => {
    expect(readNailed(null).size).toBe(0);
    expect(readNailed(memory("not json")).size).toBe(0);
    expect(readNailed(memory('{"a":1}')).size).toBe(0);
    expect([...readNailed(memory('["a", 3, null, "b"]'))]).toEqual(["a", "b"]);
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readNailed(blocked).size).toBe(0);
    expect(markNailed(blocked, new Set(), "x:0").has("x:0")).toBe(true); // still shown for this visit
  });

  it("keeps only the 500 latest", () => {
    const store = memory();
    let nailed = new Set<string>();
    for (let i = 0; i < 520; i++) nailed = markNailed(store, nailed, `s:${i}`);
    const saved = readNailed(store);
    expect(saved.size).toBe(500);
    expect(saved.has("s:519")).toBe(true);
    expect(saved.has("s:0")).toBe(false);
  });

  it("counts only the phrases of the list", () => {
    const list = [P("a", 0), P("a", 1), P("b", 0)];
    expect(nailedCount(list, new Set(["a:1", "zzz:9"]))).toBe(1);
    expect(nailedCount([], new Set(["a:1"]))).toBe(0);
  });
});
