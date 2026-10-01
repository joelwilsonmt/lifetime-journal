import { dayNumber, dayNumberOf, isLeap } from '../../shared/date.ts';
import type { Era } from '../../shared/types.ts';
import type { Cal } from './cal.ts';

export const ERA_COLORS = 6;

/** Stable color slot for an era: its position in the (start-sorted) list. */
export const eraColor = (cal: Cal, era: Era) =>
  `var(--era-${cal.eras.indexOf(era) % ERA_COLORS})`;

const endOf = (cal: Cal, era: Era) => era.end ?? cal.today;

export interface EraSpan {
  era: Era;
  /** Fraction of the range [0..1] where the era starts and ends. */
  from: number;
  to: number;
}

/** Eras overlapping the day range [a, b] (day numbers, inclusive), with positions. */
function erasIn(cal: Cal, a: number, b: number): EraSpan[] {
  const len = b - a + 1;
  const out: EraSpan[] = [];
  for (const era of cal.eras) {
    const s = dayNumberOf(era.start);
    const e = dayNumberOf(endOf(cal, era));
    if (e < a || s > b) continue;
    out.push({
      era,
      from: (Math.max(s, a) - a) / len,
      to: (Math.min(e, b) - a + 1) / len,
    });
  }
  return out;
}

export const erasInYear = (cal: Cal, y: number) =>
  erasIn(cal, dayNumber(y, 0, 1), dayNumber(y, 0, isLeap(y) ? 366 : 365));

export const erasInMonth = (cal: Cal, y: number, m: number) =>
  erasIn(cal, dayNumber(y, m, 1), dayNumber(y, m + 1, 0));

/** Milestones in a year or month, as [date, label] pairs. */
export function milestonesIn(cal: Cal, prefix: string): [string, string][] {
  const out: [string, string][] = [];
  for (const [date, labels] of cal.milestones) {
    if (date.startsWith(prefix)) for (const l of labels) out.push([date, l]);
  }
  return out.sort((x, y) => x[0].localeCompare(y[0]));
}

export function eraRange(era: Era): string {
  const s = era.start.slice(0, 4);
  if (!era.end) return `${s}–now`;
  const e = era.end.slice(0, 4);
  return s === e ? s : `${s}–${e}`;
}
