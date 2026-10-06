import { access, constants, readFile } from 'node:fs/promises';
import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { isValidDate } from '../shared/date.ts';
import { auth } from './auth.ts';
import { exportAll, exportSchema, importExport } from './importer.ts';
import { ConflictError, type Journal } from './journal.ts';
import { type SettingsStore, settingsSchema } from './settings.ts';

const dayInputSchema = z.object({
  note: z.string().max(200_000),
  activities: z.array(z.string().trim().min(1).max(40)).max(50),
  base: z.string().max(100).nullable().optional(),
});

export interface AppDeps {
  journal: Journal;
  settings: SettingsStore;
  /** Built client (dist/client). Omit in dev, where Vite serves it. */
  staticRoot?: string;
}

async function jsonBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HTTPException(400, { message: 'Body must be JSON' });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: z.prettifyError(parsed.error) });
  }
  return parsed.data;
}

export function createApp({ journal, settings, staticRoot }: AppDeps) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof ConflictError) {
      return c.json({ error: err.message, current: err.current }, 409);
    }
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    console.error(err);
    return c.json({ error: 'Internal error' }, 500);
  });

  // Unauthenticated liveness check for the Docker healthcheck. Also confirms
  // the data volume is writable, the most likely thing to break on a server.
  app.get('/api/health', async c => {
    try {
      await access(path.dirname(journal.root), constants.W_OK);
      return c.json({ ok: true, version: process.env.APP_VERSION ?? 'dev' });
    } catch {
      return c.json({ ok: false, error: 'Data directory not writable' }, 503);
    }
  });

  // API responses are live data; never let a browser or proxy cache them.
  app.use('/api/*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
  });

  const api = new Hono();
  api.use('*', auth());
  api.use('*', bodyLimit({ maxSize: 1024 * 1024 }));

  api.get('/summary', async c => c.json(await journal.summary()));

  api.get('/search', async c => {
    const q = (c.req.query('q') ?? '').slice(0, 200);
    return c.json(await journal.search(q));
  });

  api.use('/days/:date', async (c, next) => {
    if (!isValidDate(c.req.param('date'))) {
      return c.json({ error: 'Date must be a real YYYY-MM-DD date' }, 400);
    }
    await next();
  });
  api.get('/days/:date', async c =>
    c.json(await journal.read(c.req.param('date')))
  );
  api.put('/days/:date', async c => {
    const input = await jsonBody(c.req.raw, dayInputSchema);
    return c.json(await journal.write(c.req.param('date'), input));
  });
  // ?base=<version> guards against deleting a newer edit; an empty value
  // means "I expect no file".
  api.delete('/days/:date', async c => {
    const base = c.req.query('base');
    await journal.remove(
      c.req.param('date'),
      base === undefined ? undefined : base || null
    );
    return c.body(null, 204);
  });

  api.get('/settings', async c => c.json(await settings.get()));
  api.put('/settings', async c => {
    const next = await jsonBody(c.req.raw, settingsSchema);
    return c.json(await settings.put(next));
  });

  api.get('/export', async c => c.json(await exportAll(journal, settings)));
  api.post('/import', bodyLimit({ maxSize: 50 * 1024 * 1024 }), async c => {
    const data = await jsonBody(c.req.raw, exportSchema);
    return c.json(await importExport(data, journal, settings));
  });

  api.all('*', c => c.json({ error: 'Not found' }, 404));
  app.route('/api', api);

  if (staticRoot) {
    const root = path.relative(process.cwd(), staticRoot) || '.';
    app.use(
      '/assets/*',
      serveStatic({
        root,
        onFound: (_p, c) => {
          c.header('Cache-Control', 'public, max-age=31536000, immutable');
        },
      })
    );
    app.use(
      '*',
      serveStatic({
        root,
        onFound: (_p, c) => {
          c.header('Cache-Control', 'no-cache');
        },
      })
    );
    // No client routing, but serve the app for any unknown GET so deep links work.
    const indexFile = path.join(staticRoot, 'index.html');
    app.get('*', async c => {
      c.header('Cache-Control', 'no-cache');
      return c.html(await readFile(indexFile, 'utf8'));
    });
  }

  return app;
}
