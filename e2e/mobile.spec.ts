import { expect, test } from '@playwright/test';
import { level, open, reset } from './helpers.ts';

test.beforeEach(async ({ request }) => {
  await reset(request);
});

test('the phone header keeps the views and moves the rest to a menu', async ({
  page,
}) => {
  await open(page);
  await expect(page.getByRole('button', { name: 'Write' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search' })).toBeHidden();

  await page.getByRole('button', { name: 'Menu' }).click();
  const menu = page.locator('[popover]:popover-open');
  for (const item of ['Today', 'Search', 'Eras and milestones', 'Settings']) {
    await expect(menu.getByRole('button', { name: item })).toBeVisible();
  }
  await menu.getByRole('button', { name: 'Settings' }).click();
  await expect(menu).toBeHidden();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});

test('weeks default to 26 per row and fit the screen', async ({ page }) => {
  await open(page);
  await level(page, 'Weeks').click();
  await expect(page.locator('section[data-decade]').first()).toHaveAttribute(
    'data-per-row',
    '26'
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
