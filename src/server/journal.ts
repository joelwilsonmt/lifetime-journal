import { readdir, readFile, rm, rmdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { isValidDate } from '../shared/date.ts';
import { level } from '../shared/level.ts';
import type {
  DayEntry,
  DayInput,
  Level,
  SearchResult,
  Summary,
} from '../shared/types.ts';
import {
  activitiesOf,
  parseDay,
  serializeDay,
  updatedOf,
} from './frontmatter.ts';
import { isNotFound, writeFileAtomic } from './fsutil.ts';
import type { Trash } from './trash.ts';

interface CacheItem {
  version: string;
  level: Level;
  note: string;
  activities: string[];
}

/** Thrown when a write's `base` doesn't match the file on disk. */
export class ConflictError extends Error {
  readonly current: DayEntry;
  constructor(current: DayEntry) {
    super('This day was changed elsewhere');
    this.current = current;
  }
}

const versionOf = (s: { mtimeMs: number; size: number }) =>
  `${s.mtimeMs}:${s.size}`;

/**
 * One markdown file per day at <root>/YYYY/MM/YYYY-MM-DD.md.
 * Files may also be edited outside the app (Obsidian), so the index is
 * rebuilt from disk on demand, re-parsing only files whose version changed.
 * Parsed notes are kept in memory for search; at journal scale that's small.
 */
export class Journal {
  readonly root: string;
  private cache = new Map<string, CacheItem>();
  private scanning: Promise<Map<string, CacheItem>> | null = null;
  private locks = new Map<string, Promise<unknown>>();

  /** Where cleared days go. Without one, clearing deletes outright. */
  readonly trash: Trash | null;

  constructor(root: string, trash: Trash | null = null) {
    this.root = path.resolve(root);
    this.trash = trash;
  }

  /** The only place a file path is built from a date. */
  pathFor(date: string): string {
    if (!isValidDate(date)) throw new Error(`Invalid date: ${date}`);
    const [y, m] = date.split('-');
    return path.join(this.root, y as string, m as string, `${date}.md`);
  }

  async read(date: string): Promise<DayEntry> {
    const file = this.pathFor(date);
    try {
      const [raw, st] = await Promise.all([readFile(file, 'utf8'), stat(file)]);
      const { data, note } = parseDay(raw);
      return {
        date,
        note,
        activities: activitiesOf(data),
        updated: updatedOf(data),
        version: versionOf(st),
      };
    } catch (err) {
      if (!isNotFound(err)) throw err;
      return { date, note: '', activities: [], updated: null, version: null };
    }
  }

  /**
   * Writes the day, or deletes the file if the input is empty. If
   * `input.base` is given and the file has changed since, throws
   * ConflictError instead.
   */
  write(
    date: string,
    input: DayInput,
    updated = new Date().toISOString()
  ): Promise<DayEntry> {
    return this.locked(date, async () => {
      await this.checkBase(date, input.base);
      return this.writeUnlocked(date, input, updated);
    });
  }

  remove(date: string, base?: string | null): Promise<void> {
    return this.locked(date, async () => {
      await this.checkBase(date, base);
      await this.removeUnlocked(date);
    });
  }

  async summary(): Promise<Summary> {
    const index = await this.index();
    const days: Summary['days'] = {};
    const activities: Summary['activities'] = {};
    for (const [date, item] of index) {
      if (item.level === 0) continue;
      days[date] = item.level;
      if (item.activities.length) activities[date] = item.activities;
    }
    return { days, activities };
  }

  /** Every date with an entry, sorted. */
  async dates(): Promise<string[]> {
    return Object.keys((await this.summary()).days).sort();
  }

  /**
   * Case-insensitive search. Every term must appear in the note or an
   * activity. Newest first.
   */
  async search(query: string, limit = 100): Promise<SearchResult> {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return { hits: [], total: 0 };
    const index = await this.index();
    const matches: string[] = [];
    for (const [date, item] of index) {
      const hay = `${item.note}\n${item.activities.join('\n')}`.toLowerCase();
      if (terms.every(t => hay.includes(t))) matches.push(date);
    }
    matches.sort().reverse();
    const hits = matches.slice(0, limit).map(date => {
      const item = index.get(date) as CacheItem;
      return {
        date,
        snippet: snippet(item.note, terms),
        activities: item.activities,
      };
    });
    return { hits, total: matches.length };
  }

  private async checkBase(date: string, base: string | null | undefined) {
    if (base === undefined) return;
    const current = await this.read(date);
    if (current.version !== base) throw new ConflictError(current);
  }

  private async writeUnlocked(
    date: string,
    input: DayInput,
    updated: string
  ): Promise<DayEntry> {
    const note = input.note.replace(/\s+$/, '');
    const activities = [...new Set(input.activities.map(a => a.trim()))].filter(
      Boolean
    );
    if (!note.trim() && activities.length === 0) {
      await this.removeUnlocked(date);
      return {
        date,
        note: '',
        activities: [],
        updated: null,
        version: null,
      };
    }
    const file = this.pathFor(date);
    const raw = await readFile(file, 'utf8').catch(err => {
      if (isNotFound(err)) return null;
      throw err;
    });
    const existing = raw == null ? {} : parseDay(raw).data;
    await writeFileAtomic(
      file,
      serializeDay(existing, activities, updated, note)
    );
    const version = versionOf(await stat(file));
    this.cache.set(date, {
      version,
      level: level(note, activities),
      note,
      activities,
    });
    return { date, note, activities, updated, version };
  }

  private async removeUnlocked(date: string): Promise<void> {
    const file = this.pathFor(date);
    if (this.trash) await this.trash.put(file, date);
    else await rm(file, { force: true });
    this.cache.delete(date);
    // Tidy empty month/year folders; rmdir fails harmlessly if not empty.
    const monthDir = path.dirname(file);
    await rmdir(monthDir).catch(() => {});
    await rmdir(path.dirname(monthDir)).catch(() => {});
  }

  /** Serializes writes per date so a read-modify-write can't interleave. */
  private locked<T>(date: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(date) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    const tail = next.catch(() => {});
    this.locks.set(date, tail);
    void tail.then(() => {
      if (this.locks.get(date) === tail) this.locks.delete(date);
    });
    return next;
  }

  /** Fresh view of every entry file. Concurrent calls share one scan. */
  private index(): Promise<Map<string, CacheItem>> {
    this.scanning ??= this.scan().finally(() => {
      this.scanning = null;
    });
    return this.scanning;
  }

  private async scan(): Promise<Map<string, CacheItem>> {
    const seen = new Set<string>();
    for (const y of await listDir(this.root)) {
      if (!/^\d{4}$/.test(y)) continue;
      for (const m of await listDir(path.join(this.root, y))) {
        if (!/^\d{2}$/.test(m)) continue;
        const dir = path.join(this.root, y, m);
        const names = await listDir(dir);
        await Promise.all(
          names.map(async name => {
            const date = name.slice(0, -3);
            if (
              !name.endsWith('.md') ||
              !isValidDate(date) ||
              !date.startsWith(`${y}-${m}-`)
            ) {
              return;
            }
            try {
              const file = path.join(dir, name);
              const version = versionOf(await stat(file));
              if (this.cache.get(date)?.version !== version) {
                const { data, note } = parseDay(await readFile(file, 'utf8'));
                const activities = activitiesOf(data);
                this.cache.set(date, {
                  version,
                  level: level(note, activities),
                  note,
                  activities,
                });
              }
              seen.add(date);
            } catch (err) {
              if (!isNotFound(err)) throw err;
            }
          })
        );
      }
    }
    for (const date of this.cache.keys()) {
      if (!seen.has(date)) this.cache.delete(date);
    }
    return this.cache;
  }
}

/** A short excerpt around the first matching term. */
function snippet(note: string, terms: string[], width = 160): string {
  const flat = note.replace(/\s+/g, ' ').trim();
  const lower = flat.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1 || flat.length <= width) {
    return flat.length > width ? `${flat.slice(0, width).trimEnd()}…` : flat;
  }
  const start = Math.max(0, at - 50);
  const end = Math.min(flat.length, start + width);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end).trim()}${end < flat.length ? '…' : ''}`;
}

async function listDir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (err) {
    if (isNotFound(err)) return [];
    throw err;
  }
}
