/** Voice decisions of the chat, kept as plain functions so they are tested without a browser. */

export const MAX_RECORDING_S = 60; // one answer; the API refuses files above max_audio_bytes anyway
/** IELTS Speaking part 2 is a long turn (the question says one to two minutes): 60 s cut students off in the middle. */
const LONG_TURN_S = 150;
const LONG_TURN_SCENARIOS = new Set(["ielts-part2"]);

export function maxRecordingSeconds(scenarioId?: string | null): number {
  return scenarioId && LONG_TURN_SCENARIOS.has(scenarioId) ? LONG_TURN_S : MAX_RECORDING_S;
}
export const MIN_RECORDING_S = 0.8; // a tap, not an answer: Whisper would invent text on near-silence
// Loudest moment of the recording (RMS, 0..1) below which nothing was said: Whisper turns silence into "Thank you."
// with normal confidence, so a silent recording is never sent. Speech close to a phone mic is well above 0.05.
export const SILENCE_PEAK = 0.012;

/** Is this recording worth sending? `peak` is -1 when the browser could not measure the level (then it is sent). */
export function judgeRecording(seconds: number, peak: number): "ok" | "too-short" | "silent" {
  if (seconds < MIN_RECORDING_S) return "too-short";
  if (peak >= 0 && peak < SILENCE_PEAK) return "silent";
  return "ok";
}

export const RECORDING_ERRORS = {
  "too-short": "That was too short. Tap the mic, answer, then tap again to send.",
  silent: "We could not hear you. Check that the right microphone is on, speak closer, then try again.",
} as const;

/** Who says the coach's line: the 3D coach (shown and working), a plain audio player, or the browser's own voice when
 *  the server sent no audio (every voice provider failed). */
export function voiceRoute(audioUrl: string | null | undefined, avatarShown: boolean, avatarBroken: boolean): "browser" | "avatar" | "audio" {
  if (!audioUrl) return "browser";
  return avatarShown && !avatarBroken ? "avatar" : "audio";
}
