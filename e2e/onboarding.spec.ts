import { expect, test } from '@playwright/test';
import { BIRTH, header, open, reset } from './helpers.ts';

test('a new install asks for a birth date, then lays out the years', async ({
  page,
  request,
}) => {
  await reset(request, { birth: null });
  await open(page);
  await expect(
    page.getByText('Add your birth date to lay out your years.')
  ).toBeVisible();

  await page.getByRole('button', { name: 'Add birth date' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByLabel('Birth date').fill(BIRTH);
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(dialog).toBeHidden();
  await expect(header(page)).toContainText('days lived');
  const year = new Date().getFullYear();
  await expect(
    page.getByRole('button', { name: new RegExp(`^${year}, age \\d+`) })
  ).toBeVisible();
  // 76 tiles: ages 0 through 75.
  await expect(page.locator('main button[data-y]')).toHaveCount(76);
});
