import type {
  DayEntry,
  DayInput,
  ImportResult,
  PrototypeExport,
  SearchResult,
  Settings,
  Summary,
} from '../shared/types.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** The day changed elsewhere since the editor loaded it. */
export class ConflictError extends Error {
  readonly current: DayEntry;
  constructor(current: DayEntry) {
    super('This day was changed elsewhere');
    this.current = current;
  }
}

async function req<T>(
  method: string,
  url: string,
  body?: unknown,
  keepalive = false
): Promise<T> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const res = await fetch(url, {
    method,
    headers: payload ? { 'content-type': 'application/json' } : undefined,
    body: payload,
    cache: 'no-store',
    // keepalive lets a save finish if the tab is closing; browsers cap it at 64 KB.
    keepalive: keepalive && (payload?.length ?? 0) < 60_000,
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new ApiError(res.status, json?.error ?? res.statusText, json);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// Saves run one at a time, in order, so a quick edit-then-clear can't land
// out of order on the server.
let saveChain: Promise<unknown> = Promise.resolve();

/**
 * Saves (or deletes, if empty) a day. `base` is read when the save actually
 * runs, so queued saves each build on the version the previous one produced.
 * Resolves to the new version (null once deleted).
 */
function saveDay(
  date: string,
  input: Omit<DayInput, 'base'>,
  base: () => string | null
): Promise<string | null> {
  const empty = !input.note.trim() && input.activities.length === 0;
  const run = async () => {
    try {
      if (empty) {
        const q = new URLSearchParams({ base: base() ?? '' });
        await req<void>('DELETE', `/api/days/${date}?${q}`, undefined, true);
        return null;
      }
      const e = await req<DayEntry>(
        'PUT',
        `/api/days/${date}`,
        { ...input, base: base() },
        true
      );
      return e.version;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        throw new ConflictError((err.body as { current: DayEntry }).current);
      }
      throw err;
    }
  };
  const next = saveChain.then(run, run);
  saveChain = next.catch(() => {});
  return next;
}

export const api = {
  summary: () => req<Summary>('GET', '/api/summary'),
  getDay: (date: string) => req<DayEntry>('GET', `/api/days/${date}`),
  saveDay,
  search: (q: string) =>
    req<SearchResult>('GET', `/api/search?${new URLSearchParams({ q })}`),
  getSettings: () => req<Settings>('GET', '/api/settings'),
  putSettings: (s: Settings) => req<Settings>('PUT', '/api/settings', s),
  exportAll: () => req<PrototypeExport>('GET', '/api/export'),
  importAll: (data: unknown) => req<ImportResult>('POST', '/api/import', data),
};
