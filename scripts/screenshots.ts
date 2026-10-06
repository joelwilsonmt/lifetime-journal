// Captures the README screenshots from the demo dataset, never real data.
//   pnpm dev:demo          (in another terminal)
//   pnpm screenshots       → docs/screenshots/*.png
// BASE_URL overrides the target (default: the demo on :3077). Theme changes
// are applied to the page only; the demo's saved settings aren't touched.
import { mkdir } from 'node:fs/promises';
import { type Browser, chromium, devices, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:3077';
const OUT = 'docs/screenshots';

const health = await fetch(`${BASE}/api/health`).catch(() => null);
if (!health?.ok) {
  console.error(`Nothing at ${BASE}. Start the demo first: pnpm dev:demo`);
  process.exit(1);
}
const { days } = (await (await fetch(`${BASE}/api/summary`)).json()) as {
  days: Record<string, number>;
};
// A recent, well-written day to show in the editor.
const sample = Object.entries(days)
  .filter(([, lv]) => lv >= 3)
  .map(([d]) => d)
  .sort()
  .at(-3);
const sampleYear = Number(sample?.slice(0, 4) ?? new Date().getFullYear());

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

async function page(b: Browser, mobile = false): Promise<Page> {
  const ctx = await b.newContext({
    ...(mobile
      ? devices['Pixel 7']
      : { viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 }),
    locale: 'en-US',
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    localStorage.setItem(
      'lifecal:introShown',
      new Date().toLocaleDateString('sv-SE')
    );
    localStorage.removeItem('lifecal:lens');
  });
  await p.goto(BASE);
  await p.getByRole('group', { name: 'Zoom level' }).waitFor();
  await p.locator('main button, main section').first().waitFor();
  return p;
}

/** Override the theme in this page only. */
async function theme(p: Page, palette: string, mode: 'light' | 'dark') {
  await p.evaluate(
    ([pal, m]) => {
      const r = document.documentElement;
      r.dataset.palette = pal;
      r.dataset.theme = m;
    },
    [palette, mode]
  );
}

async function shot(p: Page, name: string) {
  await p.mouse.move(0, 0); // no stray hover highlight
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${OUT}/${name}.png`);
}

/** Put an element just under the sticky header (the list may need to grow first). */
async function scrollToTop(p: Page, selector: string) {
  await p.locator(selector).waitFor({ state: 'attached' });
  for (let i = 0; i < 3; i++) {
    await p.evaluate(sel => {
      const el = document.querySelector(sel);
      const hdr =
        document.querySelector('header')?.getBoundingClientRect().height ?? 0;
      if (el) window.scrollBy(0, el.getBoundingClientRect().top - hdr - 8);
    }, selector);
    await p.waitForTimeout(250);
  }
}

const press = async (p: Page, key: string) => {
  await p.keyboard.press(key);
  await p.waitForTimeout(400);
};

console.log(`Capturing from ${BASE}`);

// Life: the whole span, eras across the top of each year.
let p = await page(browser);
await p.evaluate(() => window.scrollTo(0, 0));
await shot(p, 'life');

// Year: twelve months of a well-kept year.
await p
  .getByRole('button', { name: new RegExp(`^${sampleYear}, age`) })
  .click();
await p.waitForTimeout(500);
await shot(p, 'year');

// Month with the day editor open.
if (sample) {
  const [y, m] = sample.split('-').map(Number);
  const month = new Date(y as number, (m as number) - 1, 1).toLocaleString(
    'en-US',
    { month: 'long' }
  );
  await p.getByRole('button', { name: `${month} ${y}` }).click();
  await p.waitForTimeout(500);
  await p.locator(`main [data-k="${sample}"]`).click();
  await p
    .getByRole('dialog')
    .getByRole('status')
    .or(p.getByRole('dialog'))
    .first()
    .waitFor();
  await p.waitForTimeout(400);
  await shot(p, 'editor');
  await p.keyboard.press('Escape');
}

// Weeks of life, framed on the decade with the most written.
await press(p, '2');
await scrollToTop(p, 'section[data-decade="3"]');
await shot(p, 'weeks');

// A different theme: Ember, dark.
await press(p, '1');
await theme(p, 'ember', 'dark');
await p.evaluate(() => window.scrollTo(0, 0));
await shot(p, 'theme-ember-dark');
await p.context().close();

// Phone: a lived month, and weeks on the same decade.
p = await page(browser, true);
await p.getByRole('button', { name: 'Month' }).click();
await p.waitForTimeout(500);
if (sample) {
  const [y, m] = sample.split('-').map(Number);
  await scrollToTop(p, `section[data-y="${y}"][data-m="${(m as number) - 1}"]`);
}
await shot(p, 'phone-month');
await p.getByRole('button', { name: 'Weeks' }).click();
await p.waitForTimeout(500);
await scrollToTop(p, 'section[data-decade="3"]');
await shot(p, 'phone-weeks');

await browser.close();
