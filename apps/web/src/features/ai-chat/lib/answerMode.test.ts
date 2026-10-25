import { describe, expect, it } from "vitest";
import { ANSWER_MODE_HINT, ANSWER_MODE_LABEL, MODE_KEY, browserCanCall, offeredModes, readAnswerMode, rememberAnswerMode } from "./answerMode";

const store = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; }, data };
};

describe("answer modes", () => {
  it("names the three modes so the difference is readable", () => {
    expect(ANSWER_MODE_LABEL).toEqual({ call: "Call", voice: "Voice message", text: "Text" });
    expect(new Set(Object.values(ANSWER_MODE_HINT)).size).toBe(3);
  });

  it("starts on the voice message and remembers text, never the call", () => {
    expect(readAnswerMode(store())).toBe("voice");
    expect(readAnswerMode(store({ [MODE_KEY]: "text" }))).toBe("text");
    expect(readAnswerMode(store({ [MODE_KEY]: "call" }))).toBe("voice");
    const s = store();
    rememberAnswerMode("call", s);
    expect(s.data).toEqual({});
    rememberAnswerMode("text", s);
    expect(s.data[MODE_KEY]).toBe("text");
  });

  it("survives a browser that refuses storage", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readAnswerMode(broken)).toBe("voice");
    expect(() => rememberAnswerMode("text", broken)).not.toThrow();
  });

  it("offers the call only when it is on", () => {
    expect(offeredModes(true)).toEqual(["call", "voice", "text"]);
    expect(offeredModes(false)).toEqual(["voice", "text"]);
  });

  it("needs WebRTC and a microphone API for a call", () => {
    expect(browserCanCall({ RTCPeerConnection: function () {}, mediaDevices: { getUserMedia: () => {} } })).toBe(true);
    expect(browserCanCall({ mediaDevices: { getUserMedia: () => {} } })).toBe(false);
    expect(browserCanCall({ RTCPeerConnection: function () {} })).toBe(false);
    expect(browserCanCall(null)).toBe(false);
  });
});
