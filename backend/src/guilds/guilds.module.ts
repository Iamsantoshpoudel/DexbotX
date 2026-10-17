import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DiscordModule } from '../discord/discord.module';
import { GuildAccessGuard } from './guild-access.guard';
import { GuildsController } from './guilds.controller';
import { InviteController } from './invite.controller';
import { GuildsService } from './guilds.service';

@Module({
  imports: [AuthModule, DiscordModule],
  controllers: [GuildsController, InviteController],
  providers: [GuildsService, GuildAccessGuard],
  exports: [GuildsService, GuildAccessGuard],
})
export class GuildsModule {}
