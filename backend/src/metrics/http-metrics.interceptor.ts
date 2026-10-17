import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { MetricsService } from './metrics.service';

/** Records latency per route TEMPLATE (never the raw URL), so label cardinality stays bounded. */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const stop = this.metrics.httpDuration.startTimer();
    res.once('finish', () => stop({ method: req.method, route: req.route?.path ?? 'unmatched', status: String(res.statusCode) }));
    return next.handle();
  }
}
