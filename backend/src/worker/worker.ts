import 'dotenv/config';
import 'reflect-metadata';
import { createServer } from 'node:http';
import { NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { Logger } from 'nestjs-pino';
import { APP_CONFIG, AppConfig } from '../core/config';
import { MetricsService } from '../metrics/metrics.service';
import { WorkerModule } from './worker.module';

/** Entry point of the queue worker: `node dist/worker/worker.js`. Scale by running more replicas. */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  const config = app.get<AppConfig>(APP_CONFIG);
  if (config.sentryDsn) Sentry.init({ dsn: config.sentryDsn, environment: config.nodeEnv, tracesSampleRate: 0 });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  if (config.workerMetricsPort && config.metricsToken) {
    const metrics = app.get(MetricsService);
    const server = createServer(async (req, res) => {
      if (req.url !== '/metrics' || !metrics.isAuthorized(req.headers.authorization)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'content-type': metrics.contentType }).end(await metrics.render());
    });
    server.listen(config.workerMetricsPort, '0.0.0.0');
    process.once('SIGTERM', () => server.close());
  }
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
