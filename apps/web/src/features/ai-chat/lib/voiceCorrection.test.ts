import { describe, expect, it } from "vitest";
import { applyVoiceCorrection, type VoiceCorrection } from "./voiceCorrection";
import type { AiSession } from "../types/ai";

const turn: VoiceCorrection = {
  utterance_id: "u1", original: "I go for study.", reply: "Which university?", sentence_status: "orange",
  corrections: [{ original: "for study", fixed: "to study", why: "Use to + verb for a purpose.", type: "grammar" }],
};
const session: AiSession = { id: "s1", scenarioId: "visa-us", finished: false, messages: [
  { id: "q", role: "assistant", content: "Why are you travelling?" },
  { id: "pending", role: "user", content: "I go for study." },
  { id: "reply", role: "assistant", content: "Which university?" },
] };

describe("voice corrections", () => {
  it("replaces unchecked transcripts with one corrected answer and its explanation", () => {
    const checked = applyVoiceCorrection(session, turn);
    expect(checked.messages).toHaveLength(3);
    expect(checked.messages[1]).toMatchObject({ status: "orange", corrections: turn.corrections });
    expect(session.messages[1].status).toBeUndefined();
  });
  it("does not duplicate a correction delivered twice", () => {
    const checked = applyVoiceCorrection(session, turn);
    expect(applyVoiceCorrection(checked, turn)).toBe(checked);
  });
  it("keeps earlier checked answers when there is no provisional transcript", () => {
    const checked = applyVoiceCorrection(session, turn);
    const next = applyVoiceCorrection(checked, { ...turn, utterance_id: "u2" });
    expect(next.messages).toHaveLength(5);
    expect(next.messages[1]).toBe(checked.messages[1]);
  });
});
