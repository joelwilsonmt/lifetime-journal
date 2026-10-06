# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./

# Full install + build of client (Vite) and server (tsc).
FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Runtime dependencies only (client libs are devDependencies, bundled at build).
FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod

FROM node:22-alpine AS runtime
ARG VERSION=dev
LABEL org.opencontainers.image.title="lifetime-calendar" \
      org.opencontainers.image.description="A daily journal laid out as a lifetime calendar" \
      org.opencontainers.image.version="${VERSION}"
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    HOME=/tmp \
    APP_VERSION=${VERSION}
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Non-root by default. Compose overrides the UID/GID at runtime (`user:`) to
# match whoever owns ./data on the host, so one image works on any server.
RUN mkdir -p /data && chown 1000:1000 /data
USER 1000:1000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/server/index.js"]
