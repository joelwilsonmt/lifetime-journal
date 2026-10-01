import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isValidDate, shiftDate } from '../shared/date.ts';
import { createApp } from './app.ts';
import { parseDay, serializeDay } from './frontmatter.ts';
import { Journal } from './journal.ts';
import { SettingsStore } from './settings.ts';

let dir: string;
let journal: Journal;
let settings: SettingsStore;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'lifecal-'));
  journal = new Journal(path.join(dir, 'journal'));
  settings = new SettingsStore(dir);
  app = createApp({ journal, settings });
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const json = (method: string, body: unknown) => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('dates', () => {
  it('validates strictly', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2023-02-29')).toBe(false);
    expect(isValidDate('2024-13-01')).toBe(false);
    expect(isValidDate('2024-1-01')).toBe(false);
    expect(isValidDate('../../etc')).toBe(false);
    expect(isValidDate('2024-01-01.md')).toBe(false);
  });
  it('shifts across month and year boundaries', () => {
    expect(shiftDate('2024-12-31', 1)).toBe('2025-01-01');
    expect(shiftDate('2024-03-01', -1)).toBe('2024-02-29');
  });
});

describe('frontmatter', () => {
  it('round-trips and keeps unknown keys', () => {
    const raw = serializeDay(
      { mood: 'good', activities: ['old'] },
      ['Read', 'Walk: long'],
      '2026-01-01T00:00:00.000Z',
      'Line one\n\nLine two\n'
    );
    expect(raw).toContain('activities: [Read, "Walk: long"]');
    const parsed = parseDay(raw);
    expect(parsed.note).toBe('Line one\n\nLine two');
    expect(parsed.data).toMatchObject({
      mood: 'good',
      activities: ['Read', 'Walk: long'],
      updated: '2026-01-01T00:00:00.000Z',
    });
  });
  it('tolerates files without frontmatter and CRLF', () => {
    expect(parseDay('just text\r\n')).toEqual({ data: {}, note: 'just text' });
  });
  it('tolerates Obsidian block-style lists', () => {
    const p = parseDay('---\nactivities:\n  - Read\n  - Run\n---\nHi');
    expect(p.data.activities).toEqual(['Read', 'Run']);
    expect(p.note).toBe('Hi');
  });
});

describe('journal', () => {
  it('writes to YYYY/MM/YYYY-MM-DD.md and deletes when cleared', async () => {
    await journal.write('2024-03-05', { note: 'hello', activities: ['Read'] });
    const file = path.join(dir, 'journal/2024/03/2024-03-05.md');
    expect(await readFile(file, 'utf8')).toMatch(
      /^---\nactivities: \[Read\]\nupdated: .+\n---\n\nhello\n$/
    );
    expect(await journal.summary()).toEqual({
      days: { '2024-03-05': 2 },
      activities: { '2024-03-05': ['Read'] },
    });

    await journal.write('2024-03-05', { note: '  ', activities: [] });
    await expect(stat(file)).rejects.toThrow();
    await expect(stat(path.join(dir, 'journal/2024'))).rejects.toThrow();
    expect((await journal.summary()).days).toEqual({});
  });
  it('picks up files edited outside the app', async () => {
    await journal.write('2024-03-05', { note: 'a', activities: [] });
    expect((await journal.summary()).days['2024-03-05']).toBe(1);
    const file = path.join(dir, 'journal/2024/03/2024-03-05.md');
    await writeFile(
      file,
      `---\nactivities: [a, b, c]\n---\n${'x'.repeat(400)}`
    );
    const later = new Date(Date.now() + 5000);
    const { utimes } = await import('node:fs/promises');
    await utimes(file, later, later);
    expect((await journal.summary()).days['2024-03-05']).toBe(4);
  });
  it('ignores stray files in the tree', async () => {
    await mkdir(path.join(dir, 'journal/2024/03'), { recursive: true });
    await writeFile(path.join(dir, 'journal/2024/03/notes.md'), 'x');
    await writeFile(
      path.join(dir, 'journal/2024/03/2024-04-01.md'),
      'wrong folder'
    );
    await writeFile(
      path.join(dir, 'journal/2024/03/.2024-03-01.md.abc.tmp'),
      'x'
    );
    expect((await journal.summary()).days).toEqual({});
  });
});

describe('api', () => {
  it('rejects bad dates, including traversal attempts', async () => {
    for (const d of ['2024-02-30', 'abc', '..%2F..%2Fetc', '2024-01-01.md']) {
      const res = await app.request(`/api/days/${d}`);
      expect(res.status).toBe(400);
    }
  });
  it('puts, gets, summarizes and deletes a day', async () => {
    let res = await app.request(
      '/api/days/2025-06-01',
      json('PUT', { note: 'Hi', activities: ['Read'] })
    );
    expect(res.status).toBe(200);
    res = await app.request('/api/days/2025-06-01');
    expect(await res.json()).toMatchObject({
      note: 'Hi',
      activities: ['Read'],
    });
    res = await app.request('/api/summary');
    expect(await res.json()).toEqual({
      days: { '2025-06-01': 2 },
      activities: { '2025-06-01': ['Read'] },
    });
    res = await app.request('/api/days/2025-06-01', { method: 'DELETE' });
    expect(res.status).toBe(204);
    res = await app.request('/api/days/2025-06-01');
    expect(await res.json()).toMatchObject({
      note: '',
      activities: [],
      updated: null,
    });
  });
  it('validates bodies', async () => {
    const res = await app.request(
      '/api/days/2025-06-01',
      json('PUT', { note: 5 })
    );
    expect(res.status).toBe(400);
    const r2 = await app.request(
      '/api/settings',
      json('PUT', { birth: '1990-02-30', span: 75, activities: [] })
    );
    expect(r2.status).toBe(400);
  });
  it('stores settings', async () => {
    const s = {
      birth: '1990-04-12',
      span: 80,
      activities: ['Run', 'Run', 'Read'],
    };
    const res = await app.request('/api/settings', json('PUT', s));
    expect(await res.json()).toEqual({
      ...s,
      activities: ['Run', 'Read'],
      eras: [],
      milestones: [],
      theme: 'pine',
      mode: 'system',
      font: 'spectral',
    });
    const fresh = new SettingsStore(dir);
    expect((await fresh.get()).birth).toBe('1990-04-12');
  });
  it('imports a prototype export and exports it back', async () => {
    const exp = {
      settings: { birth: '1990-04-12', span: 75, activities: ['Read'] },
      entries: {
        '2024-01-02': { note: 'one', acts: ['Read'], updated: 1704200000000 },
        '2024-01-03': { note: '', acts: ['Walk'] },
        bogus: { note: 'x' },
      },
    };
    const res = await app.request('/api/import', json('POST', exp));
    expect(await res.json()).toEqual({
      imported: 2,
      skipped: 1,
      settingsApplied: true,
    });
    const back = await (await app.request('/api/export')).json();
    expect(back.entries['2024-01-02']).toEqual({
      note: 'one',
      acts: ['Read'],
      updated: 1704200000000,
    });
    expect(back.settings.birth).toBe('1990-04-12');
  });
  it('marks API responses uncacheable', async () => {
    for (const p of ['/api/summary', '/api/settings', '/api/days/2024-02-30']) {
      const res = await app.request(p);
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });
  it('rejects stale writes with 409 and the current entry', async () => {
    const put = (body: unknown) =>
      app.request('/api/days/2025-06-02', json('PUT', body));
    let res = await put({ note: 'first', activities: [], base: null });
    expect(res.status).toBe(200);
    const v1 = (await res.json()).version;
    expect(v1).toEqual(expect.any(String));
    // A second device still thinks the day is empty.
    res = await put({ note: 'other device', activities: [], base: null });
    expect(res.status).toBe(409);
    expect((await res.json()).current).toMatchObject({
      note: 'first',
      version: v1,
    });
    // Based on the current version, it goes through.
    res = await put({ note: 'second', activities: [], base: v1 });
    expect(res.status).toBe(200);
    const v2 = (await res.json()).version;
    expect(v2).not.toBe(v1);
    // Deletes are guarded too.
    res = await app.request(
      `/api/days/2025-06-02?base=${encodeURIComponent(v1)}`,
      { method: 'DELETE' }
    );
    expect(res.status).toBe(409);
    res = await app.request(
      `/api/days/2025-06-02?base=${encodeURIComponent(v2)}`,
      { method: 'DELETE' }
    );
    expect(res.status).toBe(204);
    // No base means no check (CLI import, older clients).
    res = await put({ note: 'unchecked', activities: [] });
    expect(res.status).toBe(200);
  });
  it('detects edits made outside the app as conflicts', async () => {
    const e = await journal.write('2025-06-03', {
      note: 'app',
      activities: [],
    });
    const file = path.join(dir, 'journal/2025/06/2025-06-03.md');
    await writeFile(file, '---\nactivities: []\n---\nobsidian edit, longer\n');
    await expect(
      journal.write('2025-06-03', {
        note: 'app 2',
        activities: [],
        base: e.version,
      })
    ).rejects.toThrow('changed elsewhere');
  });
  it('searches notes and activities', async () => {
    await journal.write('2024-01-01', {
      note: 'Walked the river trail with Sam',
      activities: ['Outside'],
    });
    await journal.write('2024-02-01', {
      note: 'Read by the river',
      activities: ['Read'],
    });
    await journal.write('2024-03-01', {
      note: 'Quiet day',
      activities: ['Read'],
    });
    const res = await app.request('/api/search?q=river');
    const r = await res.json();
    expect(r.total).toBe(2);
    expect(r.hits.map((h: { date: string }) => h.date)).toEqual([
      '2024-02-01',
      '2024-01-01',
    ]);
    const both = await (await app.request('/api/search?q=RIVER%20sam')).json();
    expect(both.hits).toHaveLength(1);
    const act = await (await app.request('/api/search?q=read')).json();
    expect(act.total).toBe(2);
    const none = await (await app.request('/api/search?q=')).json();
    expect(none).toEqual({ hits: [], total: 0 });
  });
  it('validates and sorts eras and milestones', async () => {
    const base = { birth: '1990-04-12', span: 75, activities: [] };
    let res = await app.request(
      '/api/settings',
      json('PUT', {
        ...base,
        eras: [
          { label: 'Job', start: '2019-01-01', end: null },
          { label: 'College', start: '2008-09-01', end: '2012-05-15' },
        ],
        milestones: [{ label: 'Married', date: '2015-06-20' }],
      })
    );
    expect(res.status).toBe(200);
    expect(
      (await res.json()).eras.map((e: { label: string }) => e.label)
    ).toEqual(['College', 'Job']);
    res = await app.request(
      '/api/settings',
      json('PUT', {
        ...base,
        eras: [{ label: 'Backwards', start: '2012-01-01', end: '2010-01-01' }],
      })
    );
    expect(res.status).toBe(400);
  });
  it('reports health', async () => {
    await mkdir(path.join(dir, 'journal'), { recursive: true });
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
  });
});
