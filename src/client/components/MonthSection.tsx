import { memo } from 'react';
import { daysInMonth, pad, weekday } from '../../shared/date.ts';
import {
  ageAt,
  type Cal,
  cellClass,
  type Days,
  dateKey,
  fmt,
  longDate,
  MONTHS,
  WD,
} from '../lib/cal.ts';
import { erasInMonth } from '../lib/life.ts';
import { EraTags } from './EraTags.tsx';
import s from './sections.module.css';

interface Props {
  y: number;
  m: number;
  cal: Cal;
  days: Days;
  lens: { name: string; counts: Record<string, number> } | null;
  onDay: (key: string) => void;
}

export const MonthSection = memo(function MonthSection({
  y,
  m,
  cal,
  days,
  lens,
  onDay,
}: Props) {
  const cells = [];
  for (let d = 1, n = daysInMonth(y, m); d <= n; d++) {
    const key = dateKey(y, m, d);
    const marks = cal.milestones.get(key);
    cells.push(
      <button
        key={d}
        type="button"
        className={`${s.day} ${cellClass(key, cal, days)}`}
        style={d === 1 ? { gridColumnStart: weekday(y, m, 1) + 1 } : undefined}
        aria-label={`${longDate(key)}${marks ? `. ${marks.join(', ')}` : ''}`}
        onClick={() => onDay(key)}
      >
        {d}
        {marks && <span className={s.msLabel}>{marks.join(', ')}</span>}
      </button>
    );
  }
  const lensCount = lens?.counts[`${y}-${pad(m + 1)}`] ?? 0;
  return (
    <section className={`${s.section} ${s.month}`} data-y={y} data-m={m}>
      <h2 className={s.heading}>
        {MONTHS[m]}
        <small>
          {y}, age {ageAt(cal, y, m)}
          {lens && ` · ${lens.name} on ${fmt(lensCount)} days`}
        </small>
        <EraTags cal={cal} eras={erasInMonth(cal, y, m)} />
      </h2>
      <div className={s.days}>
        {WD.map((w, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-item list
          <div key={i} className={s.wd} aria-hidden="true">
            {w}
          </div>
        ))}
        {cells}
      </div>
    </section>
  );
});
