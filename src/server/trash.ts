import { copyFile, mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { isNotFound } from './fsutil.ts';

const NAME_RE = /^(\d{4}-\d{2}-\d{2})\.deleted-(\d+)\.md$/;

/**
 * Cleared days go here instead of being deleted, as
 * `YYYY-MM-DD.deleted-<ms>.md`, so a mis-click is recoverable (move the file
 * back to journal/YYYY/MM/YYYY-MM-DD.md). Pruned by age and count so it
 * never grows without bound.
 */
export class Trash {
  readonly dir: string;
  readonly maxAgeDays: number;
  readonly maxFiles: number;

  constructor(dir: string, { maxAgeDays = 30, maxFiles = 500 } = {}) {
    this.dir = path.resolve(dir);
    this.maxAgeDays = maxAgeDays;
    this.maxFiles = maxFiles;
  }

  /** Move a day's file into the trash. A missing file is a no-op. */
  async put(file: string, date: string, now = Date.now()): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const dest = path.join(this.dir, `${date}.deleted-${now}.md`);
    try {
      await rename(file, dest);
    } catch (err) {
      if (isNotFound(err)) return;
      // Different filesystem (e.g. trash on another mount): copy, then remove.
      if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;
      await copyFile(file, dest);
      await rm(file, { force: true });
    }
    await this.prune(now);
  }

  /** Drop entries older than maxAgeDays, then the oldest beyond maxFiles. */
  async prune(now = Date.now()): Promise<number> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch (err) {
      if (isNotFound(err)) return 0;
      throw err;
    }
    const entries = names
      .map(name => ({ name, at: Number(NAME_RE.exec(name)?.[2]) }))
      .filter(e => Number.isFinite(e.at))
      .sort((a, b) => b.at - a.at);
    const cutoff = now - this.maxAgeDays * 864e5;
    const doomed = entries.filter(
      (e, i) => e.at < cutoff || i >= this.maxFiles
    );
    await Promise.all(
      doomed.map(e => rm(path.join(this.dir, e.name), { force: true }))
    );
    return doomed.length;
  }
}
