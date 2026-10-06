#!/usr/bin/env bash
# Build the image for the server's architecture and save it as a tarball,
# alongside the compose file and env template, in ./release/.
#   scripts/package-image.sh                 # linux/amd64 (x86 servers)
#   PLATFORM=linux/arm64 scripts/package-image.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PLATFORM="${PLATFORM:-linux/amd64}"
# Same name compose uses, so a loaded tarball is picked up without pulling.
IMAGE="${IMAGE:-ghcr.io/joelwilsonmt/lifetime-calendar}"
VERSION="$(git describe --tags --always --dirty)"
ARCH="${PLATFORM#linux/}"
OUT="release/lifetime-calendar-${VERSION}-${ARCH}.tar.gz"

echo "Building ${IMAGE}:${VERSION} for ${PLATFORM}"
docker buildx build \
  --platform "$PLATFORM" \
  --build-arg "VERSION=${VERSION}" \
  -t "${IMAGE}:${VERSION}" \
  -t "${IMAGE}:latest" \
  --load .

mkdir -p release
docker save "${IMAGE}:${VERSION}" "${IMAGE}:latest" | gzip > "$OUT"
cp docker-compose.yml .env.example release/
echo "Wrote $OUT ($(du -h "$OUT" | cut -f1)) plus docker-compose.yml and .env.example"
