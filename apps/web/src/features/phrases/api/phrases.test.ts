import { afterEach, describe, expect, it, vi } from "vitest";
import { getPhrases, mapPhrase } from "./phrases";
import type { PhraseDto } from "../types/phrases";

const DTO: PhraseDto = {
  session_id: "5f0c4a3e8d0b4c5f9a2e1b7c6d4e3f21",
  scenario_id: "visa-us",
  title: "Visa interview",
  started_at: "2026-10-20T18:30:00Z",
  turn: 1,
  original: "I go to the US for study.",
  corrected: "I go to the US to study.",
  corrections: [{ original: "for study", fixed: "to study", type: "grammar", why: "Le but : to + verbe." }],
};

afterEach(() => vi.unstubAllGlobals());

describe("mapPhrase", () => {
  it("converts a phrase to camelCase and keeps the answer index Say it again takes", () => {
    expect(mapPhrase(DTO)).toEqual({
      sessionId: "5f0c4a3e8d0b4c5f9a2e1b7c6d4e3f21",
      scenarioId: "visa-us",
      title: "Visa interview",
      startedAt: "2026-10-20T18:30:00Z",
      turn: 1,
      original: "I go to the US for study.",
      corrected: "I go to the US to study.",
      corrections: DTO.corrections,
    });
  });
});

describe("getPhrases", () => {
  it("reads GET /me/corrections with the limit", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify([DTO])));
    vi.stubGlobal("fetch", fetchMock);

    const phrases = await getPhrases(30);

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/me\/corrections\?limit=30$/);
    expect(phrases.map((p) => p.turn)).toEqual([1]);
  });
});
