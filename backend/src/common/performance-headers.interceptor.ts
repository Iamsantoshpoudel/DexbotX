import { createHash } from 'node:crypto';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function isJsonResponseBody(body: unknown): body is object {
  return body !== null && typeof body === 'object' && !Buffer.isBuffer(body);
}

@Injectable()
export class PerformanceHeadersInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((body) => {
        if (request.method !== 'GET' || !isJsonResponseBody(body)) return body;

        const cacheControl = response.getHeader('Cache-Control');
        if (typeof cacheControl === 'string' && cacheControl.includes('no-store')) return body;
        if (cacheControl === undefined) response.setHeader('Cache-Control', 'private, no-cache');

        const serialized = JSON.stringify(body);
        if (serialized === undefined) return body;
        const etag = `W/"${createHash('sha1').update(serialized).digest('base64url')}"`;
        response.setHeader('ETag', etag);

        const requestTag = request.get('if-none-match');
        if (requestTag && requestTag.split(',').some((candidate) => candidate.trim() === '*' || candidate.trim() === etag)) {
          response.status(304);
          return undefined;
        }
        return body;
      }),
    );
  }
}
