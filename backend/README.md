# DexBotX backend

The backend package contains three Node.js processes:

- **API** — NestJS HTTP API for Discord OAuth, dashboard requests, and health checks.
- **Bot** — connects to the Discord Gateway and enqueues member join/leave events.
- **Worker** — consumes queued events, renders messages, and posts them to Discord.

The processes share PostgreSQL for application data and Redis for sessions, caching, pub/sub, rate limits, and jobs. PostgreSQL-compatible databases and Redis-compatible services can be hosted by any provider.

## Requirements

- Node.js 22 or newer and npm.
- A PostgreSQL database and a Redis instance reachable by the backend processes.
- A Discord application with a bot. Enable **Server Members Intent** in the Discord Developer Portal.

## Local setup

```powershell
Copy-Item .env.example .env
npm install
```

Set the required values in `.env`, then generate `SESSION_ENCRYPTION_KEY`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Build and apply migrations:

```powershell
npm run build
npm run db:migrate
```

Run each process in a separate terminal:

```powershell
npm run start:dev
npm run start:bot:dev
npm run start:worker:dev
```

The API listens on port `4000` by default. Configure the frontend's `BACKEND_URL` to this API for local development.

## Configuration

The complete variable list and local defaults are in [`.env.example`](./.env.example). Required settings:

| Variable | Purpose |
|---|---|
| `WEB_URL` | Public dashboard origin; used to validate requests and construct the Discord OAuth callback. |
| `DATABASE_URL` | PostgreSQL connection URL. |
| `REDIS_URL` | Redis connection URL. |
| `DISCORD_CLIENT_ID` | Discord application ID. |
| `DISCORD_CLIENT_SECRET` | Discord OAuth client secret. |
| `DISCORD_BOT_TOKEN` | Discord bot token. |
| `SESSION_ENCRYPTION_KEY` | 32-byte key encoded as 64 hexadecimal characters. |

For production, use HTTPS for the dashboard and `wss://` for `WS_PUBLIC_URL`. Register `<WEB_URL>/api/auth/callback` in the Discord application's OAuth2 redirect URLs. Keep secrets on backend processes; never add them to frontend or `NEXT_PUBLIC_*` variables.

Useful optional settings include `ADMIN_USER_IDS` (admin access; empty disables it), `SENTRY_DSN`, `METRICS_TOKEN`, and `WORKER_CONCURRENCY`. `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` enable optional custom-background uploads through Supabase Storage; they are not required for other features.

## Deployment

Deploy to any provider that supports long-running Node.js processes or containers. Run the API, bot, and worker as separate services so each can restart and scale independently. Configure them with the same `DATABASE_URL`, `REDIS_URL`, Discord credentials, and session key.

Apply migrations once per release before starting updated processes:

```powershell
npm run build
npm run db:migrate
```

Then use these production start commands:

| Service | Command |
|---|---|
| API | `npm run start` |
| Discord bot | `npm run start:bot` |
| Queue worker | `npm run start:worker` |

Configure the API health check to use `GET /health/ready` (checks PostgreSQL and Redis); `GET /health` is a liveness check. The API listens on `PORT`, defaulting to `4000`.

## Development commands

| Command | Purpose |
|---|---|
| `npm run lint` | Lint backend source |
| `npm run typecheck` | TypeScript checks |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests |
| `npm run build` | Build production files |
| `npm run db:generate` | Generate a migration after changing the Drizzle schema |
| `npm run db:migrate` | Apply migrations |

Review generated migration SQL before deploying it. All API, bot, and worker processes must use the same database schema.
