import 'dotenv/config';
import 'reflect-metadata';
import { createServer } from 'node:http';
import { NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { Logger } from 'nestjs-pino';
import { StatsService } from '../admin/stats.service';
import { APP_CONFIG, AppConfig } from '../core/config';
import { MetricsService } from '../metrics/metrics.service';
import { MemberEventsQueue } from '../queue/member-events.queue';
import { WorkerModule } from './worker.module';

/** Entry point of the queue worker: `node dist/worker/worker.js`. Scale by running more replicas. */
async function bootstrap() {
  process.env.DEXBOTX_PROCESS_ROLE = 'worker';
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  const config = app.get<AppConfig>(APP_CONFIG);
  if (config.sentryDsn) Sentry.init({ dsn: config.sentryDsn, environment: config.nodeEnv, tracesSampleRate: 0 });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const queue = app.get(MemberEventsQueue).queue;
  const stats = app.get(StatsService);
  const logger = app.get(Logger);
  const publishHeartbeat = async () => {
    try {
      const counts = await queue.getJobCounts('active', 'waiting');
      await stats.heartbeat('worker', {
        active: counts.active ?? 0,
        waiting: counts.waiting ?? 0,
        at: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Worker heartbeat failed: ${(error as Error).message}`);
    }
  };
  const heartbeatTimer = setInterval(() => {
    void publishHeartbeat();
  }, 15_000);
  heartbeatTimer.unref();
  void publishHeartbeat();
  const clearHeartbeat = () => clearInterval(heartbeatTimer);
  process.once('SIGTERM', clearHeartbeat);
  process.once('SIGINT', clearHeartbeat);

  let metricsServer: ReturnType<typeof createServer> | undefined;
  if (config.workerMetricsPort && config.metricsToken) {
    const metrics = app.get(MetricsService);
    metricsServer = createServer(async (req, res) => {
      if (req.url !== '/metrics' || !metrics.isAuthorized(req.headers.authorization)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'content-type': metrics.contentType }).end(await metrics.render());
    });
    metricsServer.listen(config.workerMetricsPort, '0.0.0.0');
  }
  process.once('SIGTERM', () => metricsServer?.close());
  process.once('SIGINT', () => metricsServer?.close());
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
