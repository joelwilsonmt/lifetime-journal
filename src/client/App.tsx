import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { dayNumberOf, parseDate, todayKey } from '../shared/date.ts';
import {
  DEFAULT_SETTINGS,
  type Level,
  type Settings,
} from '../shared/types.ts';
import s from './App.module.css';
import { api } from './api.ts';
import { DayDialog } from './components/DayDialog.tsx';
import { ErasDialog } from './components/ErasDialog.tsx';
import { Header, LEVELS, type ViewLevel } from './components/Header.tsx';
import { LifeView } from './components/LifeView.tsx';
import { MonthSection } from './components/MonthSection.tsx';
import { type Away, ScrollList } from './components/ScrollList.tsx';
import { SearchDialog } from './components/SearchDialog.tsx';
import { SettingsDialog } from './components/SettingsDialog.tsx';
import { Toast, useToast } from './components/Toast.tsx';
import {
  PER_ROW,
  type PerRow,
  WeeksSection,
} from './components/WeeksSection.tsx';
import { YearSection } from './components/YearSection.tsx';
import { type Days, makeCal, monthCounts } from './lib/cal.ts';
import { weekCounts, weekOf } from './lib/weeks.ts';
import ui from './styles/ui.module.css';

interface Focus {
  y: number;
  m: number;
}

type Dialog = 'settings' | 'eras' | 'search' | null;

function todayFocus(): Focus {
  const [y, m] = parseDate(todayKey());
  return { y, m };
}

const PER_ROW_KEY = 'lifecal:weeksPerRow';
const readPerRow = (): PerRow => {
  try {
    const v = Number(localStorage.getItem(PER_ROW_KEY));
    if ((PER_ROW as readonly number[]).includes(v)) return v as PerRow;
  } catch {}
  return matchMedia('(max-width: 520px)').matches ? 26 : 52;
};

const LENS_KEY = 'lifecal:lens';
const readLens = () => {
  try {
    return localStorage.getItem(LENS_KEY);
  } catch {
    return null;
  }
};

/** Esc zooms out one step: month → year → life, weeks → life. */
const ZOOM_OUT: Record<ViewLevel, ViewLevel | null> = {
  month: 'year',
  year: 'life',
  weeks: 'life',
  life: null,
};

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [days, setDays] = useState<Days>({});
  const [dayActs, setDayActs] = useState<Record<string, string[]>>({});
  const [loadError, setLoadError] = useState(false);
  const [today, setToday] = useState(todayKey);
  // seq changes on every navigation so the active view remounts and re-anchors.
  const [view, setView] = useState<{ level: ViewLevel; seq: number }>({
    level: 'life',
    seq: 0,
  });
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [lens, setLensState] = useState<string | null>(readLens);
  // Which way today's section lies when it's scrolled out of view.
  const [away, setAway] = useState<Away>(null);
  const [perRow, setPerRowState] = useState<PerRow>(readPerRow);
  const { msg, toast } = useToast();
  const headerRef = useRef<HTMLElement>(null);

  const cal = useMemo(
    () => (settings ? makeCal(settings, today) : null),
    [settings, today]
  );

  // Where the user is. Updated by scrolling without re-rendering.
  const focus = useRef<Focus>(todayFocus());

  const load = useCallback(async () => {
    try {
      const [st, sum] = await Promise.all([api.getSettings(), api.summary()]);
      setSettings(st);
      setDays(sum.days);
      setDayActs(sum.activities);
      setLoadError(false);
      return st;
    } catch {
      setLoadError(true);
      return null;
    }
  }, []);

  // First load. `?write` (the installed app's start URL) opens today's editor.
  useEffect(() => {
    void load().then(st => {
      const params = new URLSearchParams(location.search);
      if (!params.has('write')) return;
      history.replaceState(null, '', location.pathname);
      if (st?.birth) setOpenDay(todayKey());
    });
  }, [load]);

  // If the first load failed (server restarting), keep retrying quietly.
  useEffect(() => {
    if (!loadError) return;
    const retry = () => void load();
    const id = setInterval(retry, 3000);
    window.addEventListener('focus', retry);
    window.addEventListener('online', retry);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', retry);
      window.removeEventListener('online', retry);
    };
  }, [loadError, load]);

  // The tab may stay open past midnight, and other devices may have written.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setToday(todayKey());
      api.summary().then(
        r => {
          setDays(r.days);
          setDayActs(r.activities);
        },
        () => {}
      );
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Expose the header height for scroll-margin on sections.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty(
        '--hdr',
        `${el.getBoundingClientRect().height}px`
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Activity lens: every view shades only the days with that activity.
  const lensOptions = useMemo(() => {
    const set = new Set(settings?.activities ?? []);
    for (const list of Object.values(dayActs)) for (const a of list) set.add(a);
    return [...set];
  }, [settings, dayActs]);
  const activeLens = lens && lensOptions.includes(lens) ? lens : null;
  const setLens = useCallback((l: string | null) => {
    setLensState(l);
    try {
      if (l) localStorage.setItem(LENS_KEY, l);
      else localStorage.removeItem(LENS_KEY);
    } catch {}
  }, []);
  const setPerRow = useCallback((p: PerRow) => {
    setPerRowState(p);
    try {
      localStorage.setItem(PER_ROW_KEY, String(p));
    } catch {}
  }, []);
  const shown = useMemo<Days>(() => {
    if (!activeLens) return days;
    const out: Days = {};
    for (const [date, list] of Object.entries(dayActs)) {
      if (list.includes(activeLens)) out[date] = 3;
    }
    return out;
  }, [activeLens, days, dayActs]);
  const lensInfo = useMemo(
    () =>
      activeLens ? { name: activeLens, counts: monthCounts(shown) } : null,
    [activeLens, shown]
  );

  const weekData = useMemo(() => {
    if (!cal) return null;
    const marks = new Map<string, string[]>();
    for (const [date, labels] of cal.milestones) {
      const pos = weekOf(cal, dayNumberOf(date));
      if (!pos) continue;
      const k = `${pos.age}:${pos.w}`;
      marks.set(k, [...(marks.get(k) ?? []), ...labels]);
    }
    return { counts: weekCounts(cal, Object.keys(shown)), marks };
  }, [cal, shown]);

  const navigate = useCallback((level: ViewLevel, f?: Partial<Focus>) => {
    if (f) focus.current = { ...focus.current, ...f };
    setAway(null);
    setView(v => ({ level, seq: v.seq + 1 }));
  }, []);

  const goToday = useCallback(() => {
    setToday(todayKey());
    focus.current = todayFocus();
    setAway(null);
    setView(v => ({ ...v, seq: v.seq + 1 }));
  }, []);

  const writeToday = useCallback(() => {
    const t = todayKey();
    setToday(t);
    setOpenDay(t);
  }, []);

  const onFocusSection = useCallback(
    (el: HTMLElement) => {
      if (el.dataset.decade !== undefined) {
        // Weeks: track the year of age at the top of the screen.
        const top =
          (headerRef.current?.getBoundingClientRect().bottom ?? 0) + 8;
        for (const row of el.querySelectorAll<HTMLElement>('[data-age]')) {
          if (row.getBoundingClientRect().bottom > top) {
            const y = (cal?.by ?? 0) + Number(row.dataset.age);
            if (y !== focus.current.y) {
              focus.current = { y, m: cal && y === cal.ty ? cal.tm : 0 };
            }
            return;
          }
        }
        return;
      }
      const y = Number(el.dataset.y);
      if (el.dataset.m !== undefined)
        focus.current = { y, m: Number(el.dataset.m) };
      else if (y !== focus.current.y) {
        focus.current = { y, m: cal && y === cal.ty ? cal.tm : 0 };
      }
    },
    [cal]
  );

  const onYear = useCallback(
    (y: number) => navigate('year', { y, m: cal && y === cal.ty ? cal.tm : 0 }),
    [navigate, cal]
  );
  const onMonth = useCallback(
    (y: number, m: number) => navigate('month', { y, m }),
    [navigate]
  );

  const onSaved = useCallback((date: string, lv: Level, acts: string[]) => {
    setDays(d => {
      if ((d[date] ?? 0) === lv) return d;
      const next = { ...d };
      if (lv) next[date] = lv;
      else delete next[date];
      return next;
    });
    setDayActs(d => {
      const prev = d[date] ?? [];
      if (prev.length === acts.length && prev.every((a, i) => a === acts[i]))
        return d;
      const next = { ...d };
      if (acts.length) next[date] = acts;
      else delete next[date];
      return next;
    });
  }, []);

  const onPick = useCallback(
    (date: string) => {
      const [y, m] = parseDate(date);
      setDialog(null);
      navigate('month', { y, m });
      setOpenDay(date);
    },
    [navigate]
  );

  // Keyboard: 1–4 levels, N write today, T today, / search, Esc zooms out.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = document.activeElement;
      if (
        document.querySelector('dialog[open]') ||
        a?.tagName === 'TEXTAREA' ||
        a?.tagName === 'INPUT' ||
        a?.tagName === 'SELECT' ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }
      const n = Number(e.key);
      if (e.key === 'Escape') {
        const out = ZOOM_OUT[view.level];
        if (out) navigate(out);
      } else if (e.key === 't' || e.key === 'T') goToday();
      else if ((e.key === 'n' || e.key === 'N') && cal) writeToday();
      else if (e.key === '/' && cal) {
        e.preventDefault();
        setDialog('search');
      } else if (n >= 1 && n <= LEVELS.length) {
        navigate((LEVELS[n - 1] as (typeof LEVELS)[number]).lv);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view.level, navigate, goToday, writeToday, cal]);

  let body: ReactNode = null;
  if (loadError) {
    body = (
      <div className={s.empty}>
        <p>Could not reach the server. Retrying…</p>
        <button
          type="button"
          className={ui.primary}
          onClick={() => void load()}
        >
          Try again
        </button>
      </div>
    );
  } else if (settings && !cal) {
    body = (
      <div className={s.empty}>
        <p>Add your birth date to lay out your years.</p>
        <button
          type="button"
          className={ui.primary}
          onClick={() => setDialog('settings')}
        >
          Add birth date
        </button>
      </div>
    );
  } else if (cal) {
    // Keep focus inside the life being shown.
    const f = focus.current;
    if (f.y < cal.by || (f.y === cal.by && f.m < cal.bm))
      focus.current = { y: cal.by, m: cal.bm };
    if (f.y > cal.ey) focus.current = { y: cal.ey, m: 11 };
    const { y, m } = focus.current;
    const years = cal.ey - cal.by + 1;
    const key = `${view.level}-${view.seq}`;

    if (view.level === 'life') {
      body = (
        <LifeView
          key={key}
          cal={cal}
          days={shown}
          focusYear={y}
          onYear={onYear}
          onEditLife={() => setDialog('eras')}
        />
      );
    } else if (view.level === 'weeks') {
      const todayAge = weekOf(cal, dayNumberOf(cal.today))?.age ?? 0;
      const focusAge = Math.max(0, Math.min(cal.span, y - cal.by));
      body = weekData && (
        <ScrollList
          key={`${key}-${perRow}`}
          count={Math.floor(cal.span / 10) + 1}
          anchor={Math.floor(focusAge / 10)}
          homeIndex={Math.floor(todayAge / 10)}
          onAway={setAway}
          headerRef={headerRef}
          onFocus={onFocusSection}
          renderItem={i => (
            <WeeksSection
              decade={i}
              cal={cal}
              counts={weekData.counts}
              marks={weekData.marks}
              perRow={perRow}
              onPerRow={setPerRow}
              onWeek={onMonth}
            />
          )}
        />
      );
    } else if (view.level === 'year') {
      body = (
        <ScrollList
          key={key}
          count={years}
          anchor={y - cal.by}
          homeIndex={cal.ty - cal.by}
          onAway={setAway}
          headerRef={headerRef}
          onFocus={onFocusSection}
          renderItem={i => (
            <YearSection
              y={cal.by + i}
              cal={cal}
              days={shown}
              lens={lensInfo}
              onMonth={onMonth}
            />
          )}
        />
      );
    } else {
      body = (
        <ScrollList
          key={key}
          count={years * 12}
          anchor={(y - cal.by) * 12 + m}
          homeIndex={(cal.ty - cal.by) * 12 + cal.tm}
          onAway={setAway}
          headerRef={headerRef}
          onFocus={onFocusSection}
          renderItem={i => (
            <MonthSection
              y={cal.by + Math.floor(i / 12)}
              m={i % 12}
              cal={cal}
              days={shown}
              lens={lensInfo}
              onDay={setOpenDay}
            />
          )}
        />
      );
    }
  }

  const showAway = away && cal && view.level !== 'life';

  return (
    <>
      <Header
        ref={headerRef}
        cal={cal}
        days={shown}
        level={view.level}
        lens={activeLens}
        lensOptions={lensOptions}
        onLens={setLens}
        onLevel={lv => navigate(lv)}
        onWrite={writeToday}
        onToday={goToday}
        onSearch={() => setDialog('search')}
        onEditLife={() => setDialog('eras')}
        onSettings={() => setDialog('settings')}
      />
      <main className={s.main}>{body}</main>
      {showAway && (
        <button type="button" className={s.home} onClick={goToday}>
          <span aria-hidden="true">{away === 'up' ? '↑' : '↓'}</span>
          {view.level === 'month' ? 'This month' : 'This year'}
        </button>
      )}
      {cal && settings && (
        <DayDialog
          date={openDay}
          cal={cal}
          activities={settings.activities}
          onDate={setOpenDay}
          onSaved={onSaved}
          toast={toast}
        />
      )}
      <SettingsDialog
        open={dialog === 'settings'}
        settings={settings ?? DEFAULT_SETTINGS}
        today={today}
        onClose={() => setDialog(d => (d === 'settings' ? null : d))}
        onSaved={next => {
          setSettings(next);
          setDialog(null);
          navigate(view.level);
        }}
        onImported={() => {
          setDialog(null);
          void load().then(() => navigate(view.level));
        }}
        onEditLife={() => setDialog('eras')}
        toast={toast}
      />
      <ErasDialog
        open={dialog === 'eras'}
        settings={settings ?? DEFAULT_SETTINGS}
        onClose={() => setDialog(d => (d === 'eras' ? null : d))}
        onSaved={next => {
          setSettings(next);
          setDialog(null);
          navigate(view.level);
        }}
        toast={toast}
      />
      <SearchDialog
        open={dialog === 'search'}
        onClose={() => setDialog(d => (d === 'search' ? null : d))}
        onPick={onPick}
      />
      <Toast msg={msg} />
    </>
  );
}
