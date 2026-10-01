import { useEffect, useRef, useState } from 'react';
import type {
  ImportResult,
  PrototypeExport,
  Settings,
} from '../../shared/types.ts';
import {
  type Appearance,
  FONTS,
  type Font,
  MODES,
  type Mode,
  THEMES,
  type Theme,
} from '../../shared/types.ts';
import { api } from '../api.ts';
import { fmt } from '../lib/cal.ts';
import { backdropDismiss } from '../lib/dialog.ts';
import ui from '../styles/ui.module.css';
import s from './Dialog.module.css';

interface Props {
  open: boolean;
  settings: Settings;
  today: string;
  onClose: () => void;
  onSaved: (s: Settings) => void;
  onImported: (r: ImportResult) => void;
  onEditLife: () => void;
  /** Applied and saved immediately, unlike the fields above. */
  onAppearance: (a: Partial<Appearance>) => void;
  toast: (msg: string) => void;
}

const THEME_NAMES: Record<Theme, string> = {
  pine: 'Pine',
  ember: 'Ember',
  tide: 'Tide',
  dusk: 'Dusk',
  ledger: 'Ledger',
};
const MODE_NAMES: Record<Mode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};
const FONT_NAMES: Record<Font, string> = {
  spectral: 'Spectral',
  besley: 'Besley',
  instrument: 'Instrument Sans',
  courier: 'Courier Prime',
};
const FONT_STACKS: Record<Font, string> = {
  spectral: 'Spectral, serif',
  besley: 'Besley, serif',
  instrument: "'Instrument Sans', sans-serif",
  courier: "'Courier Prime', monospace",
};

export function SettingsDialog({
  open,
  settings,
  today,
  onClose,
  onSaved,
  onImported,
  onEditLife,
  onAppearance,
  toast,
}: Props) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [dismiss] = useState(() => backdropDismiss());
  const birthEl = useRef<HTMLInputElement>(null);
  const fileEl = useRef<HTMLInputElement>(null);
  const [birth, setBirth] = useState('');
  const [span, setSpan] = useState('75');
  const [acts, setActs] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = dlg.current;
    if (!el) return;
    if (open && !el.open) {
      setBirth(settings.birth ?? '');
      setSpan(String(settings.span));
      setActs(settings.activities.join(', '));
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, settings]);

  const save = async () => {
    if (!birth) {
      toast('Add a birth date to lay out your years');
      birthEl.current?.focus();
      return;
    }
    if (birth > today) {
      toast('Birth date has to be in the past');
      birthEl.current?.focus();
      return;
    }
    const next: Settings = {
      ...settings,
      birth,
      span: Math.min(120, Math.max(1, Number.parseInt(span, 10) || 75)),
      activities: acts
        .split(',')
        .map(a => a.trim())
        .filter(Boolean)
        .slice(0, 12),
    };
    setBusy(true);
    try {
      onSaved(await api.putSettings(next));
      toast('Settings saved');
    } catch (err) {
      toast(`Could not save settings: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const exportAs = async (kind: 'json' | 'md') => {
    try {
      const data = await api.exportAll();
      if (kind === 'json') {
        download(
          `lifetime-calendar-${today}.json`,
          JSON.stringify(data, null, 2),
          'application/json'
        );
      } else {
        download(`journal-${today}.md`, toMarkdown(data), 'text/markdown');
      }
    } catch {
      toast('Export failed');
    }
  };

  const importFile = async (file: File) => {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      toast(
        'That file is not a calendar export. Choose a .json file exported from here.'
      );
      return;
    }
    setBusy(true);
    try {
      const r = await api.importAll(data);
      onImported(r);
      toast(`Imported ${fmt(r.imported)} ${r.imported === 1 ? 'day' : 'days'}`);
    } catch {
      toast(
        'That file is not a calendar export. Choose a .json file exported from here.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={dlg} {...dismiss} aria-labelledby="setTitle" onClose={onClose}>
      <div className={s.head}>
        <h3 id="setTitle">Settings</h3>
        <button
          type="button"
          className={ui.icon}
          aria-label="Close"
          onClick={() => dlg.current?.close()}
        >
          ×
        </button>
      </div>
      <label className={s.label} htmlFor="birth">
        Birth date
      </label>
      <input
        ref={birthEl}
        type="date"
        id="birth"
        value={birth}
        onChange={e => setBirth(e.target.value)}
      />
      <label className={s.label} htmlFor="span">
        Through age
      </label>
      <input
        type="number"
        id="span"
        min={1}
        max={120}
        inputMode="numeric"
        value={span}
        onChange={e => setSpan(e.target.value)}
      />
      <label className={s.label} htmlFor="acts">
        Activities you track (comma separated)
      </label>
      <input
        type="text"
        id="acts"
        placeholder="Workout, Read, Outside"
        value={acts}
        onChange={e => setActs(e.target.value)}
      />
      <p className={s.hint}>
        <button type="button" className={ui.quiet} onClick={onEditLife}>
          Eras and milestones
        </button>
      </p>

      <h4 className={s.sectionHead}>
        Appearance <small className={s.headNote}>applies right away</small>
      </h4>
      <fieldset className={s.themes}>
        <legend className={s.srOnly}>Theme</legend>
        {THEMES.map(t => (
          <label key={t} data-palette={t} className={s.swatch}>
            <input
              type="radio"
              name="theme"
              className={s.srOnly}
              checked={settings.theme === t}
              onChange={() => onAppearance({ theme: t })}
            />
            <span className={s.ramp} aria-hidden="true">
              <i style={{ background: 'var(--f1)' }} />
              <i style={{ background: 'var(--f2)' }} />
              <i style={{ background: 'var(--f3)' }} />
              <i style={{ background: 'var(--f4)' }} />
              <i className={s.today} />
            </span>
            {THEME_NAMES[t]}
          </label>
        ))}
      </fieldset>
      <fieldset className={s.optRow}>
        <legend className={s.optLabel}>Mode</legend>
        <span className={s.opts}>
          {MODES.map(m => (
            <label key={m}>
              <input
                type="radio"
                name="mode"
                className={s.srOnly}
                checked={settings.mode === m}
                onChange={() => onAppearance({ mode: m })}
              />
              {MODE_NAMES[m]}
            </label>
          ))}
        </span>
      </fieldset>
      <fieldset className={s.optRow}>
        <legend className={s.optLabel}>Type</legend>
        <span className={s.opts}>
          {FONTS.map(f => (
            <label key={f} style={{ fontFamily: FONT_STACKS[f] }}>
              <input
                type="radio"
                name="font"
                className={s.srOnly}
                checked={settings.font === f}
                onChange={() => onAppearance({ font: f })}
              />
              {FONT_NAMES[f]}
            </label>
          ))}
        </span>
      </fieldset>
      <div className={s.row}>
        <span>
          <button
            type="button"
            className={ui.quiet}
            onClick={() => exportAs('json')}
          >
            Export JSON
          </button>{' '}
          <button
            type="button"
            className={ui.quiet}
            onClick={() => exportAs('md')}
          >
            Export Markdown
          </button>{' '}
          <button
            type="button"
            className={ui.quiet}
            disabled={busy}
            onClick={() => fileEl.current?.click()}
          >
            Import JSON
          </button>
          <input
            ref={fileEl}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={e => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void importFile(f);
            }}
          />
        </span>
        <button
          type="button"
          className={ui.primary}
          disabled={busy}
          onClick={save}
        >
          Save
        </button>
      </div>
      <p className={s.hint}>
        Each day is saved on the server as a markdown file in{' '}
        <code>data/journal</code>. Keys: 1–4 switch views, N writes today, T
        jumps to today, / searches, Esc zooms out.
      </p>
    </dialog>
  );
}

function toMarkdown(data: PrototypeExport): string {
  const keys = Object.keys(data.entries).sort();
  return `# Journal\n\n${keys
    .map(key => {
      const e = data.entries[key];
      if (!e) return '';
      const acts = e.acts.length ? `Activities: ${e.acts.join(', ')}\n\n` : '';
      return `## ${key}\n\n${acts}${e.note.trim()}\n`;
    })
    .join('\n')}`;
}

function download(filename: string, data: string, mime: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: mime }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
