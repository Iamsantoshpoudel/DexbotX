import { loadConfig } from './config';

const valid = {
  NODE_ENV: 'production',
  WEB_URL: 'https://dexbotx.vercel.app/',
  WS_PUBLIC_URL: 'wss://dexbotx-zq8g.onrender.com/ws',
  DATABASE_URL: 'postgres://u:p@db.example.com:5432/postgres',
  REDIS_URL: 'redis://localhost:6379',
  DISCORD_CLIENT_ID: '123456789012345678',
  DISCORD_CLIENT_SECRET: 'x'.repeat(32),
  DISCORD_BOT_TOKEN: 'y'.repeat(60),
  SESSION_ENCRYPTION_KEY: 'ab'.repeat(32),
};

describe('loadConfig', () => {
  it('derives origin, redirect URI and secure defaults', () => {
    const c = loadConfig(valid as NodeJS.ProcessEnv);
    expect(c.webOrigin).toBe('https://dexbotx.vercel.app');
    expect(c.redirectUri).toBe('https://dexbotx.vercel.app/api/auth/callback');
    expect(c.wsPublicUrl).toBe('wss://dexbotx-zq8g.onrender.com/ws');
    expect(c.cookieSecure).toBe(true);
    expect(c.databaseSsl).toBe(true);
    expect(c.shardCount).toBe(1);
    expect(c.botPermissions).toBe('268487680');
    expect(c.adminUserIds).toEqual([]);
    expect(c.sessionKey).toHaveLength(32);
  });

  it('parses configured admin Discord IDs', () => {
    const c = loadConfig({ ...valid, ADMIN_USER_IDS: '123456789012345678, 987654321098765432' } as NodeJS.ProcessEnv);
    expect(c.adminUserIds).toEqual(['123456789012345678', '987654321098765432']);
    expect(() => loadConfig({ ...valid, ADMIN_USER_IDS: 'not-a-discord-id' } as NodeJS.ProcessEnv)).toThrow(/ADMIN_USER_IDS/);
  });

  it('accepts a configured shard count', () => {
    expect(loadConfig({ ...valid, SHARD_COUNT: '3' } as NodeJS.ProcessEnv).shardCount).toBe(3);
    expect(() => loadConfig({ ...valid, SHARD_COUNT: 'auto' } as NodeJS.ProcessEnv)).toThrow(/SHARD_COUNT/);
  });

  it('fails fast with readable errors', () => {
    expect(() => loadConfig({ ...valid, SESSION_ENCRYPTION_KEY: 'short' } as NodeJS.ProcessEnv)).toThrow(/SESSION_ENCRYPTION_KEY/);
    expect(() => loadConfig({ ...valid, DISCORD_CLIENT_ID: 'abc' } as NodeJS.ProcessEnv)).toThrow(/DISCORD_CLIENT_ID/);
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(/Invalid environment configuration/);
  });

  it('rejects insecure or localhost dashboard URLs in production', () => {
    expect(() => loadConfig({ ...valid, WEB_URL: 'http://dexbotx.vercel.app' } as NodeJS.ProcessEnv)).toThrow(/WEB_URL/);
    expect(() => loadConfig({ ...valid, WEB_URL: 'http://localhost:3000' } as NodeJS.ProcessEnv)).toThrow(/WEB_URL/);
    expect(() => loadConfig({ ...valid, WS_PUBLIC_URL: 'ws://dexbotx-zq8g.onrender.com/ws' } as NodeJS.ProcessEnv)).toThrow(/WS_PUBLIC_URL/);
  });
});
