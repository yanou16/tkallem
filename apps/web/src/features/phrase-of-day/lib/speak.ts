/** "Listen" with the browser's own voice: free (no server call, so no daily voice quota to use up), and shown only where the
 *  browser has one. Slower than normal speech, so the student can follow the words. */
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

export function speak(text: string): void {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel(); // a second tap restarts instead of queueing
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}
