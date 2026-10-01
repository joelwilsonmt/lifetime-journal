import { useCallback, useEffect, useRef, useState } from 'react';
import { dayNumberOf, shiftDate } from '../../shared/date.ts';
import { level } from '../../shared/level.ts';
import type { DayEntry, Level } from '../../shared/types.ts';
import { api, ConflictError } from '../api.ts';
import { type Cal, fmt, longDate } from '../lib/cal.ts';
import { backdropDismiss } from '../lib/dialog.ts';
import ui from '../styles/ui.module.css';
import s from './Dialog.module.css';

interface Props {
  date: string | null;
  cal: Cal;
  activities: string[];
  onDate: (date: string | null) => void;
  onSaved: (date: string, lv: Level, acts: string[]) => void;
  toast: (msg: string) => void;
}

type Status = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_DELAY = 400;
const RETRY_DELAY = 5000;
const SWIPE_MIN = 60;

export function DayDialog({
  date,
  cal,
  activities,
  onDate,
  onSaved,
  toast,
}: Props) {
  const dlg = useRef<HTMLDialogElement>(null);
  const noteEl = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState('');
  const [acts, setActs] = useState<string[]>([]);
  // The date whose content is loaded into the editor. Null while loading, so
  // nothing is saved over a day before we've read it.
  const [loaded, setLoaded] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  // Set when the server rejected a save because the day changed elsewhere.
  const [conflict, setConflict] = useState<DayEntry | null>(null);

  // Refs mirror the latest edit so flush() never saves stale closure values.
  const live = useRef({
    date: null as string | null,
    note: '',
    acts: [] as string[],
    dirty: false,
  });
  // File version each day's edits are based on.
  const versions = useRef(new Map<string, string | null>());
  const blocked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const cur = live.current;
    if (!cur.dirty || !cur.date || blocked.current) return;
    cur.dirty = false;
    const { date: d, note: n, acts: a } = cur;
    setStatus('saving');
    api
      .saveDay(
        d,
        { note: n, activities: a },
        () => versions.current.get(d) ?? null
      )
      .then(
        version => {
          versions.current.set(d, version);
          onSaved(d, level(n, a), a);
          if (live.current.date === d && !live.current.dirty)
            setStatus('saved');
        },
        err => {
          if (live.current.date !== d) {
            toast(`Could not save ${longDate(d)}`);
            return;
          }
          live.current.dirty = true;
          if (err instanceof ConflictError) {
            blocked.current = true;
            setConflict(err.current);
            setStatus('idle');
          } else {
            setStatus('error');
            timer.current = setTimeout(flush, RETRY_DELAY);
          }
        }
      );
  }, [onSaved, toast]);

  // Open/close the native dialog and load the day.
  useEffect(() => {
    const el = dlg.current;
    if (!el) return;
    if (!date) {
      if (el.open) el.close();
      return;
    }
    if (!el.open) el.showModal();
    setLoaded(null);
    setStatus('idle');
    setConflict(null);
    blocked.current = false;
    live.current = { date: null, note: '', acts: [], dirty: false };
    let stale = false;
    api.getDay(date).then(
      e => {
        if (stale) return;
        versions.current.set(date, e.version);
        live.current = { date, note: e.note, acts: e.activities, dirty: false };
        setNote(e.note);
        setActs(e.activities);
        setLoaded(date);
        if (matchMedia('(pointer: fine)').matches) noteEl.current?.focus();
      },
      () => {
        if (!stale) toast('Could not load this day.');
      }
    );
    return () => {
      stale = true;
    };
  }, [date, toast]);

  // Save if the tab is hidden or closed mid-edit.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  const edit = (n: string, a: string[], now: boolean) => {
    if (!loaded || conflict) return;
    live.current = { ...live.current, note: n, acts: a, dirty: true };
    setNote(n);
    setActs(a);
    setStatus('saving');
    clearTimeout(timer.current);
    if (now) flush();
    else timer.current = setTimeout(flush, SAVE_DELAY);
  };

  const resolve = (keep: 'mine' | 'theirs') => {
    if (!conflict || !date) return;
    versions.current.set(date, conflict.version);
    blocked.current = false;
    setConflict(null);
    if (keep === 'theirs') {
      clearTimeout(timer.current);
      live.current = {
        date,
        note: conflict.note,
        acts: conflict.activities,
        dirty: false,
      };
      setNote(conflict.note);
      setActs(conflict.activities);
      setStatus('idle');
      onSaved(
        date,
        level(conflict.note, conflict.activities),
        conflict.activities
      );
    } else {
      flush();
    }
  };

  const go = (n: number) => {
    if (!date || conflict) return;
    flush();
    onDate(shiftDate(date, n));
  };

  // Horizontal swipe on touch screens moves between days. Ignored inside the
  // textarea, where a drag selects text.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const conflictRef = useRef(conflict);
  conflictRef.current = conflict;
  const [dismiss] = useState(() => backdropDismiss(() => !conflictRef.current));

  const chips = [...activities, ...acts.filter(a => !activities.includes(a))];

  let sub = '';
  if (date) {
    const n = dayNumberOf(date) - dayNumberOf(cal.birth) + 1;
    const diff = dayNumberOf(date) - dayNumberOf(cal.today);
    sub = n >= 1 ? `Day ${fmt(n)} of your life` : 'Before you were born';
    if (diff === 0) sub += ', today';
    else if (diff > 0)
      sub += `, ${fmt(diff)} ${diff === 1 ? 'day' : 'days'} from now`;
    const marks = cal.milestones.get(date);
    if (marks) sub += ` · ${marks.join(', ')}`;
  }

  const statusText =
    status === 'saving'
      ? 'Saving…'
      : status === 'saved'
        ? 'Saved'
        : status === 'error'
          ? 'Not saved yet. Retrying…'
          : '';

  return (
    <dialog
      ref={dlg}
      {...dismiss}
      aria-labelledby="dayTitle"
      onCancel={e => {
        // Don't let Esc discard an unresolved conflict.
        if (conflict) e.preventDefault();
      }}
      onClose={() => {
        flush();
        onDate(null);
      }}
      onTouchStart={e => {
        const t = e.touches[0];
        touch.current =
          t && !(e.target instanceof HTMLTextAreaElement)
            ? { x: t.clientX, y: t.clientY }
            : null;
      }}
      onTouchEnd={e => {
        const start = touch.current;
        const t = e.changedTouches[0];
        touch.current = null;
        if (!start || !t) return;
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5) {
          go(dx < 0 ? 1 : -1);
        }
      }}
    >
      <div className={s.head}>
        <h3 id="dayTitle">{date ? longDate(date) : ''}</h3>
        <div className={s.nav}>
          <button
            type="button"
            className={ui.icon}
            aria-label="Previous day"
            disabled={!!conflict}
            onClick={() => go(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className={ui.icon}
            aria-label="Next day"
            disabled={!!conflict}
            onClick={() => go(1)}
          >
            ›
          </button>
          <button
            type="button"
            className={ui.icon}
            aria-label="Close"
            disabled={!!conflict}
            onClick={() => dlg.current?.close()}
          >
            ×
          </button>
        </div>
      </div>
      <div className={s.sub}>{sub}</div>
      {conflict && (
        <div className={s.conflict} role="alert">
          <p>
            This day was changed on another device or in Obsidian since you
            opened it.
          </p>
          <div>
            <button
              type="button"
              className={ui.plain}
              onClick={() => resolve('theirs')}
            >
              Use the other version
            </button>{' '}
            <button
              type="button"
              className={ui.plain}
              onClick={() => resolve('mine')}
            >
              Keep mine
            </button>
          </div>
          {conflict.note && (
            <blockquote className={s.theirs}>{conflict.note}</blockquote>
          )}
        </div>
      )}
      <div className={s.chips}>
        {chips.map(a => {
          const on = acts.includes(a);
          return (
            <button
              key={a}
              type="button"
              className={s.chip}
              aria-pressed={on}
              disabled={!loaded || !!conflict}
              onClick={() =>
                edit(note, on ? acts.filter(x => x !== a) : [...acts, a], true)
              }
            >
              {a}
            </button>
          );
        })}
      </div>
      <textarea
        ref={noteEl}
        className={s.note}
        placeholder="What happened today? What mattered?"
        aria-label="Note"
        value={loaded ? note : ''}
        readOnly={!loaded || !!conflict}
        onChange={e => edit(e.target.value, acts, false)}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
            dlg.current?.close();
        }}
      />
      <div className={s.row}>
        <button
          type="button"
          className={ui.quiet}
          disabled={!loaded || !!conflict}
          onClick={() => {
            edit('', [], true);
            toast('Day cleared');
          }}
        >
          Clear this day
        </button>
        <span className={s.end}>
          <span
            className={s.status}
            data-status={status}
            role="status"
            aria-live="polite"
          >
            {statusText}
          </span>
          <button
            type="button"
            className={ui.primary}
            disabled={!!conflict}
            onClick={() => dlg.current?.close()}
          >
            Done
          </button>
        </span>
      </div>
    </dialog>
  );
}
