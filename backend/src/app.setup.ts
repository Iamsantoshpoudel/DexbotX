import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { WsAdapter } from '@nestjs/platform-ws';
import onHeaders from 'on-headers';
import { PerformanceHeadersInterceptor } from './common/performance-headers.interceptor';
import type { AppConfig } from './core/config';

export const BACKEND_PROXY_SECRET_HEADER = 'x-dexbotx-proxy-secret';

export function hasValidBackendProxySecret(received: string | undefined, expected: string | undefined): boolean {
  if (!received || !expected) return false;
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
}

/** HTTP hardening shared by the real server (main.ts) and the integration tests. */
export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  app.useWebSocketAdapter(new WsAdapter(app));
  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  if (config.isProd) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'GET' && (req.path === '/health' || req.path === '/health/ready')) {
        return next();
      }
      if (!hasValidBackendProxySecret(req.get(BACKEND_PROXY_SECRET_HEADER), config.backendProxySecret)) {
        return res.status(403).json({ statusCode: 403, message: 'Forbidden' });
      }
      next();
    });
  }
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
