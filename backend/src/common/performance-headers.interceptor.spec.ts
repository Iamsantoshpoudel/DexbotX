import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { lastValueFrom, of } from 'rxjs';
import { PerformanceHeadersInterceptor } from './performance-headers.interceptor';

describe('PerformanceHeadersInterceptor', () => {
  function run(options: { method?: string; ifNoneMatch?: string; cacheControl?: string } = {}) {
    const headers = new Map<string, string>();
    if (options.cacheControl) headers.set('Cache-Control', options.cacheControl);
    const request = {
      method: options.method ?? 'GET',
      get: (name: string) => name === 'if-none-match' ? options.ifNoneMatch : undefined,
    } as unknown as Request;
    const response = {
      headersSent: false,
      getHeader: (name: string) => headers.get(name),
      setHeader: (name: string, value: string) => headers.set(name, value),
      status: jest.fn(function (this: Response) { return this; }),
      end: jest.fn(),
    } as unknown as Response;
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ExecutionContext;
    const body = { result: 'ok' };
    const next = { handle: () => of(body) } as CallHandler;
    const interceptor = new PerformanceHeadersInterceptor();
    return { headers, response, body, result: lastValueFrom(interceptor.intercept(context, next)) };
  }

  it('adds a private revalidation policy and ETag to JSON GETs', async () => {
    const { headers, body, result } = run();

    await expect(result).resolves.toEqual(body);
    expect(headers.get('Cache-Control')).toBe('private, no-cache');
    expect(headers.get('ETag')).toMatch(/^W\/".+"$/);
  });

  it('returns 304 when the request ETag matches', async () => {
    const initial = run();
    await initial.result;
    const etag = initial.headers.get('ETag')!;
    const revalidated = run({ ifNoneMatch: etag });

    await expect(revalidated.result).resolves.toBeUndefined();
    expect(revalidated.response.status).toHaveBeenCalledWith(304);
    expect(revalidated.response.end).not.toHaveBeenCalled();
  });

  it('preserves explicit public caching and leaves non-GET responses alone', async () => {
    const publicResponse = run({ cacheControl: 'public, max-age=3600' });
    await publicResponse.result;
    expect(publicResponse.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(publicResponse.headers.has('ETag')).toBe(true);

    const mutation = run({ method: 'POST' });
    await mutation.result;
    expect(mutation.headers.has('Cache-Control')).toBe(false);
    expect(mutation.headers.has('ETag')).toBe(false);
  });

  it('does not add validators to explicitly non-cacheable responses', async () => {
    const response = run({ cacheControl: 'private, no-store' });

    await response.result;
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.has('ETag')).toBe(false);
  });
});
