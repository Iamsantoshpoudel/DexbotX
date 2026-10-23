import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { createCanvas } from '@napi-rs/canvas';
import { ChannelType, type GuildMember } from 'discord.js';
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
import { auditLogs, guildChannels, guildRoles, guilds } from '../src/db/schema';
import { SettingsCache } from '../src/redis/settings-cache.service';
import { RedisService } from '../src/redis/redis.service';
import { MemberEventsQueue } from '../src/queue/member-events.queue';
import { WorkerModule } from '../src/worker/worker.module';
import { APP_CONFIG } from '../src/core/config';
import { SessionService } from '../src/auth/session.service';
import { WelcomeService } from '../src/welcome/welcome.service';

const PG_PORT = 54329;
const REDIS_PORT = 63799;
const WEB = 'http://localhost:3000';
const G1 = '111111111111111111'; // bot installed, user can manage
const G2 = '222222222222222222'; // bot installed, user has no permission
const G3 = '333333333333333333'; // user can manage, bot not installed
const C1 = '555555555555555551';
const C_OTHER_GUILD = '999999999999999999';
const USER_ID = '777777777777777777';

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
let failMessagePost = false;

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
        return json([
          { id: '555555555555555550', type: 4, name: 'Info', position: 0, parent_id: null },
          { id: C1, type: 0, name: 'welcome', position: 1, parent_id: '555555555555555550' },
          { id: '555555555555555552', type: 2, name: 'voice', position: 2, parent_id: null },
          { id: '555555555555555553', type: 5, name: 'news', position: 3, parent_id: null },
        ]);
      }
      if (path === `/channels/${C1}/messages`) {
        if (failMessagePost) return json({ code: 50013, message: 'Missing Permissions' }, 403);
        return json({ id: '1' });
      }
      return json({ message: 'not stubbed' }, 404);
    }
    if (url.startsWith(SUPA)) {
      const path = url.slice(SUPA.length);
      storageCalls.push({ method, path, body: init.body });
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
  botModule = await Test.createTestingModule({ imports: [BotModule] }).compile();
  await botModule.get(SettingsCache).onModuleInit();

  // --- Worker (consumes the queue). Created here, started inside the bot tests via init(). ---
  workerModule = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
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
  });

  it('serves presets publicly with cache headers', async () => {
    const res = await http().get('/templates/presets').expect(200);
    expect(res.headers['cache-control']).toContain('max-age=3600');
    expect(res.headers.etag).toBeTruthy();
    expect(res.headers['server-timing']).toMatch(/^app;dur=/);
    expect(res.body.presets.length).toBeGreaterThanOrEqual(10);
    await http().get('/templates/presets').set('If-None-Match', res.headers.etag).expect(304);
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
    expect(url.searchParams.get('permissions')).toBe('52224'); // never Administrator (8)
    expect(url.searchParams.has('guild_id')).toBe(false);
  });

  it('rejects anonymous access to protected routes', async () => {
    await http().get('/auth/me').expect(401);
    await http().get('/guilds').expect(401);
    await http().get(`/guilds/${G1}`).expect(401);
  });

  it('completes the Discord OAuth flow with a bound, single-use state', async () => {
    const login = await http().get('/auth/login?returnTo=/dashboard/123').expect(302);
    const location = new URL(login.headers.location);
    expect(location.origin + location.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(location.searchParams.get('scope')).toBe('identify guilds');
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

    // state is single-use
    const replay = await http().get(`/auth/callback?code=abc&state=${state}`).set('Cookie', stateCookie).expect(302);
    expect(replay.headers.location).toContain('error=login_failed');
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
    expect(res.body).toMatchObject({ id: USER_ID, username: 'tester', globalName: 'Test Er' });
    expect(res.body.avatarUrl).toContain('cdn.discordapp.com');
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
    expect(invite.searchParams.get('permissions')).toBe('52224');
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

  it('logs out, destroys the session and revokes the token', async () => {
    discordCalls.length = 0;
    await http().post('/auth/logout').set({ Cookie: sessionCookie }).expect(403); // CSRF applies here too
    await http().post('/auth/logout').set(authed()).expect(204);
    await http().get('/auth/me').set({ Cookie: sessionCookie }).expect(401);
    await new Promise((r) => setTimeout(r, 100));
    expect(discordCalls.some((c) => c.path === '/oauth2/token/revoke')).toBe(true);
  });
});

describe('Bot → queue → worker', () => {
  function fakeMember(opts: { hasPerms?: boolean; bot?: boolean; channelInCache?: boolean; userId?: string } = {}) {
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
      members: { me: { id: 'bot' }, fetchMe: async () => ({ id: 'bot' }) },
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

  it('queues nothing when the feature is disabled, the member is a bot, permissions are missing or the channel is foreign', async () => {
    await handle('goodbye', fakeMember()); // goodbye is disabled by default
    await handle('welcome', fakeMember({ bot: true }));
    await handle('welcome', fakeMember({ hasPerms: false }));
    await handle('welcome', fakeMember({ channelInCache: false }));
    expect(await totalJobs()).toBe(0);
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
    failMessagePost = true;
    await handle('welcome', fakeMember({ userId: '888000888000888000' }));
    const job = await waitFor(async () => (await queue().getJobs(['failed'])).find((j) => j.data.user.id === '888000888000888000'));
    failMessagePost = false;
    expect(job.attemptsMade).toBe(1); // unrecoverable: moved to failed immediately, no 5x retry storm
    expect(job.failedReason).toContain('Discord refused the post (403');
  });
});
