export type Level = 0 | 1 | 2 | 3 | 4;

/** A labeled span of life, e.g. a city or a job. `end` null means ongoing. */
export interface Era {
  label: string;
  start: string;
  end: string | null;
}

/** A single dated life event. */
export interface Milestone {
  label: string;
  date: string;
}

export interface Settings {
  /** Local calendar date, YYYY-MM-DD. Null until the user sets it. */
  birth: string | null;
  /** Live through this age: the calendar and countdown run to the next birthday. */
  span: number;
  activities: string[];
  eras: Era[];
  milestones: Milestone[];
}

export interface DayEntry {
  date: string;
  note: string;
  activities: string[];
  /** ISO timestamp of the last write, or null if the day has no entry. */
  updated: string | null;
  /**
   * Opaque file version (changes on any write, including Obsidian edits), or
   * null if no file exists. Send it back as `base` to detect conflicts.
   */
  version: string | null;
}

export interface DayInput {
  note: string;
  activities: string[];
  /** Version this edit is based on. If given and stale, the write is rejected (409). */
  base?: string | null;
}

export interface Summary {
  /** Every day with an entry, mapped to its intensity level. */
  days: Record<string, Level>;
  /** Activities per day, for days that have any. */
  activities: Record<string, string[]>;
}

export interface SearchHit {
  date: string;
  snippet: string;
  activities: string[];
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
}

/** The prototype's localStorage/JSON export shape. Also what /api/export returns. */
export interface PrototypeExport {
  settings: Settings;
  entries: Record<string, { note: string; acts: string[]; updated?: number }>;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  settingsApplied: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  birth: null,
  span: 75,
  activities: ['Workout', 'Read', 'Outside'],
  eras: [],
  milestones: [],
};
