import { type CSSProperties, memo } from 'react';
import { dateKey, dayNumberOf, parseDate } from '../../shared/date.ts';
import { type Cal, longDate } from '../lib/cal.ts';
import { WEEKS, weekLevel, weekOf, weekRange } from '../lib/weeks.ts';
import cells from '../styles/cells.module.css';
import s from './WeeksView.module.css';

export const PER_ROW = [52, 26, 13] as const;
export type PerRow = (typeof PER_ROW)[number];

interface Props {
  /** Decade index: ages 10*decade … 10*decade+9. */
  decade: number;
  cal: Cal;
  /** Written days per week, keyed `${age}:${w}`. */
  counts: Map<string, number>;
  /** Milestone labels per week, same keys. */
  marks: Map<string, string[]>;
  perRow: PerRow;
  onPerRow: (p: PerRow) => void;
  onWeek: (y: number, m: number) => void;
}

const fromDayNumber = (dn: number) => {
  const t = new Date(dn * 864e5);
  return dateKey(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
};

/** Ten years of life in weeks: one block per year of age, from each birthday. */
export const WeeksSection = memo(function WeeksSection({
  decade,
  cal,
  counts,
  marks,
  perRow,
  onPerRow,
  onWeek,
}: Props) {
  const todayDn = dayNumberOf(cal.today);
  const today = weekOf(cal, todayDn);
  const first = decade * 10;
  const last = Math.min(cal.span, first + 9);

  const rows = [];
  for (let age = first; age <= last; age++) {
    const weeks = [];
    for (let w = 0; w < WEEKS; w++) {
      const k = `${age}:${w}`;
      const [a, b] = weekRange(cal, age, w);
      const c: string[] = [s.wk as string];
      if (a > todayDn) c.push(cells.fut as string);
      const n = counts.get(k) ?? 0;
      const lv = weekLevel(n);
      if (lv) c.push(cells[`l${lv}`] as string);
      if (today?.age === age && today.w === w) c.push(cells.td as string);
      const ms = marks.get(k);
      if (ms) c.push(cells.ms as string);
      const start = fromDayNumber(a);
      const label = `Age ${age}, week ${w + 1}: ${longDate(start)} to ${longDate(fromDayNumber(b))}. ${n} ${n === 1 ? 'day' : 'days'} written.${ms ? ` ${ms.join(', ')}.` : ''}`;
      weeks.push(
        <button
          key={w}
          type="button"
          className={c.join(' ')}
          title={label}
          aria-label={label}
          onClick={() => {
            const [y, m] = parseDate(start);
            onWeek(y, m);
          }}
        />
      );
    }
    rows.push(
      <div key={age} className={s.ageRow} data-age={age}>
        <span className={s.age} aria-hidden="true">
          {age}
        </span>
        <div className={s.weeks}>{weeks}</div>
      </div>
    );
  }

  return (
    <section
      className={s.section}
      data-decade={decade}
      data-y={cal.by + first}
      data-per-row={perRow}
      style={{ '--cols': perRow } as CSSProperties}
    >
      <h2 className={s.heading}>
        {decade === 0 ? 'First decade' : `Your ${first}s`}
        {/* biome-ignore lint/a11y/useSemanticElements: compact segmented toggle */}
        <span className={s.perRow} role="group" aria-label="Weeks per row">
          {PER_ROW.map(p => (
            <button
              key={p}
              type="button"
              aria-pressed={p === perRow}
              onClick={() => onPerRow(p)}
            >
              {p}
            </button>
          ))}
          <small>per row</small>
        </span>
      </h2>
      {rows}
    </section>
  );
});
