// One-time import of a prototype JSON export into markdown files.
//   pnpm import path/to/lifetime-calendar-YYYY-MM-DD.json
//   docker compose exec lifetime-journal node dist/server/cli/import.js /data/export.json
import { readFile } from 'node:fs/promises';
import { config } from '../config.ts';
import { exportSchema, importExport } from '../importer.ts';
import { Journal } from '../journal.ts';
import { SettingsStore } from '../settings.ts';

const file = process.argv[2];
if (!file) {
  console.error('Usage: import <export.json>');
  process.exit(1);
}

const parsed = exportSchema.safeParse(JSON.parse(await readFile(file, 'utf8')));
if (!parsed.success) {
  console.error(`${file} is not a calendar export (no "entries" object).`);
  process.exit(1);
}

const result = await importExport(
  parsed.data,
  new Journal(config.journalDir),
  new SettingsStore(config.dataDir)
);
console.log(
  `Imported ${result.imported} days into ${config.journalDir}` +
    (result.skipped ? `, skipped ${result.skipped} invalid` : '') +
    (result.settingsApplied ? ', and applied settings' : '')
);
