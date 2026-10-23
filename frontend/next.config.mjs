/**
 * The browser only ever talks to THIS origin. /api/* is proxied to the NestJS backend, so:
 *  - the session cookie is first-party (SameSite=Lax, httpOnly) and never exposed to other origins
 *  - there is no CORS surface to get wrong
 *  - the backend can stay on a private network
 * BACKEND_URL is read at BUILD time (rewrites are baked into the standalone output).
 */
const isDev = process.env.NODE_ENV !== 'production';
const configuredBackendUrl = (process.env.BACKEND_URL ?? (
  isDev ? 'http://localhost:4000' : 'https://dexbotx-zq8g.onrender.com'
)).trim();
const isBareLocalhost = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:\/.*)?$/i.test(configuredBackendUrl);
const BACKEND_URL = (isDev && isBareLocalhost ? `http://${configuredBackendUrl}` : configuredBackendUrl).replace(/\/+$/, '');
const backendUrl = new URL(BACKEND_URL);

if (!['http:', 'https:'].includes(backendUrl.protocol) || backendUrl.username || backendUrl.password) {
  throw new Error('BACKEND_URL must be an HTTP(S) URL without embedded credentials');
}
const isComposeBackend = backendUrl.hostname === 'api' && backendUrl.port === '4000';
const isLoopbackBackend = ['localhost', '127.0.0.1', '::1'].includes(backendUrl.hostname);
if (!isDev && backendUrl.protocol !== 'https:' && !isComposeBackend && !isLoopbackBackend) {
  throw new Error('BACKEND_URL must use HTTPS in production');
}

const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; a nonce-based CSP would force every page to render dynamically.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.discordapp.com",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const withBundleAnalyzer = process.env.ANALYZE === 'true'
  ? (await import('@next/bundle-analyzer')).default({ enabled: true, openAnalyzer: false })
  : (config) => config;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
    ],
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND_URL}/:path*` }];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Never let a CDN or browser cache API responses (they are per-user).
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
