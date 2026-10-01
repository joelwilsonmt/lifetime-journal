import { useEffect, useRef, useState } from 'react';
import type { Era, Milestone, Settings } from '../../shared/types.ts';
import { api } from '../api.ts';
import { backdropDismiss } from '../lib/dialog.ts';
import ui from '../styles/ui.module.css';
import s from './Dialog.module.css';

interface Props {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onSaved: (s: Settings) => void;
  toast: (msg: string) => void;
}

type EraRow = { label: string; start: string; end: string };
type MarkRow = Milestone;

export function ErasDialog({ open, settings, onClose, onSaved, toast }: Props) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [dismiss] = useState(() => backdropDismiss());
  const [eras, setEras] = useState<EraRow[]>([]);
  const [marks, setMarks] = useState<MarkRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = dlg.current;
    if (!el) return;
    if (open && !el.open) {
      setEras(settings.eras.map(e => ({ ...e, end: e.end ?? '' })));
      setMarks(settings.milestones.map(m => ({ ...m })));
      el.showModal();
    } else if (!open && el.open) el.close();
  }, [open, settings]);

  const save = async () => {
    const nextEras: Era[] = [];
    for (const e of eras) {
      if (!e.label.trim() && !e.start) continue;
      if (!e.label.trim() || !e.start) {
        toast('Each era needs a name and a start date');
        return;
      }
      if (e.end && e.end < e.start) {
        toast(`"${e.label}" ends before it starts`);
        return;
      }
      nextEras.push({
        label: e.label.trim(),
        start: e.start,
        end: e.end || null,
      });
    }
    const nextMarks: Milestone[] = [];
    for (const m of marks) {
      if (!m.label.trim() && !m.date) continue;
      if (!m.label.trim() || !m.date) {
        toast('Each milestone needs a name and a date');
        return;
      }
      nextMarks.push({ label: m.label.trim(), date: m.date });
    }
    setBusy(true);
    try {
      onSaved(
        await api.putSettings({
          ...settings,
          eras: nextEras,
          milestones: nextMarks,
        })
      );
      toast('Saved');
    } catch (err) {
      toast(`Could not save: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const setEra = (i: number, patch: Partial<EraRow>) =>
    setEras(list => list.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const setMark = (i: number, patch: Partial<MarkRow>) =>
    setMarks(list => list.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  return (
    <dialog
      ref={dlg}
      {...dismiss}
      aria-labelledby="erasTitle"
      onClose={onClose}
    >
      <div className={s.head}>
        <h3 id="erasTitle">Eras and milestones</h3>
        <button
          type="button"
          className={ui.icon}
          aria-label="Close"
          onClick={() => dlg.current?.close()}
        >
          ×
        </button>
      </div>
      <p className={s.sub}>
        Eras are stretches of life, like a city, a school or a job. Milestones
        are single days. Both show on the calendar.
      </p>

      <h4 className={s.sectionHead}>Eras</h4>
      {eras.map((e, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional while editing
        <div key={i} className={s.editRow}>
          <input
            type="text"
            aria-label="Era name"
            placeholder="Missoula"
            maxLength={60}
            value={e.label}
            onChange={ev => setEra(i, { label: ev.target.value })}
          />
          <input
            type="date"
            aria-label="Start date"
            value={e.start}
            onChange={ev => setEra(i, { start: ev.target.value })}
          />
          <input
            type="date"
            aria-label="End date (blank for ongoing)"
            title="Leave blank if ongoing"
            value={e.end}
            onChange={ev => setEra(i, { end: ev.target.value })}
          />
          <button
            type="button"
            className={ui.icon}
            aria-label={`Remove ${e.label || 'era'}`}
            onClick={() => setEras(list => list.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className={ui.quiet}
        onClick={() =>
          setEras(list => [...list, { label: '', start: '', end: '' }])
        }
      >
        Add an era
      </button>
      <p className={s.hint}>Leave the end date blank if it's ongoing.</p>

      <h4 className={s.sectionHead}>Milestones</h4>
      {marks.map((m, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional while editing
        <div key={i} className={`${s.editRow} ${s.markRow}`}>
          <input
            type="text"
            aria-label="Milestone name"
            placeholder="Married"
            maxLength={60}
            value={m.label}
            onChange={ev => setMark(i, { label: ev.target.value })}
          />
          <input
            type="date"
            aria-label="Date"
            value={m.date}
            onChange={ev => setMark(i, { date: ev.target.value })}
          />
          <button
            type="button"
            className={ui.icon}
            aria-label={`Remove ${m.label || 'milestone'}`}
            onClick={() => setMarks(list => list.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className={ui.quiet}
        onClick={() => setMarks(list => [...list, { label: '', date: '' }])}
      >
        Add a milestone
      </button>

      <div className={s.row}>
        <button
          type="button"
          className={ui.quiet}
          onClick={() => dlg.current?.close()}
        >
          Cancel
        </button>
        <button
          type="button"
          className={ui.primary}
          disabled={busy}
          onClick={save}
        >
          Save
        </button>
      </div>
    </dialog>
  );
}
