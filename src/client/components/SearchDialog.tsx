import { Fragment, useEffect, useRef, useState } from 'react';
import type { SearchResult } from '../../shared/types.ts';
import { api } from '../api.ts';
import { fmt, longDate } from '../lib/cal.ts';
import { backdropDismiss } from '../lib/dialog.ts';
import ui from '../styles/ui.module.css';
import s from './Dialog.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (date: string) => void;
}

const DELAY = 200;

export function SearchDialog({ open, onClose, onPick }: Props) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [dismiss] = useState(() => backdropDismiss());
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<SearchResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = dlg.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      input.current?.select();
    } else if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!q.trim()) {
      setRes(null);
      return;
    }
    let stale = false;
    const t = setTimeout(() => {
      api.search(q).then(
        r => {
          if (stale) return;
          setRes(r);
          setFailed(false);
        },
        () => {
          if (!stale) setFailed(true);
        }
      );
    }, DELAY);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q]);

  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);

  return (
    <dialog
      ref={dlg}
      {...dismiss}
      aria-labelledby="searchTitle"
      className={s.search}
      onClose={onClose}
    >
      <div className={s.head}>
        <h3 id="searchTitle">Search</h3>
        <button
          type="button"
          className={ui.icon}
          aria-label="Close"
          onClick={() => dlg.current?.close()}
        >
          ×
        </button>
      </div>
      <input
        ref={input}
        type="search"
        placeholder="Words in a note or an activity"
        aria-label="Search entries"
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => {
          const first = res?.hits[0];
          if (e.key === 'Enter' && first) onPick(first.date);
        }}
      />
      <div className={s.results} aria-live="polite">
        {failed && <p className={s.hint}>Search failed. Is the server up?</p>}
        {res && !failed && (
          <p className={s.hint}>
            {res.total === 0
              ? 'No matching days.'
              : `${fmt(res.total)} ${res.total === 1 ? 'day' : 'days'}${res.total > res.hits.length ? `, showing the newest ${res.hits.length}` : ''}`}
          </p>
        )}
        <ul>
          {res?.hits.map(h => (
            <li key={h.date}>
              <button type="button" onClick={() => onPick(h.date)}>
                <span className={s.hitDate}>
                  {longDate(h.date)}
                  {h.activities.length > 0 && (
                    <small> · {h.activities.join(', ')}</small>
                  )}
                </span>
                {h.snippet && (
                  <span className={s.hitText}>
                    <Highlight text={h.snippet} terms={terms} />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(
    `(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi'
  );
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: split output is positional
          <mark key={i}>{part}</mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: split output is positional
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}
