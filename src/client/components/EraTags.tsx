import type { Cal } from '../lib/cal.ts';
import { type EraSpan, eraColor } from '../lib/life.ts';
import s from './sections.module.css';

/** Era names with their color, for section headings. */
export function EraTags({ cal, eras }: { cal: Cal; eras: EraSpan[] }) {
  if (!eras.length) return null;
  return (
    <span className={s.eraTags}>
      {eras.map(({ era }) => (
        <span key={era.label + era.start}>
          <i style={{ background: eraColor(cal, era) }} />
          {era.label}
        </span>
      ))}
    </span>
  );
}
