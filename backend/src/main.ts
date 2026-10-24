import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as Sentry from '@sentry/node';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { APP_CONFIG, AppConfig } from './core/config';

async function bootstrap() {
  process.env.DEXBOTX_PROCESS_ROLE = 'api';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get<AppConfig>(APP_CONFIG);

  if (config.sentryDsn) {
    Sentry.init({ dsn: config.sentryDsn, environment: config.nodeEnv, tracesSampleRate: 0.05 });
  }

  app.useLogger(app.get(Logger));
  configureApp(app, config);
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  app.get(Logger).log(`DexBotX API listening on :${config.port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
