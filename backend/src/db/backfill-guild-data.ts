import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { GuildSyncService } from '../bot/guild-sync.service';
import { DatabaseService } from './database.service';
import { guilds } from './schema';
import { eq } from 'drizzle-orm';
import { DiscordApiError } from '../discord/discord-rest.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const database = app.get(DatabaseService);
    const sync = app.get(GuildSyncService);
    const activeGuilds = await database.db.select({ id: guilds.id }).from(guilds).where(eq(guilds.installed, true));
    const failures: string[] = [];

    for (const { id } of activeGuilds) {
      try {
        await sync.syncGuild(id);
        console.log(`Backfilled ${id}`);
      } catch (error) {
        if (error instanceof DiscordApiError && error.status === 404 && error.discordCode === 10004) {
          await sync.markLeft(id);
          console.warn(`Skipped ${id}: bot is no longer in this guild; existing settings and templates were retained`);
          continue;
        }
        failures.push(id);
        console.error(`Backfill failed for ${id}:`, error);
      }
    }

    if (failures.length) throw new Error(`Guild data backfill failed for ${failures.join(', ')}`);
    console.log(`Backfilled ${activeGuilds.length} active guild(s)`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
