import { z } from 'zod';
import { isValidDate } from '../shared/date.ts';
import type { ImportResult, PrototypeExport } from '../shared/types.ts';
import type { Journal } from './journal.ts';
import { type SettingsStore, settingsSchema } from './settings.ts';

const entrySchema = z.object({
  note: z.string().optional().default(''),
  acts: z.array(z.string()).optional().default([]),
  updated: z.number().optional(),
});

export const exportSchema = z.object({
  settings: z.unknown().optional(),
  entries: z.record(z.string(), z.unknown()),
});

/**
 * Loads a prototype JSON export. Matches the prototype's import: entries in
 * the file overwrite existing days, and settings are only taken if no birth
 * date is set yet.
 */
export async function importExport(
  data: z.infer<typeof exportSchema>,
  journal: Journal,
  settings: SettingsStore
): Promise<ImportResult> {
  let imported = 0;
  let skipped = 0;
  for (const [date, value] of Object.entries(data.entries)) {
    const entry = entrySchema.safeParse(value);
    if (!isValidDate(date) || !entry.success) {
      skipped++;
      continue;
    }
    const { note, acts, updated } = entry.data;
    const iso =
      updated && Number.isFinite(updated)
        ? new Date(updated).toISOString()
        : undefined;
    await journal.write(date, { note, activities: acts }, iso);
    imported++;
  }

  let settingsApplied = false;
  const current = await settings.get();
  if (!current.birth && data.settings && typeof data.settings === 'object') {
    const next = settingsSchema.safeParse({ ...current, ...data.settings });
    if (next.success && next.data.birth) {
      await settings.put(next.data);
      settingsApplied = true;
    }
  }
  return { imported, skipped, settingsApplied };
}

export async function exportAll(
  journal: Journal,
  settings: SettingsStore
): Promise<PrototypeExport> {
  const entries: PrototypeExport['entries'] = {};
  for (const date of await journal.dates()) {
    const e = await journal.read(date);
    const updated = e.updated ? Date.parse(e.updated) : Number.NaN;
    entries[date] = {
      note: e.note,
      acts: e.activities,
      ...(Number.isFinite(updated) ? { updated } : {}),
    };
  }
  return { settings: await settings.get(), entries };
}
