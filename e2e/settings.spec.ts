import { expect, test } from '@playwright/test';
import { header, open, putDay, reset } from './helpers.ts';

test.beforeEach(async ({ request }) => {
  await reset(request);
});

test('a theme applies at once, is saved, and survives a reload', async ({
  page,
  request,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByText('Ember', { exact: true }).click();
  await dialog.getByText('Dark', { exact: true }).click();
  await dialog.getByText('Besley', { exact: true }).click();

  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-palette', 'ember');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).toHaveAttribute('data-font', 'besley');
  await expect
    .poll(async () => (await (await request.get('/api/settings')).json()).theme)
    .toBe('ember');

  await page.reload();
  await expect(html).toHaveAttribute('data-palette', 'ember');
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(26, 21, 18)'
  );
});

test('eras and milestones show on the life view', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Add eras and milestones' }).click();
  const dialog = page.getByRole('dialog', { name: 'Eras and milestones' });
  await dialog.getByRole('button', { name: 'Add an era' }).click();
  await dialog.getByLabel('Era name').fill('Missoula');
  await dialog.getByLabel('Start date').fill('2014-09-01');
  await dialog.getByLabel('End date (blank for ongoing)').fill('2019-06-30');
  await dialog.getByRole('button', { name: 'Add a milestone' }).click();
  await dialog.getByLabel('Milestone name').fill('Married');
  await dialog.getByLabel('Date', { exact: true }).fill('2017-08-12');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Missoula 2014–2019')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^2017, age 27\. .*Married/ })
  ).toBeVisible();
});

test('the activity lens counts only matching days', async ({
  page,
  request,
}) => {
  await putDay(request, '2024-01-10', 'Run', ['Workout']);
  await putDay(request, '2024-01-11', 'Run again', ['Workout', 'Read']);
  await putDay(request, '2024-01-12', 'Book', ['Read']);
  await open(page);
  await expect(header(page)).toContainText('3 days written');
  await header(page)
    .getByRole('combobox', { name: /Showing/ })
    .selectOption('Workout');
  await expect(header(page)).toContainText('Workout on 2 days');
  await page.reload();
  await expect(header(page)).toContainText('Workout on 2 days');
  await header(page)
    .getByRole('combobox', { name: /Showing/ })
    .selectOption('');
  await expect(header(page)).toContainText('3 days written');
});
