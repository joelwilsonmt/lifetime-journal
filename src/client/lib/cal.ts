import { dateKey, dayNumber, parseDate } from '../../shared/date.ts';
import type { Era, Level, Settings } from '../../shared/types.ts';
import cells from '../styles/cells.module.css';

export const MONTHS = Array.from({ length: 12 }, (_, m) =>
  new Date(2000, m, 1).toLocaleString(undefined, { month: 'long' })
);
export const MON = Array.from({ length: 12 }, (_, m) =>
  new Date(2000, m, 1).toLocaleString(undefined, { month: 'short' })
);
export const WD = Array.from({ length: 7 }, (_, i) =>
  new Date(2000, 0, 2 + i).toLocaleString(undefined, { weekday: 'narrow' })
);

export type Days = Record<string, Level>;

/** Everything the views need to lay out a life, derived from settings + today. */
export interface Cal {
  birth: string;
  by: number;
  bm: number;
  bd: number;
  /** Last year shown: the one in which you turn `span`. */
  ey: number;
  span: number;
  today: string;
  ty: number;
  tm: number;
  td: number;
  eras: Era[];
  /** Milestone labels by date. */
  milestones: Map<string, string[]>;
}

export function makeCal(settings: Settings, today: string): Cal | null {
  if (!settings.birth) return null;
  const [by, bm, bd] = parseDate(settings.birth);
  const [ty, tm, td] = parseDate(today);
  return {
    birth: settings.birth,
    by,
    bm,
    bd,
    ey: Math.max(by + settings.span, ty),
    span: settings.span,
    today,
    ty,
    tm,
    td,
    eras: settings.eras,
    milestones: settings.milestones.reduce((map, m) => {
      map.set(m.date, [...(map.get(m.date) ?? []), m.label]);
      return map;
    }, new Map<string, string[]>()),
  };
}

export const ageAt = (cal: Cal, y: number, m: number) =>
  Math.max(0, y - cal.by - (m < cal.bm ? 1 : 0));

export function cellClass(key: string, cal: Cal, days: Days): string {
  const c: string[] = [];
  if (key < cal.birth) c.push(cells.pre as string);
  else if (key > cal.today) c.push(cells.fut as string);
  const lv = days[key];
  if (lv) c.push(cells[`l${lv}`] as string);
  if (key === cal.today) c.push(cells.td as string);
  if (cal.milestones.has(key)) c.push(cells.ms as string);
  return c.join(' ');
}

export function lifeStats(cal: Cal, days: Days) {
  const today = dayNumber(cal.ty, cal.tm, cal.td);
  const lived = today - dayNumber(cal.by, cal.bm, cal.bd);
  const left = Math.max(
    0,
    // Through the end of age `span`: up to the next birthday.
    dayNumber(cal.by + cal.span + 1, cal.bm, cal.bd) - today
  );
  const written = Object.keys(days).length;
  return { lived, left, written };
}

/** Days written per month, keyed YYYY-MM. */
export function monthCounts(days: Days): Record<string, number> {
  const map: Record<string, number> = {};
  for (const key in days) {
    const p = key.slice(0, 7);
    map[p] = (map[p] ?? 0) + 1;
  }
  return map;
}

export const longDate = (key: string) => {
  const [y, m, d] = parseDate(key);
  return new Date(y, m, d).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const fmt = (n: number) => n.toLocaleString();

export { dateKey };
