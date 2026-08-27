export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d + delta);
  return dayKey(date);
}

/** Last n day keys, oldest first, ending today. */
export function lastDays(n: number, from = dayKey()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(from, i - (n - 1)));
}

export function weekdayLetter(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return ["S", "M", "T", "W", "T", "F", "S"][new Date(y, m - 1, d).getDay()];
}

export function prettyDate(key: string = dayKey()): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Whole days between two day keys (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86400000);
}

/** First day of the month containing `key`. */
export function monthStart(key: string = dayKey()): string {
  const [y, m] = key.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** "2026-08" — the bucket a monthly goal is tracked against. */
export function monthKey(key: string = dayKey()): string {
  return key.slice(0, 7);
}

export function daysInMonth(key: string = dayKey()): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** "Today", "Tomorrow", or a short date — for labelling a scheduled day. */
export function relativeDay(key: string, from: string = dayKey()): string {
  const delta = daysBetween(from, key);
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta === -1) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (delta > 1 && delta < 7) {
    return date.toLocaleDateString(undefined, { weekday: "long" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function monthLabel(key: string = dayKey()): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/**
 * Day keys for a contribution grid: whole weeks, oldest first, ending on
 * the week containing today. Starts on Sunday so the rows line up as
 * weekdays, which is what makes the grid readable at a glance.
 */
export function contributionDays(weeks: number, from: string = dayKey()): string[] {
  const [y, m, d] = from.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  const lastDay = addDays(from, 6 - dow);      // Saturday of this week
  const total = weeks * 7;
  return Array.from({ length: total }, (_, i) => addDays(lastDay, i - (total - 1)));
}
