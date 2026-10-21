/** Which phrases the student already said right ("Nailed it"). Kept on this device only (nothing is sent), so it is
 *  a small motivation and not a record: kept pure over a Storage-like object so it is tested in nailed.test.ts. */
import type { Phrase } from "../types/phrases";

const KEY = "tkallem.nailed";
type Store = Pick<Storage, "getItem" | "setItem">;

export const phraseKey = (p: Pick<Phrase, "sessionId" | "turn">) => `${p.sessionId}:${p.turn}`;

export function readNailed(store: Store | null): Set<string> {
  try {
    const raw = store?.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((k): k is string => typeof k === "string") : []);
  } catch {
    return new Set(); // blocked or corrupted storage: nothing is nailed yet
  }
}

/** Remembers one more nailed phrase and returns the new set. A storage that refuses to write still returns it, so the
 *  screen shows the success for this visit. */
export function markNailed(store: Store | null, current: Set<string>, key: string): Set<string> {
  const next = new Set(current).add(key);
  try {
    store?.setItem(KEY, JSON.stringify([...next].slice(-500))); // the 500 latest: it never grows without end
  } catch {
    /* private window or full storage */
  }
  return next;
}

/** "3 of 12 nailed": only phrases that are still in the list count (older ones may have scrolled out of it). */
export const nailedCount = (phrases: Phrase[], nailed: Set<string>) => phrases.filter((p) => nailed.has(phraseKey(p))).length;
