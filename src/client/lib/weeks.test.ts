import { describe, expect, it } from 'vitest';
import { dayNumberOf } from '../../shared/date.ts';
import { DEFAULT_SETTINGS } from '../../shared/types.ts';
import { makeCal } from './cal.ts';
import { weekCounts, weekOf, weekRange } from './weeks.ts';

const cal = makeCal({ ...DEFAULT_SETTINGS, birth: '1989-05-30' }, '2026-10-01');
if (!cal) throw new Error('no cal');

describe('weeks of life', () => {
  it('starts each row on a birthday', () => {
    expect(weekOf(cal, dayNumberOf('1989-05-30'))).toEqual({ age: 0, w: 0 });
    expect(weekOf(cal, dayNumberOf('1989-06-05'))).toEqual({ age: 0, w: 0 });
    expect(weekOf(cal, dayNumberOf('1989-06-06'))).toEqual({ age: 0, w: 1 });
    expect(weekOf(cal, dayNumberOf('2026-05-29'))).toEqual({ age: 36, w: 51 });
    expect(weekOf(cal, dayNumberOf('2026-05-30'))).toEqual({ age: 37, w: 0 });
    expect(weekOf(cal, dayNumberOf('1989-05-29'))).toBeNull();
  });
  it('covers every day exactly once', () => {
    let covered = 0;
    for (let w = 0; w < 52; w++) {
      const [a, b] = weekRange(cal, 30, w);
      covered += b - a + 1;
    }
    const [first] = weekRange(cal, 30, 0);
    const [nextFirst] = weekRange(cal, 31, 0);
    expect(covered).toBe(nextFirst - first);
  });
  it('counts written days per week', () => {
    const m = weekCounts(cal, ['2026-05-30', '2026-06-01', '2026-06-06']);
    expect(m.get('37:0')).toBe(2);
    expect(m.get('37:1')).toBe(1);
  });
});
