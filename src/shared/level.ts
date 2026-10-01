import type { Level } from './types.ts';

/** Intensity 0–4 from note length plus activity count. Same curve as the prototype. */
export function level(note: string, activities: readonly string[]): Level {
  let s = 0;
  const n = note.trim();
  if (n) s += 0.35 + Math.min(0.45, n.length / 800);
  s += activities.length * 0.2;
  if (s <= 0) return 0;
  return s < 0.4 ? 1 : s < 0.65 ? 2 : s < 0.9 ? 3 : 4;
}
