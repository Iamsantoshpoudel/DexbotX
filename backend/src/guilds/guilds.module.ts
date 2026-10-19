import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GuildSyncService } from '../bot/guild-sync.service';
import { DiscordModule } from '../discord/discord.module';
import { BotAddedController } from './bot-added.controller';
import { GuildAccessGuard } from './guild-access.guard';
import { GuildEventsController } from './guild-events.controller';
import { GuildEventsService } from './guild-events.service';
import { GuildsController } from './guilds.controller';
import { InviteController } from './invite.controller';
import { GuildsService } from './guilds.service';

@Module({
  imports: [AuthModule, DiscordModule],
  controllers: [GuildsController, GuildEventsController, InviteController, BotAddedController],
  providers: [GuildsService, GuildSyncService, GuildAccessGuard, GuildEventsService],
  exports: [GuildsService, GuildAccessGuard],
})
export class GuildsModule {}
