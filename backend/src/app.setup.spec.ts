import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { loadConfig } from './core/config';
import { configureApp, hasValidBackendProxySecret } from './app.setup';

@Controller()
class ProbeController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('hasValidBackendProxySecret', () => {
  const secret = 'a'.repeat(32);

  it('accepts only an exact configured secret', () => {
    expect(hasValidBackendProxySecret(secret, secret)).toBe(true);
    expect(hasValidBackendProxySecret('b'.repeat(32), secret)).toBe(false);
    expect(hasValidBackendProxySecret(`${secret}x`, secret)).toBe(false);
    expect(hasValidBackendProxySecret(undefined, secret)).toBe(false);
    expect(hasValidBackendProxySecret(secret, undefined)).toBe(false);
  });
});

describe('configureApp production API guard', () => {
  let app: NestExpressApplication;
  const secret = 'production-proxy-secret-'.padEnd(32, 'x');

  beforeAll(async () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      WEB_URL: 'https://dexbotx.vercel.app',
      WS_PUBLIC_URL: 'wss://api.dexbotx.test/ws',
      DATABASE_URL: 'postgres://user:password@localhost:5432/dexbotx',
      REDIS_URL: 'redis://localhost:6379',
      DISCORD_CLIENT_ID: '123456789012345678',
      DISCORD_CLIENT_SECRET: 'client-secret-value',
      DISCORD_BOT_TOKEN: 'bot-token-value-that-is-long-enough',
      SESSION_ENCRYPTION_KEY: 'ab'.repeat(32),
      BACKEND_PROXY_SECRET: secret,
    });

    app = await NestFactory.create<NestExpressApplication>(ProbeModule, { logger: false });
    configureApp(app, config);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects requests without the proxy secret', async () => {
    await request(app.getHttpServer()).get('/health').expect(403);
  });

  it('rejects requests with an incorrect proxy secret', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .set('x-dexbotx-proxy-secret', 'wrong-secret')
      .expect(403);
  });

  it('allows requests with the configured proxy secret', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .set('x-dexbotx-proxy-secret', secret)
      .expect(200, { status: 'ok' });
  });

  it('allows CORS only for the configured production origin', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://dexbotx.vercel.app')
      .set('x-dexbotx-proxy-secret', secret)
      .expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('https://dexbotx.vercel.app');

    const disallowed = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://attacker.example')
      .set('x-dexbotx-proxy-secret', secret)
      .expect(200);
    expect(disallowed.headers['access-control-allow-origin']).toBe('https://dexbotx.vercel.app');
    expect(disallowed.headers['access-control-allow-origin']).not.toBe('https://attacker.example');
  });
});
