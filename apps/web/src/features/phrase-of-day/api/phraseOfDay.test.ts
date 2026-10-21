import { afterEach, describe, expect, it, vi } from "vitest";
import { checkPhraseOfDay, getPhraseOfDay } from "./phraseOfDay";

afterEach(() => vi.unstubAllGlobals());

describe("phrase of the day API", () => {
  it("reads GET /phrase-of-the-day", async () => {
    const body = { date: "2026-10-29", id: "return-home", kind: "interview", text: "I plan to return.", fr: "x", en: "y", example: "z" };
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(body)));
    vi.stubGlobal("fetch", fetchMock);
    expect((await getPhraseOfDay()).id).toBe("return-home");
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/phrase-of-the-day$/);
  });

  it("sends only the recording to POST /phrase-of-the-day/check: the server knows which phrase it is", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ nailed: true, similarity: 1, missing: [], target: "t", heard: "t" })));
    vi.stubGlobal("fetch", fetchMock);
    const res = await checkPhraseOfDay(new Blob(["x"], { type: "audio/webm" }));
    expect(res.nailed).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/phrase-of-the-day\/check$/);
    const form = init.body as FormData;
    expect([...form.keys()]).toEqual(["audio"]);
  });
});
