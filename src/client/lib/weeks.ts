import { dayNumber, dayNumberOf } from '../../shared/date.ts';
import type { Cal } from './cal.ts';

/**
 * Weeks of life: each row is one year of age, split into 52 weeks starting on
 * that birthday. Week 52 absorbs the 1–2 leftover days before the next
 * birthday, so every day belongs to exactly one cell.
 */
export const WEEKS = 52;

export const birthdayNumber = (cal: Cal, age: number) =>
  dayNumber(cal.by + age, cal.bm, cal.bd);

export interface WeekPos {
  age: number;
  w: number;
}

export function weekOf(cal: Cal, dn: number): WeekPos | null {
  const birth = birthdayNumber(cal, 0);
  if (dn < birth) return null;
  // Start from an estimate and correct; leap years make the exact age drift.
  let age = Math.floor((dn - birth) / 365.2425);
  while (age > 0 && birthdayNumber(cal, age) > dn) age--;
  while (birthdayNumber(cal, age + 1) <= dn) age++;
  const w = Math.min(
    WEEKS - 1,
    Math.floor((dn - birthdayNumber(cal, age)) / 7)
  );
  return { age, w };
}

/** Day-number range [start, end] of a week cell. */
export function weekRange(cal: Cal, age: number, w: number): [number, number] {
  const start = birthdayNumber(cal, age) + w * 7;
  const end = w === WEEKS - 1 ? birthdayNumber(cal, age + 1) - 1 : start + 6;
  return [start, end];
}

/** Written days per week cell, keyed `${age}:${w}`. */
export function weekCounts(
  cal: Cal,
  dates: Iterable<string>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const date of dates) {
    const pos = weekOf(cal, dayNumberOf(date));
    if (!pos) continue;
    const k = `${pos.age}:${pos.w}`;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

/** Shade a week by how many of its days were written. */
export const weekLevel = (count: number) =>
  count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
