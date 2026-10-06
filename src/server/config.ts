import path from 'node:path';

const dataDir = path.resolve(process.env.DATA_DIR ?? './data');

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  dataDir,
  journalDir: path.join(dataDir, 'journal'),
  trashDir: path.join(dataDir, '.trash'),
  trashDays: Number(process.env.TRASH_DAYS ?? 30),
};
