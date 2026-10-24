/** The days the student said the phrase of the day right, kept on this device only (nothing is sent): a small
 *  motivation, not a record. Dates are the API's (Algiers), as "YYYY-MM-DD". Pure over a Storage-like object so it is
 *  tested in days.test.ts. */
const KEY = "tkallem.phraseDays";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
type Store = Pick<Storage, "getItem" | "setItem">;

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function readDays(store: Store | null): string[] {
  try {
    const raw = store?.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? [...new Set(list.filter((d): d is string => typeof d === "string" && DAY.test(d)))].sort() : [];
  } catch {
    return []; // blocked or corrupted storage: no days yet
  }
}

/** Adds a day and returns the new list (the 120 latest). A storage that refuses still returns it, for this visit. */
export function recordDay(store: Store | null, days: string[], day: string): string[] {
  const next = [...new Set([...days, day])].sort().slice(-120);
  try {
    store?.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private window or full storage */
  }
  return next;
}

export const saidToday = (days: string[], today: string) => days.includes(today);

/** Days in a row ending today, or ending yesterday while today's phrase is not said yet (the streak is still alive). */
export function streak(days: string[], today: string): number {
  const set = new Set(days);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}
