# DexBotX frontend

The frontend is the Next.js 16 app for the public website, Discord dashboard, and private admin console. It uses the App Router, React, Tailwind CSS, and Redux Toolkit Query. The browser sends API requests to the same-origin `/api/*` proxy; the Next.js server forwards them to the NestJS backend.

## Requirements

- Node.js 22 or newer and npm.
- The backend running locally for login and API-backed pages.

## Local development

From the repository root:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. By default the API proxy targets `http://localhost:4000`; start the backend API on that port. The frontend `.env.local` file is for local development only and must not contain backend secrets.

## Environment variables

| Variable | Purpose |
|---|---|
| `BACKEND_URL` | Backend origin used by the `/api/*` proxy and Next.js rewrites. Defaults to `http://localhost:4000` in development. |
| `NEXT_PUBLIC_SITE_URL` | Public website origin used for canonical URLs and Open Graph metadata. |
| `NEXT_PUBLIC_GITHUB_URL` | Public project/creator GitHub link in metadata. |
| `NEXT_PUBLIC_DISCORD_SERVER_URL` | Public Discord community invite. |
| `NEXT_PUBLIC_BANNER_GIF` | Public banner image path or absolute URL for social metadata. |

For Vercel, set **Root Directory** to `frontend`. Configure `BACKEND_URL` to the HTTPS backend origin and `NEXT_PUBLIC_SITE_URL` to the deployed website URL. The `NEXT_PUBLIC_*` values are public and must never contain credentials.

## Routes

| Route | Description |
|---|---|
| `/` | Public landing page and bot invitation |
| `/dashboard` | List of Discord servers the signed-in user can manage |
| `/dashboard/[guildId]` | Server overview and welcome/goodbye settings |
| `/dashboard/[guildId]/[kind]` | Welcome or goodbye message editor |
| `/dashboard/[guildId]/music` · `/social` | Feature pages in the dashboard |
| `/admin` | Admin overview: service health, activity, shards, and queue |
| `/admin/rate-limits` | Discord API usage and rate-limit diagnostics |
| `/admin/servers` · `/admin/failures` | Installed servers and failed member-event jobs |
| `/admin/users` · `/admin/content` | Recent logins, sessions, presets, and stored backgrounds |
| `/admin/settings` · `/admin/audit` | Global feature flags and paged admin audit history |

Dashboard and admin route checks in `src/proxy.ts` redirect users without a session cookie to Discord login. The backend validates the session and enforces guild or admin authorization on every API request. Admin access is configured through backend `ADMIN_USER_IDS`; hiding a link or protecting a page in the frontend is not a security boundary.

The admin UI is under `src/app/admin/`, shared UI components are in `src/components/admin/`, and its API endpoints are isolated in `src/store/adminApi.ts`. Admin data is polled by the relevant page only; data remains visible while a refresh is in progress.

## Social previews

Site-wide Open Graph and Twitter metadata is configured in `src/app/layout.tsx`. The `/og.png` route generates the 1200 × 630 PNG social card, and `public/dexbotx-banner-v1.gif` is also included in Open Graph metadata. Inspect the generated image at `<NEXT_PUBLIC_SITE_URL>/og.png`. Social networks may cache previews after a page or image changes.

## Commands

Run these from `frontend/`:

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run build` | Build the production Next.js app |
| `npm run start` | Serve the production build |
| `npm run lint` | Lint the frontend |
| `npm run typecheck` | Run TypeScript checks |
| `npm test` | Run frontend unit tests |
| `npm run analyze` | Build/analyze bundles using the bundle analyzer |

## Security and caching

- Browser API calls use same-origin `/api/*`, so the HTTP-only session cookie is not exposed to client-side JavaScript or sent directly to a separate API origin.
- The proxy forwards requests to `BACKEND_URL`; production requires HTTPS except local/Compose backends.
- Admin authorization is enforced by the backend, and the admin layout is marked `noindex`.
- API responses are not cached by the Next.js proxy. RTK Query retains and refreshes data according to each endpoint's usage.
- `src/app/robots.ts` disallows crawling `/api`, `/dashboard`, and `/admin`.
