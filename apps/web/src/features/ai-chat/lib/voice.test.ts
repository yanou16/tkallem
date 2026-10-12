import { describe, expect, it } from "vitest";
import { judgeRecording, voiceRoute } from "./voice";

describe("judgeRecording", () => {
  it("sends a real answer", () => {
    expect(judgeRecording(3.2, 0.08)).toBe("ok");
  });
  it("refuses a tap shorter than 0.8 s", () => {
    expect(judgeRecording(0.4, 0.2)).toBe("too-short");
  });
  it("refuses a silent recording (Whisper would write 'Thank you.')", () => {
    expect(judgeRecording(4, 0)).toBe("silent");
    expect(judgeRecording(4, 0.005)).toBe("silent");
  });
  it("sends when the browser could not measure the level", () => {
    expect(judgeRecording(4, -1)).toBe("ok");
  });
});

describe("voiceRoute", () => {
  it("uses the browser's voice when the server sent no audio", () => {
    expect(voiceRoute(null, true, false)).toBe("browser");
    expect(voiceRoute(undefined, false, false)).toBe("browser");
  });
  it("uses the 3D coach only when it is shown and working", () => {
    expect(voiceRoute("data:audio/wav;base64,AA", true, false)).toBe("avatar");
    expect(voiceRoute("data:audio/wav;base64,AA", true, true)).toBe("audio");
    expect(voiceRoute("data:audio/wav;base64,AA", false, false)).toBe("audio");
  });
});
