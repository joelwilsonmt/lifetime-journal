# Lifetime calendar

[![CI](https://github.com/joelwilsonmt/lifetime-calendar/actions/workflows/ci.yml/badge.svg)](https://github.com/joelwilsonmt/lifetime-calendar/actions/workflows/ci.yml)
[![Docker image](https://github.com/joelwilsonmt/lifetime-calendar/actions/workflows/docker.yml/badge.svg)](https://github.com/joelwilsonmt/lifetime-calendar/actions/workflows/docker.yml)

A self-hosted daily journal laid out as a zoomable lifetime calendar. Each day
is a markdown file, so `data/journal` doubles as an Obsidian vault.

## Using it

- **Views:** Life (years), Weeks (each year of age as 52 weeks from that
  birthday, shown 52, 26 or 13 per row), Year, and Month. Keys: `1`–`4` switch views, `N` writes today, `T`
  jumps to today, `/` searches, and `Esc` zooms out.
- On phones, Today, Search, the lens, eras and Settings are in the menu (☰).
  Dialogs close with ×, by tapping outside, or with Esc.
- **Write** opens today's entry. It autosaves, and the status next to Done
  shows whether it has saved.
- **Showing** (in the header) is a lens. Pick an activity and every view shades
  only the days that have it, with counts per year and month.
- **Eras and milestones** (on the Life view, or in Settings) label stretches of
  life and single days on the calendar.
- **Appearance** (Settings): five themes (Pine, Ember, Tide, Dusk, Ledger),
  system/light/dark mode, and four typefaces. Saved with your settings, so
  every device matches.
- **Conflicts:** if a day was changed on another device or in Obsidian while
  you had it open, the editor asks which version to keep instead of
  overwriting it.

## Develop

```sh
pnpm install
pnpm dev          # http://localhost:3075 (API on :3076, data in ./data)
pnpm dev:demo     # http://localhost:3077 with sample data in ./demo-data
pnpm demo:reset   # wipe and re-seed the sample data
pnpm test         # unit tests (server, storage, week math)
pnpm test:e2e     # build, then Playwright against the production server
                  # (desktop + phone viewports, fresh .e2e-data/ each run)
pnpm typecheck
pnpm check        # Biome lint + format check (pnpm format to fix)
```

The server runs straight from TypeScript in dev (Node >= 22.18 strips types).
`pnpm build` bundles the client to `dist/client` and compiles the server to
`dist/server`; `pnpm start` serves both on :3000.

## Deploy

Images for amd64 and arm64 are published to
`ghcr.io/joelwilsonmt/lifetime-calendar` by GitHub Actions. On a server:

```sh
mkdir -p /opt/docker/lifetime-calendar && cd /opt/docker/lifetime-calendar
curl -fsSLO https://raw.githubusercontent.com/joelwilsonmt/lifetime-calendar/main/docker-compose.yml
curl -fsSL  https://raw.githubusercontent.com/joelwilsonmt/lifetime-calendar/main/.env.example -o .env
# set APP_UID/APP_GID in .env to the owner of ./data (id -u / id -g)
mkdir -p data && docker compose up -d
sudo tailscale serve --bg --https=443 http://127.0.0.1:3075
```

[DEPLOY.md](DEPLOY.md) covers building from source, shipping a tarball with
`scripts/package-image.sh` + `scripts/deploy.sh`, releases, and backups.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit and Playwright
tests on every push and PR. The Docker workflow builds both architectures,
smoke-tests the amd64 image, and publishes on `main` and `v*` tags.

### Install on a phone

The app is installable (manifest, icons, no service worker). Browsers only
offer install over HTTPS, so serve it with `tailscale serve --bg --https=443 http://127.0.0.1:3075` and open
`https://<server>.<tailnet>.ts.net` on the phone, then use "Add to Home
Screen". The installed app opens straight to today's entry (`/?write`). In the
editor, swipe left or right to move between days.

## Import from the prototype

Export JSON from the prototype's Settings, then either use **Settings → Import
JSON** in the app, or:

```sh
cp lifetime-calendar-*.json data/
docker compose exec lifetime-calendar node dist/server/cli/import.js /data/lifetime-calendar-YYYY-MM-DD.json
# locally: pnpm import path/to/export.json
```

Imported days overwrite existing ones with the same date. Settings are only
applied if no birth date is set yet.

## Data layout

```
data/
  settings.json
  journal/2026/09/2026-09-30.md
```

```markdown
---
activities: [Workout, Read]
updated: 2026-09-30T18:06:30.300Z
---

The note body.
```

Clearing a day moves its file to `data/.trash/YYYY-MM-DD.deleted-<ms>.md`.
Move it back to `journal/YYYY/MM/YYYY-MM-DD.md` to restore it. The trash is
pruned on startup and on each delete: entries older than `TRASH_DAYS`
(default 30) go, and at most 500 are kept. Extra frontmatter keys added in Obsidian are
kept on rewrite, and edits made outside the app show up on the next load.

## API

| Method | Path | |
| --- | --- | --- |
| GET | `/api/summary` | `{ days: { date: level }, activities: { date: [..] } }` for every day with an entry |
| GET/PUT/DELETE | `/api/days/:date` | One day, with a `version`. PUT `{ note, activities, base? }`; an empty note and no activities deletes it. If `base` (or `?base=` on DELETE) doesn't match the file's current version, the response is 409 with `current` |
| GET | `/api/search?q=` | Days whose note or activities contain every term, newest first |
| GET/PUT | `/api/settings` | `{ birth, span, activities, eras, milestones }` |
| GET | `/api/export` | Everything, in the prototype's JSON format |
| POST | `/api/import` | Load a prototype JSON export |
| GET | `/api/health` | Liveness + data-dir writability (no auth) |

There's no auth in v1. The seam is `src/server/auth.ts`, which every `/api` route
except health goes through.

## License

MIT. See [LICENSE](LICENSE).
