// Seeds a sample journal for trying the app without touching real data.
//   pnpm dev:demo           seeds ./demo-data if empty, then runs on :3077
//   pnpm demo:reset         wipes and re-seeds ./demo-data
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { shiftDate, todayKey } from '../../shared/date.ts';
import type { Settings } from '../../shared/types.ts';
import { Journal } from '../journal.ts';
import { SettingsStore } from '../settings.ts';

const dir = path.resolve(process.env.DATA_DIR ?? './demo-data');
if (dir === path.resolve('data')) {
  console.error('Refusing to seed demo entries into ./data (real journal).');
  process.exit(1);
}

const reset = process.argv.includes('--reset');
const existing = await readdir(dir).catch(() => []);
if (existing.length && !reset) {
  console.log(`Demo data already in ${dir} (pnpm demo:reset to start over).`);
  process.exit(0);
}
if (reset) await rm(dir, { recursive: true, force: true });

// Deterministic, so the demo looks the same every time it's seeded.
let seed = 1988;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(list: readonly T[]) =>
  list[Math.floor(rand() * list.length)] as T;

const SENTENCES = [
  'Walked the river trail before work; the cottonwoods are turning.',
  'Long call with a client about the launch. Felt good about where it landed.',
  'Read forty pages and fell asleep on the couch.',
  'Cold morning. Coffee on the porch anyway.',
  'Rebuilt the deploy pipeline. Smaller than it was, which is the point.',
  'Dinner with friends, too much bread, worth it.',
  'Ran six miles, the last two harder than they should have been.',
  'Quiet day. Did the dishes slowly and thought about nothing much.',
  'Hiked up to the M with the dog. Windy at the top.',
  'Fixed the leaky faucet on the third try.',
  'Wrote for an hour without checking my phone.',
  'Snow overnight. Everything sounded muffled.',
  'Couldn’t focus. Went outside, which helped.',
  'Called Mom. She’s planting garlic again.',
  'Finished the book. The ending was earned.',
  'Spent the afternoon on taxes. Done, at least.',
  'Bike ride out past the fairgrounds, sun low and orange.',
  'Started a new project; the first day is always the best day.',
  'Slept badly, worked fine, went to bed early.',
  'Farmers market: peaches, a loaf, and a conversation about bees.',
  'Swam laps at lunch. Cleared my head.',
  'Stayed late fixing a bug that turned out to be a typo.',
  'Grilled outside for the first time this year.',
  'Read in the bath until the water went cold.',
  'Thunderstorm in the evening; watched it from the garage.',
];
const ACTIVITIES = ['Workout', 'Read', 'Outside', 'Write'];

const settings: Settings = {
  birth: '1988-06-14',
  span: 75,
  activities: ACTIVITIES,
  eras: [
    { label: 'University', start: '2006-09-01', end: '2010-05-20' },
    { label: 'Portland', start: '2010-06-01', end: '2014-08-31' },
    { label: 'Missoula', start: '2014-09-01', end: '2019-06-30' },
    { label: 'Bozeman', start: '2019-07-01', end: null },
    { label: 'Freelance', start: '2020-03-01', end: null },
  ],
  milestones: [
    { label: 'Graduated', date: '2010-05-20' },
    { label: 'Married', date: '2017-08-12' },
    { label: 'Got the dog', date: '2021-04-03' },
    { label: 'First marathon', date: '2023-09-17' },
  ],
  theme: 'pine',
  mode: 'system',
  font: 'spectral',
};

const journal = new Journal(path.join(dir, 'journal'));
await new SettingsStore(dir).put(settings);

// Sparse in earlier years, a steady habit lately, nothing in the future.
const today = todayKey();
let written = 0;
for (let d = '2019-01-01'; d < today; d = shiftDate(d, 1)) {
  const year = Number(d.slice(0, 4));
  const chance = year < 2022 ? 0.12 : year < 2024 ? 0.35 : 0.72;
  if (rand() > chance) continue;
  const sentences = Array.from({ length: 1 + Math.floor(rand() * 4) }, () =>
    pick(SENTENCES)
  );
  const note = rand() < 0.15 ? '' : [...new Set(sentences)].join(' ');
  const activities = ACTIVITIES.filter(
    a => rand() < (a === 'Outside' ? 0.55 : a === 'Write' ? 0.2 : 0.35)
  );
  if (rand() < 0.03) activities.push('Climb');
  if (!note && !activities.length) continue;
  await journal.write(d, { note, activities }, `${d}T21:00:00.000Z`);
  written++;
}

console.log(`Seeded ${written} demo days, 5 eras and 4 milestones in ${dir}`);
