import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('API route proxy security header', () => {
  const request = (headers?: HeadersInit) => new NextRequest('https://dexbotx.vercel.app/api/health', { headers });
  const context = { params: Promise.resolve({ path: ['health'] }) };

  it('adds and overrides the backend secret in production', async () => {
    const secret = 's'.repeat(32);
    let forwardedHeaders: Headers | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      forwardedHeaders = new Headers(init?.headers);
      return new Response('ok');
    });
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BACKEND_URL', 'https://backend.example.com');
    vi.stubEnv('BACKEND_PROXY_SECRET', secret);
    vi.stubGlobal('fetch', fetchMock);

    await GET(request({ 'x-dexbotx-proxy-secret': 'client-supplied' }), context);

    expect(forwardedHeaders?.get('x-dexbotx-proxy-secret')).toBe(secret);
  });

  it('fails explicitly when the production secret is not configured', async () => {
    const fetchMock = vi.fn();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BACKEND_URL', 'https://backend.example.com');
    vi.stubEnv('BACKEND_PROXY_SECRET', '');
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(request(), context);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ message: 'API proxy is not configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not forward a client-supplied proxy secret in development', async () => {
    let forwardedHeaders: Headers | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      forwardedHeaders = new Headers(init?.headers);
      return new Response('ok');
    });
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('BACKEND_URL', 'http://localhost:4000');
    vi.stubGlobal('fetch', fetchMock);

    await GET(request({ 'x-dexbotx-proxy-secret': 'client-supplied' }), context);

    expect(forwardedHeaders?.has('x-dexbotx-proxy-secret')).toBe(false);
  });
});
