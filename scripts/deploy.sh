#!/usr/bin/env bash
# Ship the newest packaged image to a server over SSH and (re)start it.
#   scripts/deploy.sh user@host [/opt/docker/lifetime-journal]
# Run scripts/package-image.sh first. Leaves an existing .env and data/ alone.
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${1:?usage: scripts/deploy.sh user@host [remote-dir]}"
DIR="${2:-/opt/docker/lifetime-journal}"
TARBALL="$(ls -t release/lifetime-journal-*.tar.gz 2>/dev/null | head -1)"
[ -n "$TARBALL" ] || { echo "No release tarball; run scripts/package-image.sh" >&2; exit 1; }

echo "Deploying $(basename "$TARBALL") to $HOST:$DIR"
NAME="$(basename "$TARBALL")"
ssh "$HOST" "mkdir -p '$DIR/data'"
scp "$TARBALL" release/docker-compose.yml release/.env.example "$HOST:$DIR/"
ssh "$HOST" bash -s -- "$DIR" "$NAME" <<'REMOTE'
set -euo pipefail
cd "$1"
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s/^APP_UID=.*/APP_UID=$(id -u)/; s/^APP_GID=.*/APP_GID=$(id -g)/" .env
  echo "Created .env (APP_UID=$(id -u), APP_GID=$(id -g)); review BIND_ADDR/HOST_PORT."
fi
gunzip -c "$2" | docker load
docker compose up -d
rm "$2"
REMOTE

echo "Waiting for the health check..."
for _ in $(seq 1 30); do
  status="$(ssh "$HOST" "docker inspect -f '{{.State.Health.Status}}' lifetime-journal" 2>/dev/null || true)"
  [ "$status" = healthy ] && { echo "Healthy."; exit 0; }
  sleep 2
done
echo "Not healthy yet (status: ${status:-unknown}). Check: ssh $HOST docker logs lifetime-journal" >&2
exit 1
