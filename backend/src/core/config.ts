import { z } from 'zod';

export const APP_CONFIG = Symbol('APP_CONFIG');

const boolish = z.enum(['true', 'false']).transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** Public origin of the dashboard, e.g. https://dexbotx.app (no trailing slash needed). */
  WEB_URL: z.string().url(),
  /** Number of reverse proxies in front of the API (see .env.example). */
  TRUST_PROXY: z.string().default('1'),

  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: boolish.optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),

  REDIS_URL: z.string().min(1),

  DISCORD_CLIENT_ID: z.string().regex(/^\d{17,20}$/, 'must be a Discord snowflake'),
  DISCORD_CLIENT_SECRET: z.string().min(10),
  DISCORD_BOT_TOKEN: z.string().min(20),
  /** Permission integer used in the invite link. 52224 = View Channel + Send Messages + Embed Links + Attach Files. */
  BOT_PERMISSIONS: z.string().regex(/^\d+$/).default('52224'),
  /** "auto" lets Discord choose the shard count, or set a fixed number. */
  SHARD_COUNT: z.string().regex(/^(auto|\d+)$/).default('auto'),

  /** 32-byte key as 64 hex chars. Generate: openssl rand -hex 32 */
  SESSION_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'must be 64 hex characters (32 bytes)'),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(604800).default(604800),
  COOKIE_DOMAIN: z.string().optional(),

  SENTRY_DSN: z.string().optional(),

  /** Concurrent welcome/goodbye jobs per worker process. */
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
  /** If set, the worker serves Prometheus metrics on this port (Bearer METRICS_TOKEN). */
  WORKER_METRICS_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  /** GET /metrics requires "Authorization: Bearer <token>". Unset = endpoint disabled (404). */
  METRICS_TOKEN: z.string().min(16).optional().or(z.literal('')),

  /** Supabase Storage for custom card backgrounds. Optional: uploads are disabled when unset. */
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_SERVICE_KEY: z.string().min(20).optional().or(z.literal('')),
  SUPABASE_BUCKET: z.string().min(3).default('card-backgrounds'),
}).superRefine((config, ctx) => {
  if (config.NODE_ENV !== 'production') return;

  const webUrl = new URL(config.WEB_URL);
  if (webUrl.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(webUrl.hostname)) {
    ctx.addIssue({
      code: 'custom',
      path: ['WEB_URL'],
      message: 'must be a public HTTPS dashboard URL in production',
    });
  }
});

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  isProd: boolean;
  port: number;
  logLevel: string;
  webOrigin: string;
  redirectUri: string;
  inviteRedirectUri: string;
  cookieSecure: boolean;
  cookieDomain?: string;
  trustProxy: boolean | number | string;
  databaseUrl: string;
  databaseSsl: boolean;
  databasePoolMax: number;
  redisUrl: string;
  discordClientId: string;
  discordClientSecret: string;
  discordBotToken: string;
  botPermissions: string;
  shardCount: 'auto' | number;
  sessionKey: Buffer;
  sessionTtlSeconds: number;
  sentryDsn?: string;
  workerConcurrency: number;
  workerMetricsPort?: number;
  metricsToken?: string;
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  supabaseBucket: string;
}

function parseTrustProxy(v: string): boolean | number | string {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  const e = parsed.data;
  const webOrigin = new URL(e.WEB_URL).origin;
  const isProd = e.NODE_ENV === 'production';
  return {
    nodeEnv: e.NODE_ENV,
    isProd,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    webOrigin,
    redirectUri: `${webOrigin}/api/auth/callback`,
    inviteRedirectUri: `${webOrigin}/api/bot/added`,
    cookieSecure: isProd || webOrigin.startsWith('https://'),
    cookieDomain: e.COOKIE_DOMAIN || undefined,
    trustProxy: parseTrustProxy(e.TRUST_PROXY),
    databaseUrl: e.DATABASE_URL,
    databaseSsl: e.DATABASE_SSL ?? isProd,
    databasePoolMax: e.DATABASE_POOL_MAX,
    redisUrl: e.REDIS_URL,
    discordClientId: e.DISCORD_CLIENT_ID,
    discordClientSecret: e.DISCORD_CLIENT_SECRET,
    discordBotToken: e.DISCORD_BOT_TOKEN,
    botPermissions: e.BOT_PERMISSIONS,
    shardCount: e.SHARD_COUNT === 'auto' ? 'auto' : Number(e.SHARD_COUNT),
    sessionKey: Buffer.from(e.SESSION_ENCRYPTION_KEY, 'hex'),
    sessionTtlSeconds: e.SESSION_TTL_SECONDS,
    sentryDsn: e.SENTRY_DSN || undefined,
    workerConcurrency: e.WORKER_CONCURRENCY,
    workerMetricsPort: e.WORKER_METRICS_PORT,
    metricsToken: e.METRICS_TOKEN || undefined,
    supabaseUrl: e.SUPABASE_URL ? e.SUPABASE_URL.replace(/\/+$/, '') : undefined,
    supabaseServiceKey: e.SUPABASE_SERVICE_KEY || undefined,
    supabaseBucket: e.SUPABASE_BUCKET,
  };
}
