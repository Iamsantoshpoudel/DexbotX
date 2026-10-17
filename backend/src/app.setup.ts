import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { AppConfig } from './core/config';

/** HTTP hardening shared by the real server (main.ts) and the integration tests. */
export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '32kb' });
  app.enableCors({
    origin: config.webOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    maxAge: 600,
  });
}
