import { randomBytes } from 'node:crypto';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import path from 'node:path';

/** Write to a temp file in the same directory, fsync, then rename over the target. */
export async function writeFileAtomic(file: string, data: string) {
  const dir = path.dirname(file);
  await mkdir(dir, { recursive: true });
  // Dot-prefixed so Obsidian and the summary scan ignore it if it's ever left behind.
  const tmp = path.join(
    dir,
    `.${path.basename(file)}.${randomBytes(6).toString('hex')}.tmp`
  );
  try {
    const fh = await open(tmp, 'w');
    try {
      await fh.writeFile(data, 'utf8');
      await fh.sync();
    } finally {
      await fh.close();
    }
    await rename(tmp, file);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
}

export const isNotFound = (err: unknown) =>
  (err as NodeJS.ErrnoException)?.code === 'ENOENT';
