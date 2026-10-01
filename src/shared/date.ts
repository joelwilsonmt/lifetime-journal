// Dates are local calendar dates in YYYY-MM-DD form. Everything here is plain
// calendar arithmetic; nothing depends on a timezone.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const pad = (n: number) => String(n).padStart(2, '0');

/** Month is 0-based, matching the prototype. */
export const dateKey = (y: number, m: number, d: number) =>
  `${y}-${pad(m + 1)}-${pad(d)}`;

export const isLeap = (y: number) =>
  (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

const DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Month is 0-based. */
export const daysInMonth = (y: number, m: number) =>
  m === 1 && isLeap(y) ? 29 : (DIM[m] ?? 31);

/** Strict check: correct shape and a real calendar date. */
export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const match = DATE_RE.exec(s);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  return y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m - 1);
}

/** Returns [year, 0-based month, day]. Assumes a valid date. */
export function parseDate(s: string): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number);
  return [y ?? 0, (m ?? 1) - 1, d ?? 1];
}

/** Days since 1970-01-01 for a calendar date. Month is 0-based and may overflow. */
export const dayNumber = (y: number, m: number, d: number) =>
  Math.round(Date.UTC(y, m, d) / 864e5);

export const dayNumberOf = (s: string) => dayNumber(...parseDate(s));

/** 0 = Sunday. Month is 0-based. */
export const weekday = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m, d)).getUTCDay();

export function shiftDate(s: string, n: number): string {
  const [y, m, d] = parseDate(s);
  const t = new Date(Date.UTC(y, m, d + n));
  return dateKey(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

/** Today's local calendar date. */
export function todayKey(now = new Date()): string {
  return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
}
