import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { createCanvas } from '@napi-rs/canvas';
import {
  ChannelType,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
} from 'discord.js';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { eq, sql } from 'drizzle-orm';
import { ChildProcess, execFileSync, spawn } from 'node:child_process';
import { chownSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { BotModule } from '../src/bot/bot.module';
import { BotService } from '../src/bot/bot.service';
import { DatabaseService } from '../src/db/database.service';
import { adminAudit, auditLogs, guildChannels, guildRoles, guildSettings, guilds, modActions } from '../src/db/schema';
import { SettingsCache } from '../src/redis/settings-cache.service';
import { RedisService } from '../src/redis/redis.service';
import { MemberEventsQueue } from '../src/queue/member-events.queue';
import { WorkerModule } from '../src/worker/worker.module';
import { APP_CONFIG } from '../src/core/config';
import { SessionService } from '../src/auth/session.service';
import { WelcomeService } from '../src/welcome/welcome.service';
import { DiscordRestService } from '../src/discord/discord-rest.service';
import { MetricsService } from '../src/metrics/metrics.service';
import { GuildsService } from '../src/guilds/guilds.service';
import { messageConfigSchema } from '../src/shared/message-config';
import { sha256Hex } from '../src/shared/crypto';
import { GuildSyncService } from '../src/bot/guild-sync.service';
import { findOnboardingChannel } from '../src/bot/bot.service';
import { OnboardingService } from '../src/discord/onboarding.service';
import { ModerationService } from '../src/bot/moderation.service';

const PG_PORT = 54329;
const REDIS_PORT = 63799;
const WEB = 'http://localhost:3000';
const G1 = '111111111111111111'; // bot installed, user can manage
const G2 = '222222222222222222'; // bot installed, user has no permission
const G3 = '333333333333333333'; // user can manage, bot not installed
const C1 = '555555555555555551';
const C_OTHER_GUILD = '999999999999999999';
const USER_ID = '777777777777777777';
const ADMIN_ID = '888888888888888888';

let pgProc: ChildProcess;
let pgDir: string;
let redisProc: ChildProcess;
let app: NestExpressApplication;
let botModule: TestingModule;
let workerModule: TestingModule;
const SUPA = 'https://test.supabase.co';
const METRICS_TOKEN = 'metrics-token-1234567890';
const storageObjects = new Map<string, Buffer>();
const storageCalls: Array<{ method: string; path: string; body?: RequestInit['body'] }> = [];
const realFetch = global.fetch;
const discordCalls: Array<{ method: string; path: string; init: RequestInit }> = [];
const onboardingMessages: Array<{ channelId: string; body: Record<string, unknown> }> = [];
const dmRecipients: string[] = [];
const onboardingEveryone = { id: 'everyone' };
let failMessagePost = false;
let failOnboardingDm = false;
let failRoleLookup = false;
let messagePostFailures = 0;
let failAdminMessageStatus: number | null = null;
let rateLimitGuildChannels = false;
let stubGuildRoles: Array<{ id: string; name: string; color: number; position: number; hoist?: boolean }> = [];
let stubBotRoleIds: string[] = [];

type GuildSummary = { id: string; inviteUrl: string | null; botInstalled: boolean };
type ChannelSummary = { name: string };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function pngBytes(): Promise<Buffer> {
  const c = createCanvas(64, 64);
  const x = c.getContext('2d');
  x.fillStyle = '#ec4899';
  x.fillRect(0, 0, 64, 64);
  return c.encode('png');
}

function installFetchStub(png: Buffer) {
  global.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init.method ?? 'GET').toUpperCase();
    const base = 'https://discord.com/api/v10';
    if (url.startsWith(base)) {
      const path = url.slice(base.length);
      discordCalls.push({ method, path, init });
      if (path === '/users/@me/channels' && method === 'POST') {
        const { recipient_id: recipientId } = JSON.parse(String(init.body)) as { recipient_id: string };
        if (failOnboardingDm) return json({ code: 50007, message: 'Cannot send messages to this user' }, 403);
        dmRecipients.push(recipientId);
        return json({ id: `dm-${recipientId}` });
      }
      if (path === '/oauth2/token') return json({ access_token: 'tok-abc', token_type: 'Bearer', expires_in: 604800, refresh_token: 'r', scope: 'identify guilds' });
      if (path === '/oauth2/token/revoke') return json({});
      if (path === '/users/@me') return json({ id: USER_ID, username: 'tester', global_name: 'Test Er', avatar: null });
      if (path.startsWith('/users/@me/guilds')) {
        return json([
          { id: G1, name: 'Alpha', icon: null, owner: false, permissions: '32' },
          { id: G2, name: 'Bravo', icon: null, owner: false, permissions: '2048' },
          { id: G3, name: 'Charlie', icon: 'abc', owner: true, permissions: '0' },
        ]);
      }
      if (path === `/guilds/${G1}/channels`) {
        if (rateLimitGuildChannels) {
          return new Response(JSON.stringify({ code: 0, message: 'Rate limited', retry_after: 30, global: true }), {
            status: 429,
            headers: { 'content-type': 'application/json', 'x-ratelimit-scope': 'global' },
          });
        }
        return json([
          { id: '555555555555555550', type: 4, name: 'Info', position: 0, parent_id: null },
          { id: C1, type: 0, name: 'welcome', position: 1, parent_id: '555555555555555550' },
          { id: '555555555555555552', type: 2, name: 'voice', position: 2, parent_id: null },
          { id: '555555555555555553', type: 5, name: 'news', position: 3, parent_id: null },
        ]);
      }
      if (path === `/guilds/${G1}/roles` && method === 'GET') {
        if (failRoleLookup) return json({ code: 50013, message: 'Missing Permissions' }, 403);
        return json(stubGuildRoles);
      }
      if (path === `/guilds/${G1}/roles` && method === 'POST') {
        const body = JSON.parse(String(init.body));
        const role = { id: '444444444444444444', name: body.name, color: 0, position: 1, hoist: body.hoist };
        stubGuildRoles.push(role);
        return json(role);
      }
      if (path === `/guilds/${G1}/roles/444444444444444444` && method === 'PATCH') {
        const role = stubGuildRoles.find((candidate) => candidate.id === '444444444444444444');
        if (role) role.hoist = JSON.parse(String(init.body)).hoist;
        return json(role ?? {});
      }
      if (path === `/guilds/${G1}/members/123456789012345678` && method === 'GET') return json({ roles: stubBotRoleIds });
      if (path === `/guilds/${G1}/members/123456789012345678/roles/444444444444444444` && method === 'PUT') {
        if (!stubBotRoleIds.includes('444444444444444444')) stubBotRoleIds.push('444444444444444444');
        return new Response(null, { status: 204 });
      }
      if (path === `/channels/${C1}/permissions/444444444444444444` && method === 'PUT') {
        return new Response(null, { status: 204 });
      }
      if (path === `/channels/${C1}` && method === 'GET') {
        return json({ id: C1, guild_id: G1, type: 0, name: 'welcome', position: 1, parent_id: null, permission_overwrites: [] });
      }
      if (path === `/users/@me/guilds/${G1}` && method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      if (/^\/channels\/[^/]+\/messages$/.test(path)) {
        if (failAdminMessageStatus !== null) {
          const status = failAdminMessageStatus;
          failAdminMessageStatus = null;
          return json({ code: 50013, message: 'Missing Permissions' }, status);
        }
        if (failMessagePost || messagePostFailures > 0) {
          if (messagePostFailures > 0) messagePostFailures--;
          return json({ code: 50013, message: 'Missing Permissions' }, 403);
        }
        if (typeof init.body === 'string') {
          onboardingMessages.push({
            channelId: path.split('/')[2],
            body: JSON.parse(init.body) as Record<string, unknown>,
          });
        }
        return json({ id: '1' });
      }
      return json({ message: 'not stubbed' }, 404);
    }
    if (url.startsWith(SUPA)) {
      const path = url.slice(SUPA.length);
      storageCalls.push({ method, path, body: init.body });
      if (path === '/storage/v1/object/list/card-backgrounds' && method === 'POST') {
        const { prefix = '' } = JSON.parse(String(init.body)) as { prefix?: string };
        const paths = [...storageObjects.keys()].filter((key) => key.startsWith(prefix));
        if (!prefix) {
          return json([...new Set(paths.map((key) => key.split('/')[0]))].map((name) => ({ id: null, name })));
        }
        return json(paths.map((key) => ({
          id: key,
          name: key.slice(prefix.length),
          created_at: '2026-01-01T00:00:00.000Z',
          metadata: { size: storageObjects.get(key)?.length ?? 0 },
        })));
      }
      const obj = path.match(/^\/storage\/v1\/object\/card-backgrounds\/(.+)$/);
      if (obj && method === 'POST') {
        storageObjects.set(obj[1], Buffer.from(init.body as Uint8Array));
        return json({ Key: obj[1] });
      }
      if (obj && method === 'GET') {
        const data = storageObjects.get(obj[1]);
        return data ? new Response(new Uint8Array(data), { status: 200, headers: { 'content-type': 'image/jpeg' } }) : json({ message: 'not found' }, 404);
      }
      if (path === '/storage/v1/object/card-backgrounds' && method === 'DELETE') {
        for (const prefix of JSON.parse(String(init.body)).prefixes) storageObjects.delete(prefix);
        return json([]);
      }
      return json({ message: 'not stubbed' }, 404);
    }
    if (url.startsWith('https://cdn.discordapp.com')) {
      return new Response(new Uint8Array(png), { status: 200, headers: { 'content-type': 'image/png' } });
    }
    return realFetch(input, init);
  }) as typeof fetch;
}

function cookieFrom(res: request.Response, name: string): string | undefined {
  const raw = ([] as string[]).concat((res.headers['set-cookie'] as unknown as string[]) ?? []);
  const found = raw.find((c) => c.startsWith(`${name}=`));
  return found?.split(';')[0];
}

function onboardingChannel(id: string, name: string, position: number, everyoneCanView = true) {
  return {
    id,
    name,
    position,
    type: ChannelType.GuildText,
    permissionsFor: (target: unknown) => ({
      has: (permission: bigint | bigint[]) => target === onboardingEveryone
        ? everyoneCanView && permission === PermissionFlagsBits.ViewChannel
        : true,
    }),
    everyone: onboardingEveryone,
  };
}

function onboardingGuild(
  id: string,
  channels: ReturnType<typeof onboardingChannel>[],
  systemChannel?: ReturnType<typeof onboardingChannel>,
  joinedTimestamp = Date.now(),
) {
  const me = { id: 'bot' };
  return {
    id,
    name: `Guild ${id}`,
    ownerId: 'owner-123456789012345678',
    joinedTimestamp,
    systemChannel: systemChannel as never ?? null,
    roles: { everyone: onboardingEveryone },
    channels: { cache: new Map(channels.map((channel) => [channel.id, channel])) },
    members: { me, fetchMe: async () => me },
    fetchAuditLogs: async () => ({ entries: [] }),
  } as unknown as Guild;
}

/** Postgres refuses to run as root (CI containers, sandboxes), so drop to an unprivileged user when needed. */
function unprivilegedUser(): { uid: number; gid: number } | undefined {
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) return undefined;
  for (const name of ['postgres', 'claude', 'node', 'nobody']) {
    try {
      const uid = Number(execFileSync('id', ['-u', name], { encoding: 'utf8' }).trim());
      const gid = Number(execFileSync('id', ['-g', name], { encoding: 'utf8' }).trim());
      if (Number.isInteger(uid) && uid > 0) return { uid, gid };
    } catch {
      /* try next */
    }
  }
  throw new Error('Running as root and no unprivileged user found for Postgres');
}

async function startPostgres(dir: string): Promise<void> {
  const user = unprivilegedUser();
  if (user) chownSync(dir, user.uid, user.gid);
  pgProc = spawn(process.execPath, [join(__dirname, 'helpers', 'embedded-pg.mjs'), dir, String(PG_PORT), 'dexbotx'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(user ? { ...user, env: { ...process.env, HOME: dir } } : {}),
  });
  let stderr = '';
  pgProc.stderr!.on('data', (d) => (stderr += String(d)));
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`embedded postgres start timeout\n${stderr}`)), 90000);
    pgProc.stdout!.on('data', (d) => {
      if (String(d).includes('PG_READY')) {
        clearTimeout(t);
        resolve();
      }
    });
    pgProc.on('exit', (code) => reject(new Error(`embedded postgres exited (${code})\n${stderr}`)));
    pgProc.on('error', reject);
  });
}

async function startRedis(): Promise<void> {
  const externalRedisUrl = process.env.DEXBOTX_E2E_REDIS_URL;
  if (externalRedisUrl) {
    const Redis = (await import('ioredis')).default;
    const client = new Redis(externalRedisUrl, { lazyConnect: true });
    try {
      await client.connect();
      await client.ping();
    } finally {
      client.disconnect();
    }
    return;
  }

  redisProc = spawn('redis-server', ['--port', String(REDIS_PORT), '--save', '', '--appendonly', 'no', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('redis start timeout')), 15000);
    redisProc.stdout!.on('data', (d) => {
      if (String(d).includes('Ready to accept connections')) {
        clearTimeout(t);
        resolve();
      }
    });
    redisProc.on('error', reject);
  });
}

beforeAll(async () => {
  // --- infrastructure ---
  pgDir = mkdtempSync(join(tmpdir(), 'dexbotx-pg-'));
  await startPostgres(pgDir);
  await startRedis();

  const url = `postgres://postgres:postgres@127.0.0.1:${PG_PORT}/dexbotx`;
  const migSql = postgres(url, { max: 1 });
  await migrate(drizzle(migSql), { migrationsFolder: join(__dirname, '..', 'drizzle') });
  await migSql.end();

  Object.assign(process.env, {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    WEB_URL: WEB,
    DATABASE_URL: url,
    DATABASE_SSL: 'false',
    REDIS_URL: process.env.DEXBOTX_E2E_REDIS_URL ?? `redis://127.0.0.1:${REDIS_PORT}`,
    DISCORD_CLIENT_ID: '123456789012345678',
    DISCORD_CLIENT_SECRET: 'secret-secret-secret',
    DISCORD_BOT_TOKEN: 'bot-token-bot-token-bot-token',
    ADMIN_USER_IDS: ADMIN_ID,
    SESSION_ENCRYPTION_KEY: 'ab'.repeat(32),
    METRICS_TOKEN,
    SUPABASE_URL: SUPA,
    SUPABASE_SERVICE_KEY: 'service-key-service-key-123',
    WORKER_CONCURRENCY: '2',
  });
  installFetchStub(await pngBytes());

  // --- API app ---
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app, app.get(APP_CONFIG));
  await app.init();

  // Simulate what the bot's guild sync writes.
  const db = app.get(DatabaseService).db;
  await db.insert(guilds).values([
    { id: G1, name: 'Alpha Guild', memberCount: 120, bannerHash: null },
    { id: G2, name: 'Bravo Guild', memberCount: 10 },
  ]);
  await db.insert(guildChannels).values([
    { guildId: G1, id: '555555555555555550', type: 4, name: 'Info', parentId: null, position: 0 },
    { guildId: G1, id: C1, type: 0, name: 'welcome', parentId: '555555555555555550', position: 1 },
    { guildId: G1, id: '555555555555555552', type: 2, name: 'voice', parentId: null, position: 2 },
    { guildId: G1, id: '555555555555555553', type: 5, name: 'news', parentId: null, position: 3 },
  ]);
  await db.insert(guildRoles).values([
    { guildId: G1, id: '555555555555555554', name: 'member', color: 0, position: 1 },
  ]);

  // --- Bot (a separate Nest context, like a shard process). Not initialised, so it never logs in to Discord. ---
  const previousBotRole = process.env.DEXBOTX_PROCESS_ROLE;
  process.env.DEXBOTX_PROCESS_ROLE = 'shard0';
  botModule = await Test.createTestingModule({ imports: [BotModule] }).compile();
  if (previousBotRole === undefined) delete process.env.DEXBOTX_PROCESS_ROLE;
  else process.env.DEXBOTX_PROCESS_ROLE = previousBotRole;
  await botModule.get(SettingsCache).onModuleInit();

  // --- Worker (consumes the queue). Created here, started inside the bot tests via init(). ---
  const previousProcessRole = process.env.DEXBOTX_PROCESS_ROLE;
  process.env.DEXBOTX_PROCESS_ROLE = 'worker';
  workerModule = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
  if (previousProcessRole === undefined) delete process.env.DEXBOTX_PROCESS_ROLE;
  else process.env.DEXBOTX_PROCESS_ROLE = previousProcessRole;
});

afterAll(async () => {
  global.fetch = realFetch;
  await app?.close();
  await botModule?.close();
  await workerModule?.close();
  redisProc?.kill('SIGTERM');
  if (pgProc && pgProc.exitCode === null) {
    const exited = new Promise<void>((resolve) => pgProc.once('exit', () => resolve()));
    pgProc.kill('SIGTERM');
    await Promise.race([exited, new Promise((r) => setTimeout(r, 10000))]);
  }
  if (pgDir) rmSync(pgDir, { recursive: true, force: true });
});

describe('DexBotX API', () => {
  let sessionCookie = '';
  const http = () => request(app.getHttpServer());
  const authed = () => ({ Cookie: sessionCookie, Origin: WEB });

  it('reports readiness with a real database and Redis', async () => {
    const res = await http().get('/health/ready').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: true, redis: true });
    await http().get('/health').expect(200);
    expect(await app.get(RedisService).connectedClients()).toBeGreaterThanOrEqual(2);
  });

  it('serves presets publicly with cache headers', async () => {
    const res = await http().get('/templates/presets').expect(200);
    expect(res.headers['cache-control']).toContain('max-age=86400');
    expect(res.headers['cache-control']).toContain('immutable');
    expect(res.headers.etag).toBeTruthy();
    expect(res.headers['server-timing']).toMatch(/^app;dur=/);
    expect(res.body.presets.length).toBeGreaterThanOrEqual(10);
    await http().get('/templates/presets').set('If-None-Match', res.headers.etag).expect(304);
    await http().get('/presets').expect(200).expect(({ headers }) => {
      expect(headers['cache-control']).toContain('max-age=86400');
      expect(headers['cache-control']).toContain('immutable');
    });
  });

  it('sets security headers', async () => {
    const res = await http().get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('redirects the public "Add to Discord" link to the bot authorization screen with minimal permissions', async () => {
    const res = await http().get('/invite').expect(302);
    const url = new URL(res.headers.location);
    expect(url.origin + url.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(url.searchParams.get('client_id')).toBe('123456789012345678');
    expect(url.searchParams.get('scope')).toBe('bot');
    expect(url.searchParams.get('permissions')).toBe('1099780443270'); // moderation permissions, never Administrator (8)
    expect(url.searchParams.has('guild_id')).toBe(false);
  });

  it('rejects anonymous access to protected routes', async () => {
    await http().get('/auth/me').expect(401);
    await http().get('/guilds').expect(401);
    await http().get(`/guilds/${G1}`).expect(401);
    const added = await http().get(`/bot/added?guild_id=${G1}`).expect(302);
    expect(added.headers.location).toBe(`${WEB}/`);
  });

  it('completes the Discord OAuth flow with a bound, single-use state', async () => {
    const login = await http().get('/auth/login?returnTo=/dashboard/123').expect(302);
    const location = new URL(login.headers.location);
    expect(location.origin + location.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(location.searchParams.get('scope')).toBe('identify guilds');
    expect(location.searchParams.has('prompt')).toBe(false);
    expect(location.searchParams.get('redirect_uri')).toBe(`${WEB}/api/auth/callback`);
    const state = location.searchParams.get('state')!;
    const stateCookie = cookieFrom(login, 'dexbotx_oauth')!;
    expect(stateCookie).toContain(state);

    // wrong browser (no state cookie) is rejected
    const stolen = await http().get(`/auth/callback?code=abc&state=${state}`).expect(302);
    expect(stolen.headers.location).toBe(`${WEB}/?error=login_failed`);

    const ok = await http().get(`/auth/callback?code=abc&state=${state}`).set('Cookie', stateCookie).expect(302);
    expect(ok.headers.location).toBe(`${WEB}/dashboard/123`);
    sessionCookie = cookieFrom(ok, 'dexbotx_sid')!;
    expect(sessionCookie).toBeTruthy();
    const setCookie = (ok.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('dexbotx_sid='))!;
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    const loginHintCookie = (ok.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('dbx_li='))!;
    expect(loginHintCookie).toContain('dbx_li=1');
    expect(loginHintCookie).not.toMatch(/HttpOnly/i);
    expect(loginHintCookie).toMatch(/SameSite=Lax/i);
    expect(loginHintCookie.match(/Max-Age=(\d+)/i)?.[1]).toBe(setCookie.match(/Max-Age=(\d+)/i)?.[1]);

    // state is single-use
    const replay = await http().get(`/auth/callback?code=abc&state=${state}`).set('Cookie', stateCookie).expect(302);
    expect(replay.headers.location).toContain('error=login_failed');
  });

  it('stores the logged-in user as the bot-added inviter', async () => {
    const userSession = await app.get(SessionService).create(
      { id: USER_ID, username: 'tester', global_name: null, avatar: null },
      { access_token: 'tok-abc', token_type: 'Bearer', expires_in: 604800, refresh_token: 'r', scope: 'identify guilds' },
    );
    const register = jest.spyOn(app.get(GuildsService), 'registerIfBotPresent').mockResolvedValue({ id: G1 } as never);
    try {
      await http().get(`/bot/added?guild_id=${G1}`).set({ Cookie: `dexbotx_sid=${userSession.sid}` }).expect(302);
      expect(await app.get(RedisService).client.get(`inviter:${G1}`)).toBe(USER_ID);
      expect(await app.get(RedisService).client.ttl(`inviter:${G1}`)).toBeGreaterThan(590);
    } finally {
      register.mockRestore();
      await app.get(RedisService).client.del(`inviter:${G1}`);
      await app.get(SessionService).destroy(userSession.sid);
    }
  });

  it('never stores the Discord token in plain text', async () => {
    const redis = app.get(DatabaseService) && (await import('ioredis')).default;
    const client = new redis(process.env.REDIS_URL!);
    const keys = await client.keys('sess:*');
    expect(keys.length).toBe(1);
    const stored = (await client.get(keys[0]))!;
    expect(stored).not.toContain('tok-abc');
    expect(sessionCookie).not.toContain(keys[0].slice(5)); // key is a hash of the cookie value
    await client.quit();
  });

  it('returns the current user', async () => {
    const res = await http().get('/auth/me').set(authed()).expect(200);
    expect(res.body).toMatchObject({ id: USER_ID, username: 'tester', globalName: 'Test Er', isAdmin: false });
    expect(res.body.avatarUrl).toContain('cdn.discordapp.com');
  });

  it('avoids repeated Discord REST calls for cached user, guild, channel and preset reads', async () => {
    const redis = app.get(RedisService).client;
    const testSession = await app.get(SessionService).create(
      { id: USER_ID, username: 'tester', global_name: 'Test Er', avatar: null },
      { access_token: 'tok-abc', token_type: 'Bearer', expires_in: 604800, refresh_token: 'r', scope: 'identify guilds' },
    );
    const requestHeaders = { Cookie: `dexbotx_sid=${testSession.sid}`, Origin: WEB };
    await redis.del('stat:discord-rest-calls');
    discordCalls.length = 0;
    await redis.del(`ug:${USER_ID}`, `guild:${G1}:channels`);

    for (let i = 0; i < 10; i++) {
      await http().get('/auth/me').set(requestHeaders).expect(200);
      await http().get(`/guilds/${G1}`).set(requestHeaders).expect(200);
      await http().get(`/guilds/${G1}/channels`).set(requestHeaders).expect(200);
      await http().get('/presets').expect(200);
    }

    expect(discordCalls.filter((call) => call.path.startsWith('/users/@me/guilds'))).toHaveLength(1);
    expect(discordCalls).toHaveLength(1);
    expect(await redis.ttl(`guild:${G1}:channels`)).toBeGreaterThan(3500);
    const metrics = await app.get(MetricsService).render();
    expect(metrics).toContain('dexbotx_discord_rest_calls{method="GET",route="/users/@me/guilds"} 1');
  });

  it('creates a short-lived authenticated one-use WebSocket ticket', async () => {
    const response = await http().post('/ws/ticket').set(authed()).expect(201);
    expect(response.body.ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const url = new URL(response.body.url);
    expect(url.origin).toBe(new URL(app.get(APP_CONFIG).wsPublicUrl).origin);
    expect(url.pathname).toBe('/ws');
    expect(url.searchParams.get('ticket')).toBe(response.body.ticket);

    const redis = app.get(RedisService).client;
    expect(await redis.get(`wsticket:${response.body.ticket}`)).toBe(USER_ID);
    expect(await redis.ttl(`wsticket:${response.body.ticket}`)).toBeGreaterThan(0);
    expect(await redis.getdel(`wsticket:${response.body.ticket}`)).toBe(USER_ID);
    expect(await redis.getdel(`wsticket:${response.body.ticket}`)).toBeNull();
  });

  it('hides admin routes from logged-out users and non-admin sessions', async () => {
    await http().get('/admin/me').expect(404);
    await http().get('/admin/me').set(authed()).expect(404);
  });

  it('allows an admin session to access the admin identity route', async () => {
    const adminSession = await app.get(SessionService).create(
      { id: ADMIN_ID, username: 'admin', global_name: 'Admin', avatar: null },
      { access_token: 'tok-abc', token_type: 'Bearer', expires_in: 604800, refresh_token: 'r', scope: 'identify guilds' },
    );
    const cookie = `dexbotx_sid=${adminSession.sid}`;
    await http().get('/admin/me').set({ Cookie: cookie }).expect(200, { admin: true });
    await http().get('/auth/me').set({ Cookie: cookie }).expect(200).expect(({ body }) => {
      expect(body.isAdmin).toBe(true);
    });
  });

  it('serves sanitized recent users and revokes their sessions', async () => {
      const adminSession = await app.get(SessionService).create(
        { id: ADMIN_ID, username: 'admin', global_name: 'Admin', avatar: null },
        { access_token: 'tok-abc', token_type: 'Bearer', expires_in: 604800, refresh_token: 'r', scope: 'identify guilds' },
      );
      const redis = app.get(RedisService).client;
      await redis.del('stat:ev:recent_logins');
      const recentLogin = JSON.stringify({
        id: USER_ID,
        username: 'tester',
        avatarHash: null,
        at: new Date().toISOString(),
      });
      await redis.lpush('stat:ev:recent_logins', recentLogin, recentLogin);
      const revokedSession = await app.get(SessionService).create(
        { id: '666666666666666666', username: 'revoke-me', global_name: null, avatar: null },
        { access_token: 'tok-abc', token_type: 'Bearer', expires_in: 604800, refresh_token: 'r', scope: 'identify guilds' },
      );
      const cookie = { Cookie: `dexbotx_sid=${adminSession.sid}`, Origin: WEB };
      const users = await http().get('/admin/users').set(cookie).expect(200);
      expect(users.body.activeSessions).toEqual(expect.any(Number));
      expect(users.body.recentLogins).toHaveLength(1);
      expect(users.body.recentLogins[0]).toMatchObject({ id: USER_ID, username: 'tester' });
      expect(Object.keys(users.body.recentLogins[0]).sort()).toEqual(['avatar', 'id', 'username']);
      await http().post('/admin/users/666666666666666666/revoke').set(cookie).expect(201, { revoked: 1 });
      expect(await app.get(SessionService).get(revokedSession.sid)).toBeNull();
      expect(await app.get(RedisService).client.exists('usess:666666666666666666')).toBe(0);
      await redis.del('stat:ev:recent_logins');
  });

  it('lists and confirms background deletion, clears guild references, and audits it', async () => {
      const adminSession = await app.get(SessionService).create(
        { id: ADMIN_ID, username: 'admin', global_name: 'Admin', avatar: null },
        { access_token: 'tok-abc', token_type: 'Bearer', expires_in: 604800, refresh_token: 'r', scope: 'identify guilds' },
      );
      const cookie = { Cookie: `dexbotx_sid=${adminSession.sid}`, Origin: WEB };
      const path = `${G1}/${'a'.repeat(64)}.jpg`;
      storageObjects.set(path, Buffer.from('background'));
      const config = messageConfigSchema.parse({
        ...validWelcome(),
        image: { ...validWelcome().image, backgroundPath: path },
      });
      await app.get(DatabaseService).db.insert(guildSettings).values({
        guildId: G1,
        welcome: config,
        goodbye: config,
        updatedBy: ADMIN_ID,
      }).onConflictDoUpdate({
        target: guildSettings.guildId,
        set: { welcome: config, goodbye: config, updatedBy: ADMIN_ID },
      });

      const content = await http().get('/admin/content').set(cookie).expect(200);
      expect(content.body.backgrounds).toContainEqual(expect.objectContaining({ path, guildId: G1, size: 10 }));
      await http().post('/admin/content/background').set(cookie).send({ path }).expect(400);
      await http().post('/admin/content/background').set(cookie).send({ path, confirm: true }).expect(201, { ok: true });
      expect(storageObjects.has(path)).toBe(false);
      const settings = await app.get(DatabaseService).db.select().from(guildSettings).where(eq(guildSettings.guildId, G1));
      expect(settings[0].welcome.image.backgroundPath).toBeNull();
      expect(settings[0].goodbye.image.backgroundPath).toBeNull();
      await app.get(DatabaseService).db.delete(guildSettings).where(eq(guildSettings.guildId, G1));
  });

  it('validates, persists and publicly exposes only the maintenance flag', async () => {
      const adminSession = await app.get(SessionService).create(
        { id: ADMIN_ID, username: 'admin', global_name: 'Admin', avatar: null },
        { access_token: 'tok-abc', token_type: 'Bearer', expires_in: 604800, refresh_token: 'r', scope: 'identify guilds' },
      );
      const cookie = { Cookie: `dexbotx_sid=${adminSession.sid}`, Origin: WEB };
      const flags = { maintenance: true, musicEnabled: true, socialEnabled: false, messageRatePerMinute: 12 };
      await http().put('/admin/flags').set(cookie).send({ ...flags, unexpected: true }).expect(400);
      await http().put('/admin/flags').set(cookie).send(flags).expect(200, flags);
      await http().get('/admin/flags').set(cookie).expect(200, flags);
      await http().get('/flags').expect(200, { maintenance: true });
      await http().put('/admin/flags').set(cookie).send({
        maintenance: false,
        musicEnabled: false,
        socialEnabled: false,
        messageRatePerMinute: 20,
      }).expect(200);
  });

  it('returns newest-first paged audit events filtered by action', async () => {
      const adminSession = await app.get(SessionService).create(
        { id: ADMIN_ID, username: 'admin', global_name: 'Admin', avatar: null },
        { access_token: 'tok-abc', token_type: 'Bearer', expires_in: 604800, refresh_token: 'r', scope: 'identify guilds' },
      );
      const cookie = { Cookie: `dexbotx_sid=${adminSession.sid}` };
      const response = await http().get('/admin/audit?page=1&action=settings.update_flags').set(cookie).expect(200);
      expect(response.body).toMatchObject({ page: 1, pageSize: 50, total: 2, pages: 1 });
      expect(response.body.items.every((event: { action: string }) => event.action === 'settings.update_flags')).toBe(true);
  });

  it('lists and returns server details through the admin API', async () => {
    const adminSession = await app.get(SessionService).create(
      { id: ADMIN_ID, username: 'admin', global_name: 'Admin', avatar: null },
      { access_token: 'tok-abc', token_type: 'Bearer', expires_in: 604800, refresh_token: 'r', scope: 'identify guilds' },
    );
    const cookie = { Cookie: `dexbotx_sid=${adminSession.sid}` };
    const list = await http().get('/admin/guilds?search=Alpha&page=1').set(cookie).expect(200);
    expect(list.body).toMatchObject({ page: 1, total: 1, pages: 1 });
    expect(list.body.guilds[0]).toMatchObject({
      id: G1,
      name: 'Alpha Guild',
      memberCount: 120,
      welcomeEnabled: false,
      goodbyeEnabled: false,
    });

    const detail = await http().get(`/admin/guilds/${G1}`).set(cookie).expect(200);
    expect(detail.body.guild).toMatchObject({ id: G1, name: 'Alpha Guild', ownerId: null });
    expect(detail.body.channels).toHaveLength(2);
  });

  it('sends admin messages only to cached guild channels and audits successful and failed attempts', async () => {
    const adminSession = await app.get(SessionService).create(
      { id: ADMIN_ID, username: 'admin', global_name: 'Admin', avatar: null },
      { access_token: 'tok-abc', token_type: 'Bearer', expires_in: 604800, refresh_token: 'r', scope: 'identify guilds' },
    );
    const cookie = { Cookie: `dexbotx_sid=${adminSession.sid}`, Origin: WEB };
    const redis = app.get(RedisService).client;
    const hourlyKey = `rl:admin-message:guild:${G1}`;
    const cachedChannels = [
      { id: C1, type: 0, name: 'welcome', position: 1, parent_id: null },
      { id: '555555555555555558', type: 0, name: 'general', position: 0, parent_id: null },
      { id: '555555555555555559', type: 2, name: 'voice', position: 2, parent_id: null },
    ];
    const channelCacheKey = `discord:cache:channels:${G1}`;
    const systemChannelCacheKey = `discord:cache:system-channel:${G1}`;
    await redis.set(channelCacheKey, JSON.stringify(cachedChannels), 'EX', 3600);
    await redis.set(systemChannelCacheKey, JSON.stringify(C1), 'EX', 900);
    await redis.del(hourlyKey);
    expect(await redis.get(channelCacheKey)).toBe(JSON.stringify(cachedChannels));
    expect((await app.get(DiscordRestService).getGuildChannels(G1)).map(({ id }) => id))
      .toEqual(cachedChannels.map(({ id }) => id));
    const callCountBefore = discordCalls.length;
    const auditBefore = await app.get(DatabaseService).db
      .select({ id: adminAudit.id })
      .from(adminAudit)
      .where(eq(adminAudit.action, 'guild.message'));

    try {
      await http().post(`/admin/guilds/${G1}/message`).set(authed()).send({ content: 'not an admin' }).expect(404);

      const channelList = await http().get(`/admin/guilds/${G1}/channels-for-message`).set(cookie).expect(200);
      expect(channelList.body).toEqual({
        channels: [
          { id: '555555555555555558', name: 'general', isDefault: false },
          { id: C1, name: 'welcome', isDefault: true },
        ],
        defaultChannelId: C1,
      });
      expect(discordCalls.length).toBe(callCountBefore);

      const message = 'Maintenance starts at 8 PM.';
      await http().post(`/admin/guilds/${G1}/message`).set(cookie).send({
        content: message,
        embed: { title: 'Notice', description: 'Please plan ahead.', color: '#5b4bff' },
      }).expect(201, { ok: true, channelId: C1 });
      const sentCall = discordCalls.find((call) =>
        call.method === 'POST' && call.path === `/channels/${C1}/messages` &&
        JSON.stringify(call.init.body).includes(message),
      );
      expect(sentCall).toBeTruthy();
      const sentPayload = JSON.parse(String(sentCall?.init.body));
      expect(sentPayload.content).toBe(message);
      expect(sentPayload.allowed_mentions).toEqual({ parse: [], users: [] });
      expect(sentPayload.embeds[0]).toMatchObject({ title: 'Notice', description: 'Please plan ahead.', color: 0x5b4bff });

      await http().post(`/admin/guilds/${G1}/message`).set(cookie).send({
        channelId: C_OTHER_GUILD,
        content: 'Wrong server channel',
      }).expect(400);

      await http().post(`/admin/guilds/${G1}/message`).set(cookie).send({ content: 'Second message' }).expect(201);
      await http().post(`/admin/guilds/${G1}/message`).set(cookie).send({ content: 'Third message' }).expect(201);
      const limited = await http().post(`/admin/guilds/${G1}/message`).set(cookie).send({ content: 'Fourth message' }).expect(429);
      expect(limited.body.retryAfter).toEqual(expect.any(Number));
      expect(limited.headers['retry-after']).toBe(String(limited.body.retryAfter));

      await redis.del(hourlyKey);
      failAdminMessageStatus = 403;
      const denied = await http().post(`/admin/guilds/${G1}/message`).set(cookie).send({ content: 'Discord denies this' }).expect(422);
      expect(denied.body).toMatchObject({
        code: 'CANNOT_POST',
        message: 'DexBotX cannot post in #welcome',
      });

      const auditRows = await app.get(DatabaseService).db.select().from(adminAudit)
        .where(eq(adminAudit.action, 'guild.message'));
      const newAudits = auditRows.filter((row) => row.id > Math.max(0, ...auditBefore.map(({ id }) => id)));
      expect(newAudits).toHaveLength(6);
      expect(newAudits.filter((row) => row.details.success === true)).toHaveLength(3);
      expect(newAudits.filter((row) => row.details.success === false)).toHaveLength(3);
      const successAudit = newAudits.find((row) => row.details.preview === message);
      expect(successAudit?.details).toMatchObject({
        guildId: G1,
        channelId: C1,
        channelName: 'welcome',
        length: message.length,
        sha256: sha256Hex(message),
        preview: message,
      });
      expect(successAudit?.adminId).toBe(ADMIN_ID);
    } finally {
      failAdminMessageStatus = null;
      await redis.del(hourlyKey, channelCacheKey, systemChannelCacheKey);
      await app.get(SessionService).destroy(adminSession.sid);
    }
  });

  it('audits admin server writes and requires an exact server-name confirmation to leave', async () => {
    const adminSession = await app.get(SessionService).create(
      { id: ADMIN_ID, username: 'admin', global_name: 'Admin', avatar: null },
      { access_token: 'tok-abc', token_type: 'Bearer', expires_in: 604800, refresh_token: 'r', scope: 'identify guilds' },
    );
    const cookie = { Cookie: `dexbotx_sid=${adminSession.sid}`, Origin: WEB };
    const asciiConfig = messageConfigSchema.parse({ ...validWelcome(), enabled: false, channelId: null });
    await app.get(DatabaseService).db.insert(guildSettings).values({
      guildId: G1,
      welcome: asciiConfig,
      goodbye: asciiConfig,
      updatedBy: ADMIN_ID,
    }).onConflictDoUpdate({
      target: guildSettings.guildId,
      set: { welcome: asciiConfig, goodbye: asciiConfig, updatedBy: ADMIN_ID },
    });
    await http().post(`/admin/guilds/${G1}/disable`).set(cookie).expect(201, { ok: true });
    await http().post(`/admin/guilds/${G1}/resync`).set(cookie).expect(201, { ok: true });
    await http().post(`/admin/guilds/${G1}/leave`).set(cookie).send({ confirm: 'wrong name' }).expect(400);

    const audit = await app.get(DatabaseService).db.select().from(adminAudit);
    expect(audit.map((row) => row.action)).toEqual(expect.arrayContaining(['guild.disable', 'guild.resync']));
    expect(audit.every((row) => row.adminId === ADMIN_ID)).toBe(true);
    await app.get(DatabaseService).db.delete(guildSettings).where(eq(guildSettings.guildId, G1));
  });

  it('exposes sanitized failed-job responses and requires confirmation before clearing', async () => {
    const adminSession = await app.get(SessionService).create(
      { id: ADMIN_ID, username: 'admin', global_name: 'Admin', avatar: null },
      { access_token: 'tok-abc', token_type: 'Bearer', expires_in: 604800, refresh_token: 'r', scope: 'identify guilds' },
    );
    const cookie = { Cookie: `dexbotx_sid=${adminSession.sid}`, Origin: WEB };
    const failures = await http().get('/admin/failures').set(cookie).expect(200);
    expect(Array.isArray(failures.body)).toBe(true);
    for (const job of failures.body) {
      expect(Object.keys(job).sort()).toEqual(['guildId', 'id', 'kind', 'reason', 'time']);
    }
    await http().post('/admin/failures/clear').set(cookie).send({}).expect(400);
    await http().post('/admin/failures/clear').set(cookie).send({ confirm: true }).expect(201, { cleared: 0 });
  });

  it('returns the rate-limit metrics shape for admins', async () => {
    const adminSession = await app.get(SessionService).create(
      { id: ADMIN_ID, username: 'admin', global_name: 'Admin', avatar: null },
      { access_token: 'tok-abc', token_type: 'Bearer', expires_in: 604800, refresh_token: 'r', scope: 'identify guilds' },
    );
    const redis = app.get(RedisService).client;
    const minute = Math.floor(Date.now() / 60_000);
    const key = `stat:min:${minute}`;
    await redis.hset(key, {
      d_total: '25',
      d_401: '2',
      d_403: '3',
      d_404: '1',
      d_429: '4',
      'cache:settings:hit': '8',
      'cache:settings:miss': '2',
      'cache:channels:hit': '1',
      'cache:channels:miss': '3',
      'cache:userGuilds:hit': '3',
      'cache:userGuilds:miss': '1',
    });
    const event = { route: '/guilds/:id/channels', scope: 'global', retryAfter: 30, global: true, at: new Date().toISOString() };
    await redis.lpush('stat:ev:d429', JSON.stringify(event));
    await redis.set('discord:blocked_until', String(Date.now() + 30_000), 'EX', 30);

    const res = await http().get('/admin/rate-limits').set({ Cookie: `dexbotx_sid=${adminSession.sid}` }).expect(200);
    expect(res.body.perMinute).toHaveLength(60);
    expect(res.body.perMinute.find((row: { minute: number }) => row.minute === minute)).toMatchObject({
      total: 25,
      c401: 2,
      c403: 3,
      c404: 1,
      c429: 4,
    });
    expect(res.body.invalidLast10Min).toBeGreaterThanOrEqual(9);
    expect(res.body.recent429[0]).toEqual(event);
    expect(res.body.blockedUntil).toBeGreaterThan(Date.now());
    expect(res.body.cache).toEqual({ settings: 80, channels: 25, userGuilds: 75 });
    expect(res.body.queue).toEqual(expect.objectContaining({
      waiting: expect.any(Number),
      active: expect.any(Number),
      delayed: expect.any(Number),
      failed: expect.any(Number),
      oldestWaitingSeconds: expect.any(Number),
    }));
    await redis.del('discord:blocked_until');
  });

  it('records Discord 429s and serves cached Discord data during the block', async () => {
    const redis = app.get(RedisService).client;
    const discord = app.get(DiscordRestService);
    const userGuilds = app.get(GuildsService);
    const cachedSession = await app.get(SessionService).create(
      { id: USER_ID, username: 'tester', global_name: 'Test Er', avatar: null },
      { access_token: 'tok-abc', token_type: 'Bearer', expires_in: 604800, refresh_token: 'r', scope: 'identify guilds' },
    );
    const session = (await app.get(SessionService).get(cachedSession.sid))!;

    await redis.del('discord:blocked_until', 'discord:cache:channels:' + G1);
    rateLimitGuildChannels = false;
    const minuteKey = `stat:min:${Math.floor(Date.now() / 60_000)}`;
    const totalBefore = Number(await redis.hget(minuteKey, 'd_total') ?? 0);
    const rateLimitsBefore = Number(await redis.hget(minuteKey, 'd_429') ?? 0);
    const fetchedChannels = await discord.getGuildChannels(G1);
    await redis.del(`discord:cache:channels:${G1}`);
    rateLimitGuildChannels = true;
    await expect(discord.getGuildChannels(G1)).rejects.toMatchObject({ status: 429 });
    rateLimitGuildChannels = false;

    expect(Number(await redis.hget(minuteKey, 'd_total'))).toBe(totalBefore + 2);
    expect(Number(await redis.hget(minuteKey, 'd_429'))).toBe(rateLimitsBefore + 1);
    const blockedUntil = Number(await redis.get('discord:blocked_until'));
    expect(blockedUntil).toBeGreaterThan(Date.now());
    const events = (await redis.lrange('stat:ev:d429', 0, 0)).map((item) => JSON.parse(item));
    expect(events[0]).toMatchObject({
      route: '/guilds/:id/channels',
      scope: 'global',
      retryAfter: 30,
      global: true,
    });
    expect(events[0].route).not.toContain(G1);

    await redis.set(`discord:cache:channels:${G1}`, JSON.stringify(fetchedChannels), 'EX', 3600);
    discordCalls.length = 0;
    expect(await discord.getGuildChannels(G1)).toHaveLength(4);
    expect(discordCalls).toHaveLength(0);

    const cachedGuilds = [{ id: G1, name: 'Alpha', icon: null, owner: false, permissions: '32' }];
    await redis.set(`ug:${USER_ID}`, JSON.stringify(cachedGuilds), 'EX', 60);
    expect(await userGuilds.getUserGuilds(session)).toEqual(cachedGuilds);
    expect(discordCalls).toHaveLength(0);

    await redis.del('discord:blocked_until', `ug:${USER_ID}`, `discord:cache:channels:${G1}`);
  });

  it('lists only servers the user can manage, flagging where the bot is missing', async () => {
    const res = await http().get('/guilds').set(authed()).expect(200);
    const guilds = res.body.guilds as GuildSummary[];
    const byId = Object.fromEntries(guilds.map((guild) => [guild.id, guild]));
    expect(Object.keys(byId).sort()).toEqual([G1, G3]);
    expect(byId[G1]).toMatchObject({ botInstalled: true, inviteUrl: null });
    expect(byId[G3].botInstalled).toBe(false);
    const inviteUrl = byId[G3].inviteUrl;
    if (!inviteUrl) throw new Error('Expected a bot invite URL for a server without the bot');
    const invite = new URL(inviteUrl);
    expect(invite.searchParams.get('permissions')).toBe('1099780443270');
    expect(invite.searchParams.get('guild_id')).toBe(G3);
    expect(res.body.guilds[0].id).toBe(G1); // installed first
  });

  it('enforces per-server authorization on the server side', async () => {
    await http().get(`/guilds/${G2}`).set(authed()).expect(403); // no Manage Server
    await http().get(`/guilds/${G3}`).set(authed()).expect(404); // bot not installed
    await http().get('/guilds/444444444444444444').set(authed()).expect(403); // not a member
    await http().get('/guilds/not-a-number').set(authed()).expect(400);
    await http().put(`/guilds/${G2}/messages/welcome`).set(authed()).send({}).expect(403);
  });

  it('returns defaults for an unconfigured server and lists channels', async () => {
    const res = await http().get(`/guilds/${G1}`).set(authed()).expect(200);
    expect(res.body.guild).toMatchObject({ id: G1, name: 'Alpha Guild', memberCount: 120 });
    expect(res.body.settings.welcome.enabled).toBe(false);
    const ch = await http().get(`/guilds/${G1}/channels`).set(authed()).expect(200);
    const channels = ch.body.channels as ChannelSummary[];
    expect(channels.map((channel) => channel.name)).toEqual(['welcome', 'news']);
    expect(ch.body.channels[0].category).toBe('Info');
  });

  const validWelcome = (over: object = {}) => ({
    enabled: true,
    channelId: C1,
    content: 'Welcome {user} to {server}!',
    embed: { enabled: true, title: 'Hello {displayName}', description: 'Member {memberCountOrdinal}', color: '#5b4bff', footer: 'footer' },
    image: { enabled: true, style: 'neon', title: 'Welcome', subtitle: 'Member #{memberCount}', accentColor: '#22d3ee', useServerBanner: false, avatarShape: 'rounded', showMemberCount: true },
    ...over,
  });

  it('blocks cross-site writes (CSRF)', async () => {
    await http().put(`/guilds/${G1}/messages/welcome`).set({ Cookie: sessionCookie }).send(validWelcome()).expect(403);
    await http().put(`/guilds/${G1}/messages/welcome`).set({ Cookie: sessionCookie, Origin: 'https://evil.example' }).send(validWelcome()).expect(403);
  });

  it('validates input strictly', async () => {
    const put = (body: unknown) => http().put(`/guilds/${G1}/messages/welcome`).set(authed()).send(body as object);
    const bad = await put(validWelcome({ image: { ...validWelcome().image, accentColor: 'red' } })).expect(400);
    expect(bad.body.issues[0].path).toBe('image.accentColor');
    await put({ ...validWelcome(), admin: true }).expect(400);
    await put(validWelcome({ content: 'x'.repeat(2001) })).expect(400);
    await put(validWelcome({ channelId: null })).expect(400); // enabled without a channel
    const wrongGuildChannel = await put(validWelcome({ channelId: C_OTHER_GUILD })).expect(400);
    expect(wrongGuildChannel.body.issues[0]).toEqual({ path: 'channelId', message: 'That channel does not exist in this server' });
    await http().put(`/guilds/${G1}/messages/nonsense`).set(authed()).send(validWelcome()).expect(404);
  });

  it('saves a template, records an audit entry and refreshes caches', async () => {
    const res = await http().put(`/guilds/${G1}/messages/welcome`).set(authed()).send(validWelcome()).expect(200);
    expect(res.body.config.channelId).toBe(C1);
    expect(res.body.imageKey).toMatch(/^[a-f0-9]{64}$/);

    const detail = await http().get(`/guilds/${G1}`).set(authed()).expect(200);
    expect(detail.body.settings.welcome.content).toBe('Welcome {user} to {server}!');
    expect(detail.body.settings.goodbye.enabled).toBe(false);
    expect(detail.body.imageKeys.welcome).toBe(res.body.imageKey);

    const db = app.get(DatabaseService).db;
    const audit = await db.select().from(auditLogs).where(eq(auditLogs.guildId, G1));
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ userId: USER_ID, action: 'welcome.update' });
  });

  it('keeps the bot\'s in-process cache coherent through Redis pub/sub', async () => {
    const botCache = botModule.get(SettingsCache);
    expect((await botCache.get(G1)).welcome.content).toBe('Welcome {user} to {server}!'); // populates the bot's L1
    await http().put(`/guilds/${G1}/messages/welcome`).set(authed()).send(validWelcome({ content: 'Updated text {user}' })).expect(200);
    await new Promise((r) => setTimeout(r, 150));
    expect((await botCache.get(G1)).welcome.content).toBe('Updated text {user}');
  });

  it('caches previews by image inputs, supports conditional requests, and invalidates on changed inputs', async () => {
    const redis = app.get(RedisService).client;
    const existingKeys = await redis.keys('card:*');
    if (existingKeys.length) await redis.del(...existingKeys);
    const service = app.get(WelcomeService);
    const render = jest.spyOn(service['builder'], 'buildImage');
    const preview = (config: object, cookie = sessionCookie) => http()
      .post(`/guilds/${G1}/messages/welcome/preview`)
      .set({ Cookie: cookie, Origin: WEB })
      .send(config)
      .buffer(true)
      .parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    const config = validWelcome();
    const first = await preview(config).expect(200);
    expect(first.headers['content-type']).toBe('image/png');
    expect(first.headers['cache-control']).toBe('private, max-age=0, must-revalidate');
    expect(first.headers['x-card-key']).toMatch(/^[a-f0-9]{64}$/);
    expect(first.headers.etag).toBe(`"${first.headers['x-card-key']}"`);
    const firstPng = first.body as Buffer;
    expect(firstPng.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(firstPng.readUInt32BE(16)).toBe(1100);
    expect(render).toHaveBeenCalledTimes(1);

    const second = await preview(config).expect(200);
    expect(second.headers['x-card-key']).toBe(first.headers['x-card-key']);
    expect(second.headers.etag).toBe(first.headers.etag);
    expect(render).toHaveBeenCalledTimes(1);

    await http()
      .post(`/guilds/${G1}/messages/welcome/preview`)
      .set({ ...authed(), 'If-None-Match': first.headers.etag })
      .send(config)
      .expect(304);
    expect(render).toHaveBeenCalledTimes(1);

    const titleChanged = await preview(validWelcome({
      image: { ...config.image, title: 'Changed title' },
    })).expect(200);
    expect(titleChanged.headers['x-card-key']).not.toBe(first.headers['x-card-key']);
    const accentChanged = await preview(validWelcome({
      image: { ...config.image, accentColor: '#abcdef' },
    })).expect(200);
    expect(accentChanged.headers['x-card-key']).not.toBe(first.headers['x-card-key']);

    const alternate = await app.get(SessionService).create(
      { id: USER_ID, username: 'tester', global_name: 'Test Er', avatar: 'changed-avatar-hash' },
      { access_token: 'tok-abc', token_type: 'Bearer', expires_in: 604800, refresh_token: 'r', scope: 'identify guilds' },
    );
    const avatarChanged = await preview(config, `dexbotx_sid=${alternate.sid}`).expect(200);
    expect(avatarChanged.headers['x-card-key']).not.toBe(first.headers['x-card-key']);
    render.mockRestore();
  });

  it('sends a test message through Discord with mentions locked down', async () => {
    discordCalls.length = 0;
    const res = await http().post(`/guilds/${G1}/messages/welcome/test`).set(authed()).expect(200);
    expect(res.body).toEqual({ channelId: C1 });
    const post = discordCalls.find((c) => c.method === 'POST' && c.path === `/channels/${C1}/messages`)!;
    expect(new Headers(post.init.headers).get('authorization')).toMatch(/^Bot /);
    const form = post.init.body as FormData;
    const payload = JSON.parse(String(form.get('payload_json')));
    expect(payload.content).toBe('Updated text <@777777777777777777>');
    expect(payload.allowed_mentions).toEqual({ parse: [], users: [USER_ID] });
    expect(payload.embeds[0].image.url).toBe('attachment://card.png');
    expect((form.get('files[0]') as Blob).size).toBeGreaterThan(1000);
  });

  it('explains missing channel permissions instead of failing opaquely', async () => {
    failMessagePost = true;
    const res = await http().post(`/guilds/${G1}/messages/welcome/test`).set(authed()).expect(400);
    expect(res.body.message).toContain('cannot post in #welcome');
    failMessagePost = false;
  });

  it('repairs channel access after a denied test post and retries once', async () => {
    const redis = app.get(RedisService).client;
    await redis.del(`permfix:${G1}:${C1}`);
    stubGuildRoles = [];
    stubBotRoleIds = [];
    failMessagePost = false;
    messagePostFailures = 1;
    discordCalls.length = 0;

    await http().post(`/guilds/${G1}/messages/welcome/test`).set(authed()).expect(200);

    const roleCreate = discordCalls.find((call) => call.method === 'POST' && call.path === `/guilds/${G1}/roles`);
    expect(roleCreate).toBeTruthy();
    expect(JSON.parse(String(roleCreate!.init.body))).toEqual({
      name: 'DexBotX',
      permissions: (
        PermissionFlagsBits.ViewChannel |
        PermissionFlagsBits.SendMessages |
        PermissionFlagsBits.EmbedLinks |
        PermissionFlagsBits.AttachFiles |
        PermissionFlagsBits.ReadMessageHistory
      ).toString(),
      mentionable: false,
      hoist: true,
    });
    expect(discordCalls.some((call) => call.method === 'PUT' && call.path === `/guilds/${G1}/members/123456789012345678/roles/444444444444444444`)).toBe(true);
    const overwrite = discordCalls.find((call) => call.method === 'PUT' && call.path === `/channels/${C1}/permissions/444444444444444444`);
    expect(JSON.parse(String(overwrite?.init.body))).toEqual({
      type: 0,
      allow: (
        PermissionFlagsBits.ViewChannel |
        PermissionFlagsBits.SendMessages |
        PermissionFlagsBits.EmbedLinks |
        PermissionFlagsBits.AttachFiles |
        PermissionFlagsBits.ReadMessageHistory
      ).toString(),
      deny: '0',
    });
    expect(discordCalls.filter((call) => call.method === 'POST' && call.path === `/channels/${C1}/messages`)).toHaveLength(2);
    await redis.del(`permfix:${G1}:${C1}`);
  });

  it('does not repeat Discord permission repair calls during the cooldown', async () => {
    const redis = app.get(RedisService).client;
    await redis.del(`permfix:${G1}:${C1}`);
    stubGuildRoles = [];
    stubBotRoleIds = [];
    failMessagePost = true;
    discordCalls.length = 0;

    await http().post(`/guilds/${G1}/messages/welcome/test`).set(authed()).expect(400);
    const repairCalls = () => discordCalls.filter((call) =>
      call.path === `/guilds/${G1}/roles` ||
      call.path === `/guilds/${G1}/members/123456789012345678` ||
      call.path === `/guilds/${G1}/members/123456789012345678/roles/444444444444444444` ||
      call.path === `/channels/${C1}/permissions/444444444444444444`,
    ).length;
    const firstRepairCallCount = repairCalls();
    expect(firstRepairCallCount).toBeGreaterThan(0);

    const callsBeforeSecondFailure = discordCalls.length;
    await http().post(`/guilds/${G1}/messages/welcome/test`).set(authed()).expect(400);
    expect(repairCalls()).toBe(firstRepairCallCount);
    expect(discordCalls.slice(callsBeforeSecondFailure).filter((call) => call.path === `/channels/${C1}/messages`)).toHaveLength(1);

    failMessagePost = false;
    await redis.del(`permfix:${G1}:${C1}`);
  });

  it('explains that Manage Roles is needed when Discord refuses permission repair', async () => {
    const redis = app.get(RedisService).client;
    await redis.del(`permfix:${G1}:${C1}`);
    failMessagePost = true;
    failRoleLookup = true;

    const res = await http().post(`/guilds/${G1}/messages/welcome/test`).set(authed()).expect(400);
    expect(res.body.message).toBe(
      "DexBotX can't post in #welcome. Give it the Manage Roles permission, or allow View Channel, Send Messages, Embed Links and Attach Files for the bot in that channel.",
    );

    failMessagePost = false;
    failRoleLookup = false;
    await redis.del(`permfix:${G1}:${C1}`);
  });

  const bigPng = async (w = 1200, h = 500) => {
    const c = createCanvas(w, h);
    const x = c.getContext('2d');
    x.fillStyle = '#10b981';
    x.fillRect(0, 0, w, h);
    return c.encode('png');
  };
  let uploadedPath = '';

  it('uploads a custom background: validated, re-encoded and stored privately', async () => {
    const res = await http().post(`/guilds/${G1}/assets/background`).set(authed()).attach('file', await bigPng(), { filename: 'bg.png', contentType: 'image/png' }).expect(201);
    uploadedPath = res.body.path;
    expect(uploadedPath).toMatch(new RegExp(`^${G1}/[0-9a-f]{64}\\.jpg$`));
    const stored = storageObjects.get(uploadedPath)!;
    expect(stored.subarray(0, 2).toString('hex')).toBe('ffd8'); // re-encoded as JPEG, not the original bytes
    const call = storageCalls.find((c) => c.method === 'POST' && c.path.endsWith(uploadedPath))!;
    expect(call).toBeTruthy();
  });

  it('rejects bad uploads: non-images, decompression bombs, oversize files, other servers, anonymous users', async () => {
    const up = (gid: string, buf: Buffer, name = 'x.png', type = 'image/png') =>
      http().post(`/guilds/${gid}/assets/background`).set(authed()).attach('file', buf, { filename: name, contentType: type });
    await up(G1, Buffer.from('<?php echo 1; ?>'), 'x.png').expect(400);
    const bomb = Buffer.from(await bigPng(300, 300));
    bomb.writeUInt32BE(60000, 16);
    bomb.writeUInt32BE(60000, 20);
    const bombRes = await up(G1, bomb).expect(400);
    expect(bombRes.body.message).toContain('too large');
    await up(G1, Buffer.alloc(3 * 1024 * 1024, 1)).expect(413);
    await up(G2, await bigPng()).expect(403); // user cannot manage G2
    await http().post(`/guilds/${G1}/assets/background`).set(authed()).expect(400); // no file
    await http().post(`/guilds/${G1}/assets/background`).set({ Origin: WEB }).attach('file', await bigPng(), 'x.png').expect(401);
  });

  it('uses the background in previews and only accepts references owned by the same server', async () => {
    const withBg = (path: string | null) => validWelcome({ content: 'Updated text {user}', image: { ...validWelcome().image, backgroundPath: path } });
    const foreign = await http().put(`/guilds/${G1}/messages/welcome`).set(authed()).send(withBg(`${G2}/${'a'.repeat(64)}.jpg`)).expect(400);
    expect(foreign.body.issues[0].path).toBe('image.backgroundPath');
    await http().put(`/guilds/${G1}/messages/welcome`).set(authed()).send(withBg('https://evil.example/x.png')).expect(400); // arbitrary URLs are not accepted

    await http().post(`/guilds/${G1}/messages/welcome/preview`).set(authed()).send(withBg(uploadedPath)).expect(200);
    await http().put(`/guilds/${G1}/messages/welcome`).set(authed()).send(withBg(uploadedPath)).expect(200);
    expect(storageObjects.has(uploadedPath)).toBe(true);

    // Removing the background deletes the stored object and restores the state later tests rely on.
    await http().put(`/guilds/${G1}/messages/welcome`).set(authed()).send(withBg(null)).expect(200);
    expect(storageObjects.has(uploadedPath)).toBe(false);
  });

  it('resets only the selected message kind and records the reset atomically', async () => {
    const res = await http().delete(`/guilds/${G1}/messages/goodbye`).set(authed()).expect(200);
    expect(res.body.config.enabled).toBe(false);

    const detail = await http().get(`/guilds/${G1}`).set(authed()).expect(200);
    expect(detail.body.settings.goodbye.enabled).toBe(false);
    expect(detail.body.settings.welcome.content).toBe('Updated text {user}');

    const audit = await app.get(DatabaseService).db.select().from(auditLogs).where(eq(auditLogs.guildId, G1));
    expect(audit.some((entry) => entry.action === 'goodbye.reset' && entry.userId === USER_ID)).toBe(true);
  });

  it('exposes Prometheus metrics only with the bearer token, using route templates', async () => {
    await http().get('/metrics').expect(401);
    await http().get('/metrics').set('Authorization', 'Bearer wrong-token-wrong-token').expect(401);
    const res = await http().get('/metrics').set('Authorization', `Bearer ${METRICS_TOKEN}`).expect(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('dexbotx_http_request_duration_seconds_count');
    expect(res.text).toContain('route="/guilds/:guildId/messages/:kind"');
    expect(res.text).toContain('dexbotx_queue_jobs{state="waiting"}');
    expect(res.text).toMatch(/redis_connections \d+/);
    expect(res.text).toContain('nodejs_heap_size_total_bytes');
    expect(res.text).not.toContain(G1); // raw ids never become label values
  });

  it('has Row Level Security enabled on every table', async () => {
    const db = app.get(DatabaseService).db;
    const rows = (await db.execute(sql`select relname, relrowsecurity from pg_class where relname in ('guilds','guild_settings','guild_channels','guild_roles','guild_templates','audit_logs') order by relname`)) as unknown as Array<{ relname: string; relrowsecurity: boolean }>;
    expect(rows.map((r) => [r.relname, r.relrowsecurity])).toEqual([
      ['audit_logs', true],
      ['guild_channels', true],
      ['guild_roles', true],
      ['guild_settings', true],
      ['guild_templates', true],
      ['guilds', true],
    ]);
  });

  it('rate limits expensive endpoints per user', async () => {
    let last = 200;
    for (let i = 0; i < 8 && last !== 429; i++) {
      last = (await http().post(`/guilds/${G1}/messages/welcome/test`).set(authed())).status;
    }
    expect(last).toBe(429);
  });

  it('destroys every indexed session for a user', async () => {
    const sessions = app.get(SessionService);
    const userId = '444444444444444444';
    const user = { id: userId, username: 'multi-session', global_name: null, avatar: null };
    const token = { access_token: 'tok-abc', token_type: 'Bearer', expires_in: 604800, refresh_token: 'r', scope: 'identify guilds' } as const;
    const created = await Promise.all([sessions.create(user, token), sessions.create(user, token)]);
    const redis = app.get(RedisService).client;
    const indexKey = `usess:${userId}`;
    expect(await redis.scard(indexKey)).toBe(2);

    expect(await sessions.destroyAllForUser(userId)).toBe(2);
    expect(await redis.exists(indexKey)).toBe(0);
    for (const { sid } of created) expect(await sessions.get(sid)).toBeNull();
  });

  it('logs out idempotently, removes the session index and cache, and revokes the token', async () => {
    const login = await http().get('/auth/login').expect(302);
    const state = new URL(login.headers.location).searchParams.get('state')!;
    const stateCookie = cookieFrom(login, 'dexbotx_oauth')!;
    const callback = await http().get(`/auth/callback?code=abc&state=${state}`).set('Cookie', stateCookie).expect(302);
    const logoutCookie = cookieFrom(callback, 'dexbotx_sid')!;
    const logoutAuth = { Cookie: logoutCookie, Origin: WEB };
    discordCalls.length = 0;
    await http().post('/auth/logout').set({ Cookie: logoutCookie }).expect(403); // CSRF applies here too
    const sid = logoutCookie.split('=')[1];
    const sidHash = sha256Hex(sid);
    const redis = app.get(RedisService).client;
    const sessionKey = `sess:${sidHash}`;
    const userIndexKey = `usess:${USER_ID}`;
    expect(await redis.exists(sessionKey)).toBe(1);
    expect(await redis.sismember(userIndexKey, sidHash)).toBe(1);
    expect(Math.abs((await redis.ttl(userIndexKey)) - (await redis.ttl(sessionKey)))).toBeLessThanOrEqual(1);
    await redis.set(`ug:${USER_ID}`, 'cached-user-data', 'EX', 60);

    const logout = await http().post('/auth/logout').set(logoutAuth).expect(204);
    expect((logout.headers['set-cookie'] as unknown as string[]).some((c) => /^dbx_li=;/.test(c) && /Expires=/i.test(c))).toBe(true);
    expect(await redis.exists(sessionKey)).toBe(0);
    expect(await redis.sismember(userIndexKey, sidHash)).toBe(0);
    expect(await redis.exists(`ug:${USER_ID}`)).toBe(0);
    const secondLogout = await http().post('/auth/logout').set(logoutAuth).expect(204);
    expect((secondLogout.headers['set-cookie'] as unknown as string[]).some((c) => /^dexbotx_sid=;/.test(c) && /Expires=/i.test(c))).toBe(true);
    await http().get('/auth/me').set({ Cookie: logoutCookie }).expect(401);
    await new Promise((r) => setTimeout(r, 100));
    expect(discordCalls.some((c) => c.path === '/oauth2/token/revoke')).toBe(true);
  });
});

describe('Guild onboarding', () => {
  it('skips startup guilds and sends once to the channel and a single inviter DM', async () => {
    const bot = botModule.get(BotService);
    const sync = botModule.get(GuildSyncService);
    const startupGuild = onboardingGuild(
      '111111111111111110',
      [onboardingChannel('555555555555555510', 'general', 0)],
    );
    const onboardingGuildId = '111111111111111119';
    const channelId = '555555555555555519';
    const ownerId = '888888888888888880';
    const channel = onboardingChannel(channelId, 'general', 0);
    const guild = onboardingGuild(onboardingGuildId, [channel], channel);
    const redis = botModule.get(RedisService).client;
    const upsert = jest.spyOn(sync, 'upsert')
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const syncGuild = jest.spyOn(sync, 'syncGuild').mockResolvedValue({} as never);
    const ready = jest.spyOn(bot.client, 'isReady').mockReturnValue(false);

    onboardingMessages.length = 0;
    dmRecipients.length = 0;
    failMessagePost = false;
    messagePostFailures = 0;
    try {
      await bot.onGuildCreate(startupGuild);
      expect(onboardingMessages).toHaveLength(0);
      expect(dmRecipients).toHaveLength(0);

      ready.mockReturnValue(true);
      await redis.set(`inviter:${onboardingGuildId}`, ownerId, 'EX', 600, 'NX');
      Object.assign(guild, { ownerId });
      await bot.onGuildCreate(guild);
      Object.assign(guild, { joinedTimestamp: Date.now() - 3 * 60 * 1000 });
      await bot.onGuildCreate(guild);

      expect(onboardingMessages).toHaveLength(2);
      const channelMessage = onboardingMessages.find((message) => message.channelId === channelId);
      expect(channelMessage?.body.allowed_mentions).toEqual({ parse: [], users: [ownerId] });
      const channelEmbed = (channelMessage?.body.embeds as Array<{ title: string; description: string }>)[0];
      expect(channelEmbed.title).toBe(`👋 Thanks for adding DexBotX to Guild ${onboardingGuildId}!`);
      expect(channelEmbed.description).toContain(`Hi <@${ownerId}>!`);
      expect(channelEmbed.description).toContain('Move my role up (required for moderation)');
      expect(channelEmbed.description).toContain('Discord places my role at the bottom of the role list');
      expect(channelEmbed.description).toContain('Keep it below your Admin/Owner roles');
      expect(channelEmbed.description).toContain('server owners can never be timed out, kicked, or banned');
      expect(channelEmbed.description).toContain('https://dexbotx.vercel.app/dashboard');
      expect(dmRecipients).toEqual([ownerId]);
      const dmMessage = onboardingMessages.find((message) => message.channelId === `dm-${ownerId}`);
      expect(dmMessage).toBeTruthy();
      expect(dmMessage?.body.allowed_mentions).toEqual({ parse: [], users: [] });
      const dmEmbed = (dmMessage?.body.embeds as Array<{ description: string }>)[0];
      expect(dmEmbed.description).toContain(`I also posted a short hello in <#${channelId}>`);
      expect(dmEmbed.description).toContain('Move my role up (required for moderation)');
      expect(dmEmbed.description).toContain('https://dexbotx.vercel.app/dashboard');
      expect(dmEmbed.description).not.toContain(`<@${ownerId}>`);
      expect(await redis.exists(`onboard:${onboardingGuildId}`)).toBe(1);

      const noChannelGuildId = '111111111111111116';
      const privateChannelId = '555555555555555516';
      const privateChannel = onboardingChannel(privateChannelId, 'general', 0, false);
      const noChannelGuild = onboardingGuild(noChannelGuildId, [privateChannel], privateChannel);
      upsert.mockResolvedValueOnce(true);
      await bot.onGuildCreate(noChannelGuild);
      expect(dmRecipients).toEqual([ownerId, noChannelGuild.ownerId]);
      expect(onboardingMessages.some((message) => message.channelId === privateChannelId)).toBe(false);
      const noChannelDm = onboardingMessages.find((message) => message.channelId === `dm-${noChannelGuild.ownerId}`);
      const noChannelEmbed = (noChannelDm?.body.embeds as Array<{ description: string }>)[0];
      expect(noChannelEmbed.description).not.toContain('I also posted a short hello');
    } finally {
      ready.mockRestore();
      upsert.mockRestore();
      syncGuild.mockRestore();
    }
  });

  it('prefers the system channel and never chooses a channel hidden from everyone', () => {
    const system = onboardingChannel('system', 'rules', 10);
    const general = onboardingChannel('general', 'general', 0);
    const guild = onboardingGuild('guild', [system, general], system);
    const me = { id: 'bot' } as GuildMember;

    expect(findOnboardingChannel(guild, me)?.id).toBe('system');

    const privateSystem = onboardingChannel('private-system', 'system', 0, false);
    const privateGeneral = onboardingChannel('private-general', 'general', 1, false);
    const publicLobby = onboardingChannel('public-lobby', 'lobby', 2);
    const noPublicSystem = onboardingGuild('guild', [privateGeneral, publicLobby], privateSystem);
    expect(findOnboardingChannel(noPublicSystem, me)?.id).toBe('public-lobby');

    const noNamedPublic = onboardingGuild(
      'guild',
      [onboardingChannel('private', 'general', 0, false), onboardingChannel('first', 'off-topic', 2), onboardingChannel('second', 'support', 1)],
    );
    expect(findOnboardingChannel(noNamedPublic, me)?.id).toBe('second');
  });

  it('keeps channel and DM sends independent and omits unknown inviter mentions', async () => {
    const onboarding = botModule.get(OnboardingService);
    onboardingMessages.length = 0;
    dmRecipients.length = 0;
    failOnboardingDm = true;
    try {
      const closedDm = await onboarding.sendOnce(
        '111111111111111118',
        'Closed DM',
        '555555555555555518',
        '777777777777777718',
        '777777777777777718',
      );
      expect(closedDm).toEqual({ channel: 'sent', dm: 'dm-closed' });
      expect(onboardingMessages).toHaveLength(1);
      expect(onboardingMessages[0].body.allowed_mentions).toEqual({ parse: [], users: ['777777777777777718'] });
    } finally {
      failOnboardingDm = false;
    }

    const noChannel = await onboarding.sendOnce('111111111111111117', 'No Channel', undefined, undefined, '777777777777777717');
    expect(noChannel).toEqual({ channel: 'skipped', dm: 'sent' });
    expect(dmRecipients).toEqual(['777777777777777717']);
    const dm = onboardingMessages.find((message) => message.channelId === 'dm-777777777777777717');
    const channelMessage = onboardingMessages.find((message) => message.channelId === '555555555555555518');
    const channelEmbed = (channelMessage?.body.embeds as Array<{ description: string }>)[0];
    expect(channelEmbed.description).toContain('Hi <@777777777777777718>!');
    const dmEmbed = (dm?.body.embeds as Array<{ description: string }>)[0];
    expect(dmEmbed.description).toContain('Hi! You (or someone in No Channel) just added DexBotX.');
    expect(dmEmbed.description).not.toContain('<@');
  });
});

describe('Bot → queue → worker', () => {
  function fakeMember(opts: { hasPerms?: boolean; hasManageRoles?: boolean; bot?: boolean; channelInCache?: boolean; userId?: string } = {}) {
    const channel = {
      id: C1,
      name: 'welcome',
      type: ChannelType.GuildText,
      permissionsFor: () => ({ has: () => opts.hasPerms !== false }),
    };
    const guild = {
      id: G1,
      name: 'Alpha Guild',
      memberCount: 121,
      channels: { cache: new Map(opts.channelInCache === false ? [] : [[C1, channel]]) },
      members: {
        me: {
          id: 'bot',
          permissions: { has: (permission: bigint) => permission === PermissionFlagsBits.ManageRoles && opts.hasManageRoles === true },
        },
        fetchMe: async () => ({
          id: 'bot',
          permissions: { has: (permission: bigint) => permission === PermissionFlagsBits.ManageRoles && opts.hasManageRoles === true },
        }),
      },
      bannerURL: () => null,
    };
    return {
      guild,
      displayName: 'Newbie',
      user: {
        id: opts.userId ?? '888888888888888888',
        username: 'newbie',
        globalName: 'Newbie',
        bot: opts.bot ?? false,
        displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/1.png',
      },
    };
  }

  const handle = (kind: 'welcome' | 'goodbye', member: unknown) =>
    (botModule.get(BotService) as unknown as {
      handleMember: (event: 'welcome' | 'goodbye', guildMember: GuildMember) => Promise<void>;
    }).handleMember(kind, member as GuildMember);
  const queue = () => botModule.get(MemberEventsQueue).queue;
  const totalJobs = async () => Object.values(await queue().getJobCounts()).reduce((a, b) => a + b, 0);
  const waitFor = async <T>(fn: () => Promise<T | undefined | false>, ms = 15000): Promise<T> => {
    const end = Date.now() + ms;
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() > end) throw new Error('waitFor timed out');
      await new Promise((r) => setTimeout(r, 50));
    }
  };

  it('skips all member-event posts while maintenance mode is enabled', async () => {
    const redis = botModule.get(RedisService).client;
    await redis.hset('flags', { maintenance: 'true' });
    await handle('welcome', fakeMember({ userId: '888333888333888333' }));
    expect(await totalJobs()).toBe(0);
    await redis.hset('flags', { maintenance: 'false' });
  });

  it('queues nothing when the feature is disabled, the member is a bot, permissions are missing or the channel is foreign', async () => {
    await handle('goodbye', fakeMember()); // goodbye is disabled by default
    await handle('welcome', fakeMember({ bot: true }));
    await handle('welcome', fakeMember({ hasPerms: false }));
    await handle('welcome', fakeMember({ channelInCache: false }));
    expect(await totalJobs()).toBe(0);
  });

  it('queues an event with missing channel permissions when the bot can manage roles', async () => {
    await handle('welcome', fakeMember({ hasPerms: false, hasManageRoles: true, userId: '888111888111888111' }));
    const jobs = await queue().getJobs(['waiting']);
    const job = jobs.find((queued) => queued.data.user.id === '888111888111888111');
    expect(job).toBeTruthy();
    await job?.remove();
  });

  it('hands a compact job to the queue instead of rendering in the shard', async () => {
    await handle('welcome', fakeMember());
    await handle('welcome', fakeMember()); // duplicate gateway delivery is deduplicated
    const jobs = await queue().getJobs(['waiting']);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data).toEqual({
      kind: 'welcome',
      guildId: G1,
      channelId: C1,
      user: { id: '888888888888888888', username: 'newbie', displayName: 'Newbie', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png' },
      guild: { name: 'Alpha Guild', memberCount: 121, bannerUrl: null },
    });
  });

  describe('Moderation commands', () => {
    const moderatorId = '777777777777777777';
    const targetId = '888888888888888888';
    const botId = '123456789012345678';
    const ownerId = '666666666666666666';

    function fakeKickInteraction(guildId: string, targetPosition = 2) {
      const makeRole = (position: number) => ({
        position,
        comparePositionTo: (other: { position: number }) => position - other.position,
      });
      const moderator = {
        id: moderatorId,
        user: { id: moderatorId, tag: 'Moderator#0001' },
        permissions: { has: () => true },
        roles: { highest: makeRole(4) },
      } as unknown as GuildMember;
      const targetUser = {
        id: targetId,
        tag: 'Target#0001',
        bot: false,
        send: jest.fn().mockResolvedValue(undefined),
      };
      const target = {
        id: targetId,
        user: targetUser,
        roles: { highest: makeRole(targetPosition) },
        kickable: true,
      } as unknown as GuildMember;
      const bot = {
        id: botId,
        permissions: { has: () => true },
        roles: { highest: makeRole(6) },
      } as unknown as GuildMember;
      const kick = jest.fn().mockResolvedValue(undefined);
      const guild = {
        id: guildId,
        name: 'Test Guild',
        ownerId,
        client: { user: { id: botId } },
        members: {
          me: bot,
          fetch: jest.fn(async (id: string) => id === moderatorId ? moderator : target),
          kick,
        },
      } as unknown as Guild;
      const interaction = {
        commandName: 'kick',
        guild,
        guildId,
        user: moderator.user,
        options: {
          getUser: () => targetUser,
          getMember: () => target,
          getString: (name: string) => name === 'reason' ? 'typed reason' : null,
        },
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        reply: jest.fn().mockResolvedValue(undefined),
        deferred: true,
        replied: false,
      } as unknown as ChatInputCommandInteraction;

      return { interaction, kick, targetUser };
    }

    it('executes /kick through the fake Discord member stub and stores its audit row', async () => {
      const guildId = '555555555555555555';
      const fake = fakeKickInteraction(guildId);
      await botModule.get(ModerationService).handle(fake.interaction);

      expect(fake.kick).toHaveBeenCalledWith(targetId, 'Moderator#0001 (777777777777777777): typed reason');
      expect(fake.targetUser.send).toHaveBeenCalledWith(expect.objectContaining({
        content: 'You were kicked from Test Guild. Reason: typed reason',
        allowedMentions: { parse: [] },
      }));
      expect(fake.interaction.editReply).toHaveBeenCalledWith({
        content: '✅ Kicked Target#0001',
        allowedMentions: { parse: [] },
      });
      const rows = await app.get(DatabaseService).db.select().from(modActions).where(eq(modActions.guildId, guildId));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        moderatorId,
        targetId,
        action: 'kick',
        reason: 'typed reason',
        durationSeconds: null,
      });
    });

    it('rejects /kick when the target outranks the moderator', async () => {
      const fake = fakeKickInteraction('555555555555555556', 5);
      await botModule.get(ModerationService).handle(fake.interaction);

      expect(fake.kick).not.toHaveBeenCalled();
      expect(fake.interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
        content: 'You can’t moderate them: their role is equal to or above yours.',
      }));
    });

    it('rate limits /kick after 20 actions per moderator in one minute', async () => {
      const guildId = '555555555555555557';
      const redis = botModule.get(RedisService).client;
      await redis.del(`moderation:${guildId}:${moderatorId}`);
      try {
        const service = botModule.get(ModerationService);
        const interactions = Array.from({ length: 21 }, () => fakeKickInteraction(guildId));
        for (const fake of interactions) await service.handle(fake.interaction);

        expect(interactions.slice(0, 20).every(({ kick }) => kick.mock.calls.length === 1)).toBe(true);
        expect(interactions[20].kick).not.toHaveBeenCalled();
        expect(interactions[20].interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
          content: expect.stringMatching(/^Slow down: try again in \d+s$/),
        }));
      } finally {
        await redis.del(`moderation:${guildId}:${moderatorId}`);
      }
    });
  });

  it('worker renders the card and posts it with restricted mentions', async () => {
    discordCalls.length = 0;
    await workerModule.init(); // starts the BullMQ worker, which picks up the waiting job
    const post = await waitFor(async () => discordCalls.find((c) => c.method === 'POST' && c.path === `/channels/${C1}/messages`));
    const form = post.init.body as FormData;
    const payload = JSON.parse(String(form.get('payload_json')));
    expect(payload.content).toBe('Updated text <@888888888888888888>');
    expect(payload.embeds[0].title).toBe('Hello Newbie');
    expect(payload.embeds[0].description).toBe('Member 121st');
    expect(payload.allowed_mentions).toEqual({ parse: [], users: ['888888888888888888'] });
    const file = form.get('files[0]') as Blob;
    expect(Buffer.from(await file.arrayBuffer()).subarray(0, 4).toString('hex')).toBe('89504e47');
    const done = await waitFor(async () => (await queue().getJobs(['completed']))[0]);
    expect(done.returnvalue).toBe('sent');
  });

  it('worker repairs denied channel access and retries the post once', async () => {
    const redis = botModule.get(RedisService).client;
    await redis.del(`permfix:${G1}:${C1}`);
    stubGuildRoles = [];
    stubBotRoleIds = [];
    failMessagePost = false;
    messagePostFailures = 1;
    discordCalls.length = 0;
    await botModule.get(MemberEventsQueue).enqueue({
      kind: 'welcome',
      guildId: G1,
      channelId: C1,
      user: { id: '888222888222888222', username: 'newbie', displayName: 'Newbie', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png' },
      guild: { name: 'Alpha Guild', memberCount: 121, bannerUrl: null },
    });

    const job = await waitFor(async () => {
      const completed = await queue().getJobs(['completed']);
      return completed.find((queued) => queued.data.user.id === '888222888222888222');
    });
    expect(job.returnvalue).toBe('sent');
    expect(discordCalls.filter((call) => call.method === 'POST' && call.path === `/channels/${C1}/messages`)).toHaveLength(2);
    expect(discordCalls.some((call) => call.method === 'POST' && call.path === `/guilds/${G1}/roles`)).toBe(true);
    expect(discordCalls.some((call) => call.method === 'PUT' && call.path === `/channels/${C1}/permissions/444444444444444444`)).toBe(true);
    await redis.del(`permfix:${G1}:${C1}`);
  });

  it('worker re-checks the latest settings, so a disabled feature is skipped', async () => {
    const q = botModule.get(MemberEventsQueue);
    await q.enqueue({
      kind: 'goodbye',
      guildId: G1,
      channelId: C1,
      user: { id: '999000999000999000', username: 'leaver', displayName: 'Leaver', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/2.png' },
      guild: { name: 'Alpha Guild', memberCount: 120, bannerUrl: null },
    });
    const job = await waitFor(async () => {
      const done = await queue().getJobs(['completed']);
      return done.find((j) => j.data.kind === 'goodbye');
    });
    expect(job.returnvalue).toBe('skipped-disabled');
  });

  it('does not retry when Discord refuses the post (missing permissions)', async () => {
    await botModule.get(RedisService).client.del(`permfix:${G1}:${C1}`);
    failMessagePost = true;
    await handle('welcome', fakeMember({ userId: '888000888000888000' }));
    const job = await waitFor(async () => (await queue().getJobs(['failed'])).find((j) => j.data.user.id === '888000888000888000'));
    failMessagePost = false;
    expect(job.attemptsMade).toBe(1); // unrecoverable: moved to failed immediately, no 5x retry storm
    expect(job.failedReason).toContain('Discord refused the post (403');
  });

  it('keeps the named API, shard and worker Redis clients below the connection budget', async () => {
    await workerModule.init();
    const apiRedis = app.get(RedisService);
    expect(await apiRedis.connectedClients()).toBeLessThanOrEqual(10);
    const clientList = await apiRedis.client.call('CLIENT', 'LIST') as string;
    for (const name of ['api:main', 'api:sub', 'shard0:main', 'shard0:sub', 'worker:main', 'worker:sub']) {
      expect(clientList).toContain(`name=${name}`);
    }
    expect(clientList.split(/\r?\n/).filter(Boolean).every((client) => client.includes(' name='))).toBe(true);
  });
});
