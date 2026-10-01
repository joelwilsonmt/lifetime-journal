import { forwardRef, useRef } from 'react';
import { type Cal, type Days, fmt, lifeStats } from '../lib/cal.ts';
import ui from '../styles/ui.module.css';
import s from './Header.module.css';

export type ViewLevel = 'life' | 'weeks' | 'year' | 'month';

export const LEVELS: { lv: ViewLevel; label: string }[] = [
  { lv: 'life', label: 'Life' },
  { lv: 'weeks', label: 'Weeks' },
  { lv: 'year', label: 'Year' },
  { lv: 'month', label: 'Month' },
];

interface Props {
  cal: Cal | null;
  /** Days to count: all entries, or only those matching the lens. */
  days: Days;
  level: ViewLevel;
  lens: string | null;
  lensOptions: string[];
  onLens: (lens: string | null) => void;
  onLevel: (lv: ViewLevel) => void;
  onWrite: () => void;
  onToday: () => void;
  onSearch: () => void;
  onEditLife: () => void;
  onSettings: () => void;
}

/**
 * Wide screens show every control inline. Phones keep the zoom levels and
 * Write in the bar and move the rest into a menu.
 */
export const Header = forwardRef<HTMLElement, Props>(function Header(
  {
    cal,
    days,
    level,
    lens,
    lensOptions,
    onLens,
    onLevel,
    onWrite,
    onToday,
    onSearch,
    onEditLife,
    onSettings,
  },
  ref
) {
  const menu = useRef<HTMLDivElement>(null);
  const pick = (fn: () => void) => () => {
    menu.current?.hidePopover();
    fn();
  };

  const lensSelect = cal && lensOptions.length > 0 && (
    <label className={s.lens}>
      <span>Showing</span>
      <select
        value={lens ?? ''}
        onChange={e => {
          menu.current?.hidePopover();
          onLens(e.target.value || null);
        }}
      >
        <option value="">all entries</option>
        {lensOptions.map(a => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <header className={s.bar} ref={ref}>
      <div className={s.inner}>
        <div className={s.stat}>
          {cal ? (
            <Stat cal={cal} days={days} lens={lens} />
          ) : (
            'Your years, one day at a time.'
          )}
          <span className={s.wide}>{lensSelect}</span>
        </div>
        <div className={s.controls}>
          {/* biome-ignore lint/a11y/useSemanticElements: a fieldset brings legend/border baggage for a segmented toggle */}
          <div className={s.seg} role="group" aria-label="Zoom level">
            {LEVELS.map(({ lv, label }) => (
              <button
                key={lv}
                type="button"
                aria-pressed={level === lv}
                onClick={() => onLevel(lv)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`${ui.primary} ${s.write}`}
            onClick={onWrite}
            disabled={!cal}
          >
            Write
          </button>
          <span className={s.wide}>
            <button type="button" className={ui.plain} onClick={onToday}>
              Today
            </button>
            <button
              type="button"
              className={ui.plain}
              onClick={onSearch}
              disabled={!cal}
            >
              Search
            </button>
            <button type="button" className={ui.plain} onClick={onSettings}>
              Settings
            </button>
          </span>
          <button
            type="button"
            className={`${ui.plain} ${s.menuBtn}`}
            aria-label="Menu"
            onClick={() => menu.current?.togglePopover()}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 4h12M2 8h12M2 12h12" />
            </svg>
          </button>
        </div>
      </div>
      <div ref={menu} popover="auto" className={s.menu}>
        {cal && (
          <p className={s.menuStat}>
            <Stat cal={cal} days={days} lens={lens} full />
          </p>
        )}
        {lensSelect}
        <button type="button" onClick={pick(onToday)}>
          Today
        </button>
        <button type="button" onClick={pick(onSearch)} disabled={!cal}>
          Search
        </button>
        <button type="button" onClick={pick(onEditLife)} disabled={!cal}>
          Eras and milestones
        </button>
        <button type="button" onClick={pick(onSettings)}>
          Settings
        </button>
      </div>
    </header>
  );
});

function Stat({
  cal,
  days,
  lens,
  full = false,
}: {
  cal: Cal;
  days: Days;
  lens: string | null;
  full?: boolean;
}) {
  const { lived, left, written } = lifeStats(cal, days);
  const thisYear = lens
    ? Object.keys(days).filter(k => k.startsWith(`${cal.ty}-`)).length
    : 0;
  return (
    <span>
      <b>{fmt(lived)}</b> days lived, <b>{fmt(left)}</b> to go
      <span className={full ? undefined : s.wideInline}>
        {' '}
        through age {cal.span}.{' '}
        {lens ? (
          <>
            {lens} on <b>{fmt(written)}</b> {written === 1 ? 'day' : 'days'},{' '}
            {fmt(thisYear)} this year.
          </>
        ) : (
          <>
            {fmt(written)} {written === 1 ? 'day' : 'days'} written.
          </>
        )}
      </span>
      {!full && <span className={s.narrowInline}>.</span>}
    </span>
  );
}
