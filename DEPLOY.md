# Deploying

One container, one `./data` folder, reachable only over your tailnet.

## What you need on the server

- Docker with the Compose plugin (`docker compose version`)
- Tailscale, if you want to reach it from your other devices
- A folder for it, e.g. `/opt/docker/lifetime-journal`

The image is built for one CPU architecture. Most servers are `linux/amd64`
(x86). Check with `uname -m`: `x86_64` means amd64, `aarch64` means arm64.

## Option A: pull the published image (recommended)

GitHub Actions builds the image for amd64 and arm64 and publishes it to
`ghcr.io/joelwilsonmt/lifetime-journal` on every push to `main` (`latest`,
`sha-<commit>`) and on version tags (`1.2.3`, `1.2`). The server only needs
the compose file and an `.env`:

```sh
mkdir -p /opt/docker/lifetime-journal && cd /opt/docker/lifetime-journal
curl -fsSLO https://raw.githubusercontent.com/joelwilsonmt/lifetime-journal/main/docker-compose.yml
curl -fsSL  https://raw.githubusercontent.com/joelwilsonmt/lifetime-journal/main/.env.example -o .env
sed -i "s/^APP_UID=.*/APP_UID=$(id -u)/; s/^APP_GID=.*/APP_GID=$(id -g)/" .env
mkdir -p data
docker compose pull && docker compose up -d
```

Upgrade with `docker compose pull && docker compose up -d`. To control when
upgrades happen, set `VERSION` in `.env` to a release (e.g. `1.0.0`) instead
of `latest`.

If the repository (and so the package) is private, log in once first with a
token that has `read:packages`:
`echo <token> | docker login ghcr.io -u joelwilsonmt --password-stdin`
(and fetch the two files with that token, or copy them over by hand).

## Option B: build on the server

For running unreleased changes, or without GHCR.

```sh
git clone <repo-url> /opt/docker/lifetime-journal
cd /opt/docker/lifetime-journal
cp .env.example .env
sed -i "s/^APP_UID=.*/APP_UID=$(id -u)/; s/^APP_GID=.*/APP_GID=$(id -g)/" .env
mkdir -p data
docker compose up -d --build
```

Update later with `git pull && docker compose up -d --build`.

## Option C: build elsewhere, ship a tarball

Useful when building on a laptop (including Apple Silicon, which cross-builds
for amd64) and the server shouldn't need the source.

```sh
# On the build machine
scripts/package-image.sh                    # linux/amd64 by default
PLATFORM=linux/arm64 scripts/package-image.sh   # for an ARM server
```

This writes `release/lifetime-journal-<version>-<arch>.tar.gz` plus
`docker-compose.yml` and `.env.example`. Then either:

```sh
scripts/deploy.sh user@server /opt/docker/lifetime-journal
```

which copies the files over SSH, creates `.env` with your UID/GID on first
run (an existing `.env` and `data/` are left alone), loads the image, starts
it, and waits for the health check. Or do it by hand:

```sh
scp release/lifetime-journal-*.tar.gz release/docker-compose.yml release/.env.example user@server:/opt/docker/lifetime-journal/
ssh user@server
cd /opt/docker/lifetime-journal
cp -n .env.example .env     # then set APP_UID/APP_GID (id -u / id -g)
mkdir -p data
gunzip -c lifetime-journal-*.tar.gz | docker load
docker compose up -d
```

## Settings (`.env`)

| Variable | Default | |
| --- | --- | --- |
| `APP_UID`, `APP_GID` | `1000` | Owner of `./data` on the host. The container runs as this user, so files stay readable by you, restic and Obsidian. |
| `BIND_ADDR` | `127.0.0.1` | Host address to publish on. See below. |
| `HOST_PORT` | `3075` | Host port. Not 3000, which Gitea and others commonly use. |
| `TRASH_DAYS` | `30` | How long cleared days stay in `data/.trash/`. |
| `IMAGE` | `ghcr.io/joelwilsonmt/lifetime-journal` | Image to run. |
| `VERSION` | `latest` | Image tag: `latest`, a release like `1.0.0`, or `sha-<commit>`. |

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

## Releases

Push a tag to publish a versioned image:

```sh
git tag v1.0.0 && git push origin v1.0.0
```

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
docker compose exec lifetime-journal node dist/server/cli/import.js /data/lifetime-calendar-YYYY-MM-DD.json
```

## Hardening already in place

Non-root user, read-only root filesystem (only `/data` and a `/tmp` tmpfs are
writable), `no-new-privileges`, an init process for clean shutdowns, rotated
logs, and no ports open beyond the one you bind.
