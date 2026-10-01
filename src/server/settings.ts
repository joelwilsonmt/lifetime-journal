import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { isValidDate } from '../shared/date.ts';
import {
  DEFAULT_SETTINGS,
  FONTS,
  MODES,
  type Settings,
  THEMES,
} from '../shared/types.ts';
import { isNotFound, writeFileAtomic } from './fsutil.ts';

const dateSchema = z.string().refine(isValidDate, 'Must be a YYYY-MM-DD date');
const labelSchema = z.string().trim().min(1).max(60);

const eraSchema = z
  .object({
    label: labelSchema,
    start: dateSchema,
    end: dateSchema.nullable(),
  })
  .refine(e => e.end === null || e.end >= e.start, 'Era ends before it starts');

const milestoneSchema = z.object({ label: labelSchema, date: dateSchema });

export const settingsSchema = z.object({
  birth: z
    .string()
    .refine(isValidDate, 'Must be a YYYY-MM-DD date')
    .refine(s => s >= '1900-01-01', 'Must be 1900 or later')
    .nullable(),
  span: z.number().int().min(1).max(120),
  activities: z
    .array(z.string().trim().min(1).max(40))
    .max(12)
    .transform(a => [...new Set(a)]),
  eras: z
    .array(eraSchema)
    .max(50)
    .default([])
    .transform(a => a.toSorted((x, y) => x.start.localeCompare(y.start))),
  milestones: z
    .array(milestoneSchema)
    .max(500)
    .default([])
    .transform(a => a.toSorted((x, y) => x.date.localeCompare(y.date))),
  theme: z.enum(THEMES).default('pine'),
  mode: z.enum(MODES).default('system'),
  font: z.enum(FONTS).default('spectral'),
});

export class SettingsStore {
  readonly file: string;
  private cached: Settings | null = null;

  constructor(dataDir: string) {
    this.file = path.join(path.resolve(dataDir), 'settings.json');
  }

  async get(): Promise<Settings> {
    if (this.cached) return this.cached;
    let raw: string;
    try {
      raw = await readFile(this.file, 'utf8');
    } catch (err) {
      if (isNotFound(err)) return DEFAULT_SETTINGS;
      throw err;
    }
    const parsed = settingsSchema.safeParse({
      ...DEFAULT_SETTINGS,
      ...JSON.parse(raw),
    });
    if (!parsed.success) {
      console.warn(`Ignoring invalid ${this.file}: ${parsed.error.message}`);
      return DEFAULT_SETTINGS;
    }
    this.cached = parsed.data;
    return parsed.data;
  }

  async put(settings: Settings): Promise<Settings> {
    await writeFileAtomic(this.file, `${JSON.stringify(settings, null, 2)}\n`);
    this.cached = settings;
    return settings;
  }
}
