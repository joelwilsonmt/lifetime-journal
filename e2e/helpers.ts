import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { APIRequestContext, Page } from '@playwright/test';

export const BIRTH = '1990-04-12';

const pad = (n: number) => String(n).padStart(2, '0');
export const key = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Local calendar dates, like the app uses. */
export const today = () => key(new Date());
export const daysFromToday = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return key(d);
};

/** "Tuesday, October 6, 2026": the editor's heading for a date. */
export const longDate = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y as number, (m as number) - 1, d).toLocaleDateString(
    'en-US',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  );
};

export const SETTINGS = {
  birth: BIRTH as string | null,
  span: 75,
  activities: ['Workout', 'Read', 'Outside'],
  eras: [] as { label: string; start: string; end: string | null }[],
  milestones: [] as { label: string; date: string }[],
  theme: 'pine',
  mode: 'light',
  font: 'spectral',
};

/** Fresh state: default settings (with a birth date) and no entries. */
export async function reset(
  request: APIRequestContext,
  settings: Partial<typeof SETTINGS> = {}
) {
  const { days } = await (await request.get('/api/summary')).json();
  for (const date of Object.keys(days)) {
    await request.delete(`/api/days/${date}`);
  }
  const res = await request.put('/api/settings', {
    data: { ...SETTINGS, ...settings },
  });
  if (!res.ok()) throw new Error(`reset failed: ${await res.text()}`);
}

export async function putDay(
  request: APIRequestContext,
  date: string,
  note: string,
  activities: string[] = []
) {
  const res = await request.put(`/api/days/${date}`, {
    data: { note, activities },
  });
  if (!res.ok()) throw new Error(`putDay failed: ${await res.text()}`);
}

export async function getDay(request: APIRequestContext, date: string) {
  return (await request.get(`/api/days/${date}`)).json();
}

/** Trash entries on disk, when the server runs locally on .e2e-data. */
export async function trashFiles(): Promise<string[] | null> {
  if (process.env.E2E_BASE_URL) return null;
  const dir = path.resolve(process.env.E2E_DATA_DIR ?? '.e2e-data', '.trash');
  return readdir(dir).catch(() => []);
}

/** Load the app with any first-open intro already marked as shown. */
export async function open(page: Page) {
  await page.addInitScript(d => {
    localStorage.setItem('lifecal:introShown', d);
  }, today());
  await page.goto('/');
  await page.getByRole('group', { name: 'Zoom level' }).waitFor();
}

export const header = (page: Page) => page.locator('header').first();
export const level = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Zoom level' }).getByRole('button', { name });
