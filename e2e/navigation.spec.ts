import { expect, test } from '@playwright/test';
import { level, longDate, open, putDay, reset } from './helpers.ts';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

test.beforeEach(async ({ request }) => {
  await reset(request);
});

test('zooms life → year → month and back out with Esc', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /^2024, age/ }).click();
  await expect(level(page, 'Year')).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.locator('section[data-y="2024"]:not([data-m]) h2')
  ).toContainText('2024');

  await page.getByRole('button', { name: 'March 2024' }).click();
  await expect(level(page, 'Month')).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.locator('section[data-y="2024"][data-m="2"] h2')
  ).toBeInViewport();

  await page.keyboard.press('Escape');
  await expect(level(page, 'Year')).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.locator('section[data-y="2024"]:not([data-m])')
  ).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(level(page, 'Life')).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('2');
  await expect(level(page, 'Weeks')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('section[data-decade]').first()).toBeVisible();
});

test('the back-to-today button appears when scrolled away', async ({
  page,
}) => {
  await open(page);
  await page.keyboard.press('3');
  const back = page.getByRole('button', { name: /This year/ });
  await expect(back).toBeHidden();
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -1500);
  await expect(back).toBeVisible();
  await back.click();
  await expect(back).toBeHidden();
  const year = new Date().getFullYear();
  await expect(
    page.locator(`section[data-y="${year}"]:not([data-m])`)
  ).toBeInViewport();
});

test('search finds notes and opens the day', async ({ page, request }) => {
  await putDay(request, '2024-01-10', 'Walked the river trail with Sam');
  await putDay(request, '2024-02-03', 'Read by the river until dark');
  await putDay(request, '2024-03-01', 'Quiet day indoors');
  await open(page);

  await page.keyboard.press('/');
  const search = page.getByRole('dialog', { name: 'Search' });
  await search.getByRole('searchbox').fill('river');
  await expect(search.getByText('2 days')).toBeVisible();
  await expect(search.locator('mark').first()).toHaveText(/river/i);
  await search.getByRole('button', { name: /February 3, 2024/ }).click();

  const day = page.getByRole('dialog', { name: longDate('2024-02-03') });
  await expect(day).toBeVisible();
  await expect(day.getByLabel('Note')).toHaveValue(
    'Read by the river until dark'
  );
  await expect(level(page, 'Month')).toHaveAttribute('aria-pressed', 'true');
});

test('month labels match the calendar', async ({ page }) => {
  await open(page);
  await page.keyboard.press('3');
  const year = new Date().getFullYear();
  for (const m of [0, 6, 11]) {
    await expect(
      page.getByRole('button', { name: `${MONTHS[m]} ${year}` })
    ).toBeVisible();
  }
});
