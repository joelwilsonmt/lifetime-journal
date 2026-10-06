# Deploying

One container, one `./data` folder, reachable only over your tailnet.

## What you need on the server

- Docker with the Compose plugin (`docker compose version`)
- Tailscale, if you want to reach it from your other devices
- A folder for it, e.g. `/opt/docker/lifetime-calendar`

The image is built for one CPU architecture. Most servers are `linux/amd64`
(x86). Check with `uname -m`: `x86_64` means amd64, `aarch64` means arm64.

## Option A: build on the server

Simplest if the server can reach the git repo.

```sh
git clone <repo-url> /opt/docker/lifetime-calendar
cd /opt/docker/lifetime-calendar
cp .env.example .env
sed -i "s/^APP_UID=.*/APP_UID=$(id -u)/; s/^APP_GID=.*/APP_GID=$(id -g)/" .env
mkdir -p data
docker compose up -d --build
```

Update later with `git pull && docker compose up -d --build`.

## Option B: build elsewhere, ship a tarball

Useful when building on a laptop (including Apple Silicon, which cross-builds
for amd64) and the server shouldn't need the source.

```sh
# On the build machine
scripts/package-image.sh                    # linux/amd64 by default
PLATFORM=linux/arm64 scripts/package-image.sh   # for an ARM server
```

This writes `release/lifetime-calendar-<version>-<arch>.tar.gz` plus
`docker-compose.yml` and `.env.example`. Then either:

```sh
scripts/deploy.sh user@server /opt/docker/lifetime-calendar
```

which copies the files over SSH, creates `.env` with your UID/GID on first
run (an existing `.env` and `data/` are left alone), loads the image, starts
it, and waits for the health check. Or do it by hand:

```sh
scp release/lifetime-calendar-*.tar.gz release/docker-compose.yml release/.env.example user@server:/opt/docker/lifetime-calendar/
ssh user@server
cd /opt/docker/lifetime-calendar
cp -n .env.example .env     # then set APP_UID/APP_GID (id -u / id -g)
mkdir -p data
gunzip -c lifetime-calendar-*.tar.gz | docker load
docker compose up -d
```

## Settings (`.env`)

| Variable | Default | |
| --- | --- | --- |
| `APP_UID`, `APP_GID` | `1000` | Owner of `./data` on the host. The container runs as this user, so files stay readable by you, restic and Obsidian. |
| `BIND_ADDR` | `127.0.0.1` | Host address to publish on. See below. |
| `HOST_PORT` | `3075` | Host port. Not 3000, which Gitea and others commonly use. |
| `TRASH_DAYS` | `30` | How long cleared days stay in `data/.trash/`. |
| `VERSION` | `latest` | Image tag to run. |

## Reaching it (tailnet only)

Never publish it on `0.0.0.0` on a reachable host, and don't add it to a
Cloudflare Tunnel or a public reverse proxy. There's no login in v1.

- **Recommended:** keep `BIND_ADDR=127.0.0.1` and let Tailscale proxy it with
  HTTPS on the server's tailnet name. HTTPS is also what lets phones install
  it as an app.

  ```sh
  sudo tailscale serve --bg --https=443 http://127.0.0.1:3075
  # → https://<server>.<tailnet>.ts.net
  ```

  If 443 is already served for something else, use another port, e.g.
  `--https=8443`.

- **Direct:** set `BIND_ADDR` to the server's Tailscale IP (`tailscale ip -4`)
  and open `http://<that-ip>:3075`. Plain HTTP, so no phone install.

## Checking on it

```sh
docker compose ps                  # STATUS should say (healthy)
curl -s http://127.0.0.1:3075/api/health   # {"ok":true,"version":"..."}
docker compose logs -f
```

The health check also fails if `./data` isn't writable, which almost always
means `APP_UID`/`APP_GID` don't match the folder's owner
(`ls -ln data`, then fix `.env` or `chown -R`).

## Data and backups

Everything lives in `./data`:

```
data/settings.json
data/journal/YYYY/MM/YYYY-MM-DD.md
data/.trash/          cleared days, pruned after TRASH_DAYS
```

Back up that folder (make sure your restic paths include it). To restore,
put the folder back and restart. To undo a cleared day, move its file from
`data/.trash/` back to `data/journal/YYYY/MM/YYYY-MM-DD.md`.

## Importing from the prototype

Use Settings → Import JSON in the app, or:

```sh
cp lifetime-calendar-*.json data/
docker compose exec lifetime-calendar node dist/server/cli/import.js /data/lifetime-calendar-YYYY-MM-DD.json
```

## Hardening already in place

Non-root user, read-only root filesystem (only `/data` and a `/tmp` tmpfs are
writable), `no-new-privileges`, an init process for clean shutdowns, rotated
logs, and no ports open beyond the one you bind.
