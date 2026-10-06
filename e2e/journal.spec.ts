import { expect, test } from '@playwright/test';
import {
  daysFromToday,
  getDay,
  longDate,
  open,
  putDay,
  reset,
  today,
  trashFiles,
} from './helpers.ts';

test.beforeEach(async ({ request }) => {
  await reset(request);
});

test('Write opens today, autosaves, and the entry is on the server', async ({
  page,
  request,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Write' }).click();
  const dialog = page.getByRole('dialog', { name: longDate(today()) });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Note').fill('Walked the river trail.');
  await expect(dialog.getByRole('status')).toHaveText('Saved');
  await dialog.getByRole('button', { name: 'Read' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Saved');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toBeHidden();

  const day = await getDay(request, today());
  expect(day).toMatchObject({
    note: 'Walked the river trail.',
    activities: ['Read'],
  });
  const { days } = await (await request.get('/api/summary')).json();
  expect(days[today()]).toBeGreaterThan(0);
});

test('N opens today, and prev/next move between days', async ({ page }) => {
  await open(page);
  await page.keyboard.press('n');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading')).toHaveText(longDate(today()));
  await dialog.getByRole('button', { name: 'Next day' }).click();
  await expect(dialog.getByRole('heading')).toHaveText(
    longDate(daysFromToday(1))
  );
  await dialog.getByRole('button', { name: 'Previous day' }).click();
  await dialog.getByRole('button', { name: 'Previous day' }).click();
  await expect(dialog.getByRole('heading')).toHaveText(
    longDate(daysFromToday(-1))
  );
});

test('clearing a day empties it and keeps a copy in the trash', async ({
  page,
  request,
}) => {
  await putDay(request, today(), 'Something to regret clearing', ['Outside']);
  const before = (await trashFiles())?.length ?? 0;
  await open(page);
  await page.keyboard.press('n');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Note')).toHaveValue(
    'Something to regret clearing'
  );
  await dialog.getByRole('button', { name: 'Clear this day' }).click();
  await expect(page.getByText('Day cleared')).toBeVisible();
  await expect(dialog.getByRole('status')).toHaveText('Saved');

  expect(await getDay(request, today())).toMatchObject({
    note: '',
    activities: [],
    version: null,
  });
  const after = await trashFiles();
  if (after) {
    expect(after.length).toBe(before + 1);
    expect(after.some(f => f.startsWith(`${today()}.deleted-`))).toBe(true);
  }
});

test('closing works with the button, the backdrop, and Escape', async ({
  page,
}) => {
  await open(page);
  const dialog = page.getByRole('dialog');

  await page.getByRole('button', { name: 'Write' }).click();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Write' }).click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Write' }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('an edit made elsewhere is caught instead of overwritten', async ({
  page,
  request,
}) => {
  await putDay(request, today(), 'original');
  await open(page);
  await page.keyboard.press('n');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Note')).toHaveValue('original');

  // Another device saves first.
  await putDay(request, today(), 'from my phone');
  await dialog.getByLabel('Note').fill('from the laptop');

  const alert = dialog.getByRole('alert');
  await expect(alert).toContainText('changed on another device');
  await expect(alert).toContainText('from my phone');
  await alert.getByRole('button', { name: 'Keep mine' }).click();
  await expect(alert).toBeHidden();
  await expect(dialog.getByRole('status')).toHaveText('Saved');
  expect((await getDay(request, today())).note).toBe('from the laptop');
});
