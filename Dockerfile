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
# Match these to the owner of ./data on the host so files stay readable
# by restic, Obsidian, etc.
ARG APP_UID=1000
ARG APP_GID=1000
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    HOME=/tmp
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN mkdir -p /data && chown ${APP_UID}:${APP_GID} /data
USER ${APP_UID}:${APP_GID}
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/server/index.js"]
