import { memo } from 'react';
import { daysInMonth, pad, weekday } from '../../shared/date.ts';
import {
  type Cal,
  cellClass,
  type Days,
  dateKey,
  fmt,
  MON,
  MONTHS,
} from '../lib/cal.ts';
import { erasInYear } from '../lib/life.ts';
import { EraTags } from './EraTags.tsx';
import s from './sections.module.css';

interface Props {
  y: number;
  cal: Cal;
  days: Days;
  /** Set when an activity lens is active: its name and days per YYYY-MM. */
  lens: { name: string; counts: Record<string, number> } | null;
  onMonth: (y: number, m: number) => void;
}

export const YearSection = memo(function YearSection({
  y,
  cal,
  days,
  lens,
  onMonth,
}: Props) {
  const months = [];
  let lensTotal = 0;
  for (let m = 0; m < 12; m++) {
    lensTotal += lens?.counts[`${y}-${pad(m + 1)}`] ?? 0;
    const cells = [];
    for (let d = 1, n = daysInMonth(y, m); d <= n; d++) {
      const key = dateKey(y, m, d);
      const marks = cal.milestones.get(key);
      cells.push(
        <span
          key={d}
          className={cellClass(key, cal, days)}
          data-k={key}
          title={marks?.join(', ')}
          style={
            d === 1 ? { gridColumnStart: weekday(y, m, 1) + 1 } : undefined
          }
        />
      );
    }
    months.push(
      <button
        key={m}
        type="button"
        className={s.mo}
        data-mo={`${y}-${m}`}
        aria-label={`${MONTHS[m]} ${y}`}
        onClick={() => onMonth(y, m)}
      >
        <div className={s.lbl}>{MON[m]}</div>
        <div className={s.mini} aria-hidden="true">
          {cells}
        </div>
      </button>
    );
  }
  return (
    <section className={`${s.section} ${s.year}`} data-y={y}>
      <h2 className={s.heading}>
        {y}
        <small>
          age {y - cal.by}
          {lens && ` · ${lens.name} on ${fmt(lensTotal)} days`}
        </small>
        <EraTags cal={cal} eras={erasInYear(cal, y)} />
      </h2>
      <div className={s.months}>{months}</div>
    </section>
  );
});
