import { loadConfig } from './config';

const valid = {
  NODE_ENV: 'production',
  WEB_URL: 'https://dexbotx.vercel.app/',
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
    expect(c.cookieSecure).toBe(true);
    expect(c.databaseSsl).toBe(true);
    expect(c.shardCount).toBe('auto');
    expect(c.botPermissions).toBe('52224');
    expect(c.sessionKey).toHaveLength(32);
  });

  it('fails fast with readable errors', () => {
    expect(() => loadConfig({ ...valid, SESSION_ENCRYPTION_KEY: 'short' } as NodeJS.ProcessEnv)).toThrow(/SESSION_ENCRYPTION_KEY/);
    expect(() => loadConfig({ ...valid, DISCORD_CLIENT_ID: 'abc' } as NodeJS.ProcessEnv)).toThrow(/DISCORD_CLIENT_ID/);
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(/Invalid environment configuration/);
  });

  it('rejects insecure or localhost dashboard URLs in production', () => {
    expect(() => loadConfig({ ...valid, WEB_URL: 'http://dexbotx.vercel.app' } as NodeJS.ProcessEnv)).toThrow(/WEB_URL/);
    expect(() => loadConfig({ ...valid, WEB_URL: 'http://localhost:3000' } as NodeJS.ProcessEnv)).toThrow(/WEB_URL/);
  });
});
