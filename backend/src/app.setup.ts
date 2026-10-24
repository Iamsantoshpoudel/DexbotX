import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { WsAdapter } from '@nestjs/platform-ws';
import onHeaders from 'on-headers';
import { PerformanceHeadersInterceptor } from './common/performance-headers.interceptor';
import type { AppConfig } from './core/config';

/** HTTP hardening shared by the real server (main.ts) and the integration tests. */
export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  app.useWebSocketAdapter(new WsAdapter(app));
  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.use((_req: Request, res: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();
    onHeaders(res, function () {
      const duration = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      this.setHeader('Server-Timing', `app;dur=${duration.toFixed(1)}`);
    });
    next();
  });
  app.useGlobalInterceptors(new PerformanceHeadersInterceptor());
  app.useBodyParser('json', { limit: '32kb' });
  app.enableCors({
    origin: config.webOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    maxAge: 600,
  });
}
