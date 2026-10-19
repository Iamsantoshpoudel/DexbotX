import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { QueueModule } from '../queue/queue.module';
import { DiscordModule } from '../discord/discord.module';
import { BotService } from './bot.service';
import { GuildSyncService } from './guild-sync.service';

@Module({
  imports: [CoreModule, QueueModule, DiscordModule],
  providers: [BotService, GuildSyncService],
})
export class BotModule {}
