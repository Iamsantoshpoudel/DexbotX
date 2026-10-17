# DexbotX

DexBotX is a Discord bot and web dashboard for configuring welcome and goodbye messages. Messages can include custom text, embeds, and generated image cards. The dashboard uses Discord OAuth2, and the bot only requests the channel permissions needed to post those messages.

## Features

- Configure separate welcome and goodbye messages for each Discord server.
- Preview generated image cards while editing.
- Upload optional custom card backgrounds to private Supabase Storage.
- Send a test message to check the saved configuration and channel permissions.
- Manage settings through a same-origin Next.js dashboard backed by a NestJS API.
- Process join/leave events through a Redis-backed queue so image rendering and posting do not block the Discord gateway.

## How it works: browser to Discord channel

```text
Browser ──► Next.js dashboard ── /api/* ──► NestJS API ──► Supabase Postgres
   ▲                                         │   │                   │
   │                                         │   └──────► Redis ◄────┘
   │                                         │             │ session, cache,
   │                                         │             │ pub/sub, queue
   │                                         │             ▼
   └────────── dashboard response ◄──────────┘       Discord bot shards
                                                        ▲        │
Discord member joins/leaves ── Discord Gateway ─────────┘        ▼
                                                           BullMQ worker
                                                              │
                                                              ▼
                                                     Discord REST API
                                                              │
                                                              ▼
                                                     Configured server
                                                     text/announcement channel
```

The browser never connects directly to Postgres, Redis, or Discord's bot API. It talks to the Next.js dashboard on one origin; Next.js proxies `/api/*` to the NestJS backend. Discord OAuth is the exception: the browser is redirected to Discord to sign in and then returned to the registered callback.

### A. Sign in and open a server's settings

1. The user opens the dashboard in a browser and chooses **Open dashboard**. If there is no session cookie, the Next.js middleware sends the browser to `/api/auth/login`.
2. The backend creates a short-lived, single-use OAuth `state`, stores it in Redis, sets a state cookie, and redirects the browser to Discord with the `identify` and `guilds` scopes.
3. Discord authenticates the user and redirects the browser to `<WEB_URL>/api/auth/callback`. The backend checks the state and exchanges Discord's authorization code for user tokens.
4. The backend encrypts Discord tokens in a Redis-backed session, sets an HTTP-only session cookie, and redirects the browser back to the dashboard.
5. The frontend calls the API through Next.js's same-origin `/api/*` rewrite. For guilds and settings, the API validates the session, gets the user's Discord guilds, and confirms the user can manage the requested guild. It also checks Postgres to ensure the bot is installed there.
6. The frontend loads the saved message settings from the API and requests the guild's text and announcement channels. Channel data is fetched from Discord by the backend and cached briefly in Redis.

### B. Configure and save a welcome or goodbye message

1. The user edits the message in the browser: enablement, destination channel, text, embed, and optional image/card settings. The frontend requests image previews from the backend as the image settings change; preview images are rendered by the backend and returned to the browser.
2. For an optional custom background, the browser uploads the image to the backend. The backend authorizes the guild, validates and re-encodes the image, stores it in a private Supabase Storage bucket, and returns a guild-scoped path.
3. When the user saves, the frontend sends the complete configuration to the backend. The backend validates its shape, rechecks guild access, and verifies that the selected channel exists in that guild.
4. The backend upserts the configuration in Supabase Postgres, writes an audit-log entry, then invalidates the Redis configuration cache and publishes an invalidation event. Bot shards and workers therefore reload the latest saved settings instead of using stale cached values.
5. If the user clicks **Send test**, the backend loads the saved configuration, builds a sample message, and directly posts it through Discord REST to the selected channel. This is a manual test path; it does not go through the member-event queue.

### C. A member joins or leaves and the bot posts to the channel

1. The bot process connects to Discord Gateway with its bot token. On startup it syncs the guilds it is in to Postgres; guild create/update/delete events keep the installed-guild records current.
2. A member joins or leaves a guild. Discord Gateway delivers the event to the shard responsible for that guild. The shard ignores bot users and reads the current welcome/goodbye settings from its local cache, Redis, or Postgres.
3. If that message type is disabled, has no destination, or the selected channel is not a text/announcement channel in that guild, the shard stops without posting. It checks the bot's channel permissions and applies a per-guild event limit.
4. If all checks pass, the shard adds a compact job to the Redis-backed BullMQ queue. A job ID deduplicates repeated gateway deliveries within a 15-second window. The shard does not render the card or make the channel post.
5. A worker consumes the job and reloads the latest settings. If the message was disabled, moved to another channel, or the job is too old, it skips the job. Otherwise, it fetches the needed user avatar, server banner, and optional stored background.
6. The worker builds the configured text, embed, and optional image card, then posts the message to the saved channel using the bot token and Discord REST API. Welcome messages may mention the joining user; goodbye messages do not.
7. Transient errors are retried with exponential backoff. Discord rate limits pause the worker for the requested retry period. Missing channel access or permissions are treated as permanent failures and are not retried indefinitely.

The user's OAuth session and the bot token are separate credentials: OAuth is for dashboard identity and authorization; the bot token connects shards to the Gateway and lets the backend post to channels.

## Architecture and services

| Component | Purpose |
|---|---|
| `frontend/` | Next.js dashboard and static/public pages |
| `backend/` API | NestJS HTTP API, OAuth callback, validation, authorization, and health endpoints |
| `backend/` bot | Discord Gateway client and shard manager; enqueues member events |
| `backend/` worker | Consumes jobs, renders welcome/goodbye cards, and posts to Discord |
| Supabase Postgres | Guild metadata, message settings, and audit logs |
| Redis | Sessions, rate limits, caches, pub/sub, and BullMQ jobs |
| Supabase Storage (optional) | Private storage for custom card backgrounds |

## Requirements

- Node.js 20 or newer and npm.
- A Redis server reachable by the backend.
- A Supabase Postgres database (or another compatible PostgreSQL database).
- A Discord application and bot. The bot requires the **Server Members Intent** in the Discord Developer Portal to receive join/leave events.

## Local development setup

### 1. Configure the backend

```powershell
cd backend
Copy-Item .env.example .env
npm install
```

Fill in `backend/.env`. Required values include:

| Variable | Description |
|---|---|
| `WEB_URL` | Dashboard origin, normally `http://localhost:3000` for local development |
| `DATABASE_URL` | PostgreSQL connection URI |
| `DATABASE_SSL` | Set `true` when the database provider requires TLS |
| `REDIS_URL` | Redis connection URI, e.g. `redis://localhost:6379` |
| `DISCORD_CLIENT_ID` | Discord application client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth2 client secret |
| `DISCORD_BOT_TOKEN` | Discord bot token; keep it private |
| `SESSION_ENCRYPTION_KEY` | 32-byte key encoded as 64 hexadecimal characters |

Generate a session encryption key, for example:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

For Supabase, use the **session pooler** URI (port `5432`) when a direct IPv4 connection is unavailable. Do not use the transaction pooler (commonly port `6543`) for the long-running API and bot processes. If the database password contains URI-special characters, URL-encode it before placing it in `DATABASE_URL`.

Optional backend variables include `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `SUPABASE_BUCKET` for custom backgrounds, plus `SENTRY_DSN` and metrics settings. Never expose the Supabase service-role key, Discord client secret, or bot token in frontend code or public repositories.

### 2. Configure Discord OAuth and bot settings

In the Discord Developer Portal:

1. Create or select the application whose client ID and secret are configured in `backend/.env`.
2. Under **OAuth2 → Redirects**, register this exact callback URL:

   ```text
   http://localhost:3000/api/auth/callback
   ```

   This must match `<WEB_URL>/api/auth/callback`, including scheme, hostname, port, and path. For a deployed dashboard, register its HTTPS callback URL instead.
3. Under **Bot**, enable **Server Members Intent**.
4. Keep the bot token private. Invite permissions are generated by the API and default to `52224` (View Channel, Send Messages, Embed Links, and Attach Files); Administrator is not required.

### 3. Start Redis and migrate the database

Start a local Redis server, then from `backend/` run:

```powershell
npm run build
npm run db:migrate
```

Migrations are stored in `backend/drizzle/`. After changing the Drizzle schema, generate a migration with `npm run db:generate`, review the generated SQL, and apply it with `npm run db:migrate`.

### 4. Run the backend processes

Open three terminals, each in `backend/`:

```powershell
npm run start:dev
```

```powershell
npm run start:bot:dev
```

```powershell
npm run start:worker:dev
```

The API listens on port `4000` by default. Keep the API, bot, and worker running for the complete application workflow.

### 5. Run the frontend

In another terminal:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

The frontend `.env.local` should contain:

```dotenv
BACKEND_URL=http://localhost:4000
```

Open `http://localhost:3000`. The Next.js server reads `BACKEND_URL` for its `/api/*` rewrite; set it before starting or building the frontend.

## Run backend services with Docker Compose

Docker Compose starts Redis, the backend API, the bot, the worker, and a one-shot database migration. It does not start the Next.js frontend.

1. Create and configure `backend/.env` as described above. In Docker, Redis is provided by Compose, so Compose supplies the internal Redis URL to each backend service.
2. Create a root `.env` with a strong Redis password:

   ```dotenv
   REDIS_PASSWORD=replace-with-a-long-random-value
   ```

3. From the repository root, build and start the services:

   ```powershell
   docker compose up -d --build
   ```

4. Inspect service status and logs:

   ```powershell
   docker compose ps
   docker compose logs -f api bot worker migrate
   ```

Run the frontend separately using the local instructions, setting its `BACKEND_URL` to the API address. In a deployed setup, configure the frontend build-time `BACKEND_URL` to reach the API from the Next.js server, and set backend `WEB_URL` to the public dashboard origin. The API should remain private behind the dashboard proxy or reverse proxy.

To stop the Compose services:

```powershell
docker compose down
```

## Request and event workflows

### Discord login

1. The dashboard sends the browser to `/api/auth/login`.
2. The backend creates a short-lived OAuth state value and redirects to Discord with the `identify` and `guilds` scopes.
3. Discord returns to `/api/auth/callback`. The backend validates the state, exchanges the code, encrypts and stores tokens in a Redis-backed session, and sets an HTTP-only session cookie.
4. The frontend calls the API through the same-origin `/api/*` proxy. The API checks the session and the user's Manage Server permission before allowing guild configuration.

### Configure welcome/goodbye messages

1. The dashboard requests the user's manageable servers and the selected server's settings and channels.
2. The editor requests image previews as the user changes image options.
3. Saving validates the message configuration, verifies the channel, writes it to Postgres, records an audit entry, and invalidates the cache.
4. A test send posts the saved message through Discord and reports permission failures to the user.

### Member joins and leaves

1. A bot shard receives a Discord Gateway event.
2. The shard checks the event and enqueues a job in Redis/BullMQ.
3. A worker loads current settings, builds the message and optional image, and posts it to the selected channel.
4. Transient failures are retried with exponential backoff; queue metrics and health endpoints help monitor the services.

## Useful commands

Run commands from `backend/` or `frontend/` as appropriate:

| Command | Directory | Purpose |
|---|---|---|
| `npm run typecheck` | `backend/`, `frontend/` | TypeScript check |
| `npm test` | `backend/` | Backend unit tests |
| `npm run test:e2e` | `backend/` | Backend integration tests (requires test dependencies described in backend docs) |
| `npm test` | `frontend/` | Frontend unit tests |
| `npm run build` | `backend/`, `frontend/` | Production build |
| `npm run db:generate` | `backend/` | Generate migration from schema changes |
| `npm run db:migrate` | `backend/` | Apply database migrations |

Backend health endpoints:

- `GET /health` — process liveness.
- `GET /health/ready` — readiness check for Postgres and Redis.

## Security notes

- Never commit `.env`, `.env.local`, credentials, bot tokens, OAuth secrets, database passwords, or Supabase service-role keys.
- Use HTTPS and the matching public dashboard URL in production. Register the exact HTTPS callback URI in Discord OAuth2 settings.
- Keep the API private where possible; the frontend should proxy `/api/*` to the backend.
- The backend validates sessions, server permissions, request origins, and incoming message configuration. Guild IDs supplied by the browser are not trusted.
- Supabase Row Level Security is enabled by the migrations. The backend must connect using a database role permitted to access its tables.

## More documentation

See [`backend/README.md`](./backend/README.md) for backend API details, security behavior, scaling notes, environment configuration, and testing information.