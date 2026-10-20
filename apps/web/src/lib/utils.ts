export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function initials(first?: string, last?: string, fallback?: string) {
  const a = first?.trim()?.[0];
  const b = last?.trim()?.[0];
  if (a && b) return (a + b).toUpperCase();
  const words = (first ?? fallback ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0]?.slice(0, 2) ?? "?").toUpperCase();
}

/** A metric with at most one decimal (averages from the API can have many). Null means "not available". */
export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  const rounded = Math.round(value * 10) / 10;
  return (rounded === 0 ? 0 : rounded).toLocaleString("en-US"); // thousands separator; never "-0"
}

export function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  return h > 0 ? `${h.toLocaleString("en-US")}h ${m}min` : `${m} min`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function timeAgo(iso: string, now: number = Date.now()) {
  const then = new Date(iso);
  const diff = now - then.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now"; // also a date slightly in the future (clock difference)
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d > 1 ? "s" : ""} ago`;
  // Past a week "12 days ago" says little: give the date (with the year when it is not this year).
  const sameYear = then.getFullYear() === new Date(now).getFullYear();
  const date = `${then.getDate()} ${MONTHS[then.getMonth()]}`;
  return sameYear ? date : `${date} ${then.getFullYear()}`;
}

export function plural(n: number, one: string, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`;
}
