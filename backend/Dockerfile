# One image, four roles. Choose the command:
#   api     : node dist/main.js              (default; the HEALTHCHECK below targets this role)
#   bot     : node dist/bot/manager.js       (gateway shards; only enqueues jobs)
#   worker  : node dist/worker/worker.js     (renders cards and posts; scale horizontally)
#   migrate : node dist/db/migrate.js        (one-shot, run once per deploy)
# Non-API roles have no HTTP server, so docker-compose disables the healthcheck for them.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini fontconfig fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node package.json ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
