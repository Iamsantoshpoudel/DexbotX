# DexBotX frontend

The frontend is a Next.js app for the public website, Discord dashboard, and admin console. It uses the App Router, React, Tailwind CSS, and Redux Toolkit Query. Browser API calls use the same-origin `/api/*` route, which Next.js proxies to the backend.

## Requirements

- Node.js 22 or newer and npm.
- The backend running locally for login and API-backed features.

## Local development

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. The development API proxy defaults to `http://localhost:4000`; use `BACKEND_URL` to point to a different local API.

## Configuration

| Variable | Purpose |
|---|---|
| `BACKEND_URL` | Backend HTTP(S) origin. Set explicitly for production; it is read at **build time** because the proxy rewrite is baked into the Next.js output. |
| `NEXT_PUBLIC_WS_ORIGIN` | Public WebSocket origin allowed by the app's security policy. Set to the backend's `wss://` origin in production; if omitted, it is derived from `BACKEND_URL`. |
| `NEXT_PUBLIC_SITE_URL` | Public website URL used for canonical and social metadata. |
| `NEXT_PUBLIC_GITHUB_URL` | Public GitHub link used by the site. |
| `NEXT_PUBLIC_DISCORD_SUPPORT_URL` | Public Discord community invite. |
| `NEXT_PUBLIC_YOUTUBE_PROFILE_URL` | Optional official YouTube profile URL shown on the About page and included in schema.org `sameAs`. |
| `NEXT_PUBLIC_X_PROFILE_URL` | Optional X profile URL included in schema.org `sameAs`. |
| `NEXT_PUBLIC_TWITCH_PROFILE_URL` | Optional Twitch profile URL included in schema.org `sameAs`. |
| `NEXT_PUBLIC_INSTAGRAM_PROFILE_URL` | Optional Instagram profile URL included in schema.org `sameAs`. |
| `NEXT_PUBLIC_LINKEDIN_PROFILE_URL` | Optional LinkedIn profile URL included in schema.org `sameAs`. |
| `GOOGLE_SITE_VERIFICATION` | Optional Google Search Console verification token. |
| `BING_SITE_VERIFICATION` | Optional Bing Webmaster Tools verification token. |

Values prefixed with `NEXT_PUBLIC_` are included in browser-visible output and must not contain secrets. The backend should serve HTTPS in production; the dashboard must be able to reach it, and its WebSocket endpoint must allow secure WebSocket connections.

## Deployment

Deploy on any provider that supports the Next.js Node.js server or the included Dockerfile. Configure the project root as `frontend/` when deploying from the repository. Set `BACKEND_URL` to the backend's public HTTPS origin before building, and set the public metadata variables for your deployment.

The API proxy keeps browser requests and the session cookie on the dashboard origin. Do not expose backend secrets in frontend environment variables. For Docker deployments, the image uses Next.js standalone output.

## Routes

| Route | Purpose |
|---|---|
| `/` | Public landing page |
| `/dashboard` | Discord servers the signed-in user can manage |
| `/dashboard/[guildId]` | Server settings |
| `/admin` | Admin tools; access is enforced by the backend |

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start local development |
| `npm run build` | Build for production |
| `npm run start` | Serve the production build |
| `npm run lint` | Lint frontend source |
| `npm run typecheck` | TypeScript checks |
| `npm test` | Run frontend tests |
| `npm run analyze` | Analyze the production bundle |
