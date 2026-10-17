import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { BotModule } from './bot.module';

/** Runs inside every shard process spawned by manager.ts. */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(BotModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
