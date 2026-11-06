import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, GET, OPTIONS, PATCH, POST, PUT } from './route';

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

describe('API route proxy methods and redirects', () => {
  const methods = [
    ['GET', GET],
    ['POST', POST],
    ['PUT', PUT],
    ['PATCH', PATCH],
    ['DELETE', DELETE],
    ['OPTIONS', OPTIONS],
  ] as const;

  it.each(methods)('%s requests reach the route handler and backend', async (method, handler) => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Response(init?.method));
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('BACKEND_URL', 'https://backend.example.com');
    vi.stubGlobal('fetch', fetchMock);
    const path = ['method-check'];
    const request = new NextRequest('https://dexbotx.vercel.app/api/method-check', {
      method,
      ...(method === 'GET' ? {} : { body: 'payload' }),
    });

    await handler(request, { params: Promise.resolve({ path }) });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [target, init] = fetchMock.mock.calls[0];
    expect(String(target)).toBe('https://backend.example.com/method-check');
    expect(init?.method).toBe(method);
    expect(init?.redirect).toBe('manual');
  });

  it('passes through the OAuth login redirect to Discord', async () => {
    const location = 'https://discord.com/oauth2/authorize?client_id=client&state=state';
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(null, { status: 302, headers: { location } }));
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('BACKEND_URL', 'https://backend.example.com');
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      new NextRequest('https://dexbotx.vercel.app/api/auth/login'),
      { params: Promise.resolve({ path: ['auth', 'login'] }) },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(location);
    const [target, init] = fetchMock.mock.calls[0];
    expect(String(target)).toBe('https://backend.example.com/auth/login');
    expect(init?.redirect).toBe('manual');
  });

  it('passes through the OAuth callback redirect to the dashboard with cookies', async () => {
    const location = 'https://dexbotx.vercel.app/?error=login_failed';
    const setCookie = 'dexbotx_oauth=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax';
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, {
      status: 302,
      headers: { location, 'set-cookie': setCookie },
    }));
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('BACKEND_URL', 'https://backend.example.com');
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      new NextRequest('https://dexbotx.vercel.app/api/auth/callback?error=access_denied'),
      { params: Promise.resolve({ path: ['auth', 'callback'] }) },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(location);
    expect(response.headers.get('set-cookie')).toBe(setCookie);
    const [target, init] = fetchMock.mock.calls[0];
    expect(String(target)).toBe('https://backend.example.com/auth/callback?error=access_denied');
    expect(init?.redirect).toBe('manual');
  });
});
