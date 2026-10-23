import { describe, expect, it } from "vitest";
import { stateLabel } from "../components/VoiceState";

describe("stateLabel", () => {
  it("says what the coach is doing, one word per state", () => {
    expect(stateLabel("listening", 65)).toBe("Listening… 1:05");
    expect(stateLabel("thinking")).toBe("Thinking…");
    expect(stateLabel("speaking")).toBe("Speaking…");
  });

  it("says the voice is being prepared once the reply is on screen, instead of 'Thinking…'", () => {
    expect(stateLabel("preparing")).toBe("Preparing the voice…");
  });

  it("says nothing when the coach is idle", () => {
    expect(stateLabel("idle")).toBe("");
  });
});
