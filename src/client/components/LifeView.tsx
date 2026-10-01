import { type CSSProperties, useLayoutEffect, useMemo, useRef } from 'react';
import { daysInMonth, pad } from '../../shared/date.ts';
import { type Cal, type Days, monthCounts } from '../lib/cal.ts';
import { eraColor, eraRange, erasInYear, milestonesIn } from '../lib/life.ts';
import ui from '../styles/ui.module.css';
import s from './LifeView.module.css';

interface Props {
  cal: Cal;
  days: Days;
  focusYear: number;
  onYear: (y: number) => void;
  onEditLife: () => void;
  /** Play the fill-in animation (first open of the day). */
  intro?: boolean;
}

export function LifeView({
  cal,
  days,
  focusYear,
  onYear,
  onEditLife,
  intro = false,
}: Props) {
  // Stagger from a few rows above today, so the cascade starts on screen.
  const introStart = Math.max(0, cal.ty - cal.by - 30);
  const ref = useRef<HTMLDivElement>(null);
  const counts = useMemo(() => monthCounts(days), [days]);
  const birthMonth = cal.birth.slice(0, 7);

  // Center the focused year once, when this view mounts.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount only
  useLayoutEffect(() => {
    const el =
      ref.current?.querySelector(`[data-y="${focusYear}"]`) ??
      ref.current?.querySelector(`.${s.now}`);
    el?.scrollIntoView({ block: 'center' });
  }, []);

  const items = [];
  for (let y = cal.by; y <= cal.ey; y++) {
    const age = y - cal.by;
    if (age % 10 === 0) {
      items.push(
        <div key={`d${age}`} className={s.decade}>
          {age === 0 ? 'First decade' : `Your ${age}s`}
        </div>
      );
    }
    const bars = [];
    for (let m = 0; m < 12; m++) {
      const p = `${y}-${pad(m + 1)}`;
      const fut = y > cal.ty || (y === cal.ty && m > cal.tm);
      if (fut || p < birthMonth) {
        bars.push(<i key={m} className={s.nb} />);
        continue;
      }
      const c = counts[p] ?? 0;
      const h = Math.max(10, Math.round((c / daysInMonth(y, m)) * 100));
      bars.push(
        <i
          key={m}
          className={c ? s.on : undefined}
          style={{ '--h': `${h}%` } as CSSProperties}
        />
      );
    }
    const cls = y > cal.ty ? s.future : y === cal.ty ? s.now : '';
    const eras = erasInYear(cal, y);
    const marks = milestonesIn(cal, `${y}-`);
    const notes = [
      ...eras.map(e => e.era.label),
      ...marks.map(([, l]) => l),
    ].join(', ');
    items.push(
      <button
        key={y}
        type="button"
        className={`${s.tile} ${cls}`}
        data-y={y}
        aria-label={`${y}, age ${age}${notes ? `. ${notes}` : ''}`}
        style={
          intro
            ? ({ '--i': Math.max(0, age - introStart) } as CSSProperties)
            : undefined
        }
        title={notes || undefined}
        onClick={() => onYear(y)}
      >
        {eras.length > 0 && (
          <span className={s.eras} aria-hidden="true">
            {eras.slice(0, 3).map(e => (
              <i
                key={e.era.label + e.era.start}
                style={{
                  left: `${e.from * 100}%`,
                  width: `${(e.to - e.from) * 100}%`,
                  background: eraColor(cal, e.era),
                }}
              />
            ))}
          </span>
        )}
        {marks.length > 0 && <span className={s.mark} aria-hidden="true" />}
        <span className={s.yr}>{y}</span>
        <span className={s.age}>age {age}</span>
        <span className={s.bars} aria-hidden="true">
          {bars}
        </span>
      </button>
    );
  }

  return (
    <>
      <div className={s.legend}>
        {cal.eras.map(era => (
          <span key={era.label + era.start} className={s.key}>
            <i style={{ background: eraColor(cal, era) }} />
            {era.label} <small>{eraRange(era)}</small>
          </span>
        ))}
        {cal.milestones.size > 0 && (
          <span className={s.key}>
            <i className={s.dot} />
            Milestone
          </span>
        )}
        <button type="button" className={ui.quiet} onClick={onEditLife}>
          {cal.eras.length || cal.milestones.size
            ? 'Edit eras and milestones'
            : 'Add eras and milestones'}
        </button>
      </div>
      <div className={`${s.life} ${intro ? s.intro : ''}`} ref={ref}>
        {items}
      </div>
    </>
  );
}
