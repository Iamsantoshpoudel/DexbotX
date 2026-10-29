import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { QueueModule } from '../queue/queue.module';
import { DiscordModule } from '../discord/discord.module';
import { MetricsModule } from '../metrics/metrics.module';
import { BotService } from './bot.service';
import { GuildSyncService } from './guild-sync.service';
import { ModerationService } from './moderation.service';

@Module({
  imports: [CoreModule, QueueModule, DiscordModule, MetricsModule],
  providers: [BotService, GuildSyncService, ModerationService],
})
export class BotModule {}
