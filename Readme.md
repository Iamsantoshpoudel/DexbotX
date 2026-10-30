# DexBotX

DexBotX is an open-source Discord bot and web dashboard for configuring welcome and goodbye messages. Messages can include custom text, embeds, and generated image cards.

## Features

- Configure and preview welcome and goodbye messages for Discord servers.
- Send test messages and optionally upload custom card backgrounds.
- Sign in with Discord OAuth and manage servers from a web dashboard.
- Process member events with a Redis-backed queue and separate workers.
- View service and moderation tools in an optional admin console.

## Architecture

```text
Browser → Next.js frontend → NestJS API → PostgreSQL
                                  ↕          Redis
Discord Gateway → bot process → job queue → worker → Discord API
```

The frontend proxies API requests through `/api/*`. The backend runs as three long-lived processes: the HTTP API, Discord bot, and queue worker. All backend processes share the same PostgreSQL database and Redis instance.

## Requirements

- Node.js 22 or newer and npm.
- PostgreSQL and Redis instances reachable by the backend.
- A Discord application and bot. Enable the **Server Members Intent** to receive join and leave events.

You can run the app on any hosting provider that supports the required Node.js processes, PostgreSQL, and Redis. The dashboard needs a Node.js/Next.js host or a compatible container host. Custom background uploads are optional and currently use Supabase Storage; the rest of the app does not require Supabase.

## Run locally

1. Configure the backend:

   ```powershell
   cd backend
   Copy-Item .env.example .env
   npm install
   ```

   Fill in the required database, Redis, Discord, and session settings in `backend/.env`. Generate a session key with:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

2. Build the backend and apply database migrations once:

   ```powershell
   npm run build
   npm run db:migrate
   ```

3. Run each backend process in a separate terminal from `backend/`:

   ```powershell
   npm run start:dev
   npm run start:bot:dev
   npm run start:worker:dev
   ```

4. In another terminal, run the frontend:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

   Open `http://localhost:3000`. For Discord login, register `http://localhost:3000/api/auth/callback` in the Discord application's OAuth2 redirect URLs.

See [backend/README.md](./backend/README.md) for backend configuration and [frontend/README.md](./frontend/README.md) for frontend configuration.

## Self-hosting

- Set the backend environment variables for your deployment. Set `WEB_URL` to the public dashboard URL and `WS_PUBLIC_URL` to the public WebSocket URL.
- Run `npm run db:migrate` from `backend/` once for each deployment that adds migrations, before starting updated backend processes.
- Run the API with `npm run start`, the bot with `npm run start:bot`, and the worker with `npm run start:worker`. Give all three the same backend environment and shared database and Redis URLs.
- Build and run the frontend with `npm run build` and `npm run start`. Set `BACKEND_URL` to the API's HTTPS URL **at build time**; Next.js uses it for the `/api/*` proxy.
- Register `<WEB_URL>/api/auth/callback` with Discord. Keep database credentials, Redis credentials, Discord secrets, and the session encryption key on backend services only.

The API exposes `GET /health` for liveness and `GET /health/ready` for PostgreSQL and Redis readiness.

## Development

Run commands from `backend/` or `frontend/`:

| Command | Purpose |
|---|---|
| `npm run lint` | Lint the project package |
| `npm run typecheck` | TypeScript checks |
| `npm test` | Run unit tests |
| `npm run build` | Create a production build |

The backend also provides `npm run test:e2e`, `npm run db:generate`, and `npm run db:migrate`. See each package README for details.

## Contributing

Contributions and bug reports are welcome. Keep secrets out of commits, include tests for behavior changes, and run the relevant lint, typecheck, and test commands before opening a pull request.

<h3> 🎉 Thank You for Checking Out the Project! If you enjoy this project, feel free to ⭐️ it and share it with others!</h3>

<div align="center">
  <img src="./Coding.gif" alt="Vipe Coded" width="350" />
</div>

