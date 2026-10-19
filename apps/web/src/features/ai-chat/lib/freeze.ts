/** "Freeze meter": the time before the student starts to answer (docs/MVP idea 1), kept pure so it is tested in
 *  freeze.test.ts. The app measures it; the server cleans, averages and compares it (code, never the model). */
import type { FreezeDto } from "../types/ai";

/** Seconds between the coach's question being done and the first sound or letter, undefined when not measured. */
export function thinkSeconds(readyAt: number | null, beganAt: number | null): number | undefined {
  if (readyAt === null || beganAt === null) return undefined;
  return Math.round(Math.max(0, beganAt - readyAt) / 100) / 10; // typed before the coach was done: no wait
}

export type FreezeView = { title: string; value: string; note: string | null };

const secs = (s: number) => `${Number.isInteger(s) ? s : s.toFixed(1)} s`;

/** The report card. Neutral when it went up: it is a measure to look at, not a score. */
export function freezeView(f: FreezeDto): FreezeView {
  const title = f.kind === "voice" ? "Time before you speak" : f.kind === "text" ? "Time before you write" : "Time before you answer";
  const value = `${secs(f.seconds)} on average`;
  if (f.previous === null || f.previous === undefined) return { title, value, note: f.answers === 1 ? "Measured on 1 answer." : `Measured on ${f.answers} answers.` };
  if (f.seconds < f.previous) return { title, value, note: `Down from ${secs(f.previous)} last time.` };
  return { title, value, note: `Last time: ${secs(f.previous)}.` };
}
