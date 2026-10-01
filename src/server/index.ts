import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { config } from './config.ts';
import { Journal } from './journal.ts';
import { SettingsStore } from './settings.ts';

await mkdir(config.journalDir, { recursive: true });

const journal = new Journal(config.journalDir);
const settings = new SettingsStore(config.dataDir);

// In production this file runs from dist/server, next to dist/client.
const here = path.dirname(fileURLToPath(import.meta.url));
const staticRoot =
  process.env.NODE_ENV === 'production'
    ? path.resolve(here, '../client')
    : undefined;

const app = createApp({ journal, settings, staticRoot });

// Warm the summary cache so the first page load is fast.
const days = Object.keys((await journal.summary()).days).length;

const server = serve(
  { fetch: app.fetch, port: config.port, hostname: config.host },
  info => {
    console.log(
      `Lifetime calendar on http://${info.address}:${info.port} (data: ${config.dataDir}, ${days} days)`
    );
  }
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
