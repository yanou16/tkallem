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

export function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}

export function plural(n: number, one: string, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`;
}
