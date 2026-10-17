import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { CurrentSession } from '../common/decorators';
import type { AuthedRequest, SessionData } from '../common/types';
import { SettingsCache } from '../redis/settings-cache.service';
import { GuildAccessGuard } from './guild-access.guard';
import { GuildsService } from './guilds.service';

@Controller('guilds')
export class GuildsController {
  constructor(
    private readonly guilds: GuildsService,
    private readonly settings: SettingsCache,
  ) {}

  @Get()
  async list(@CurrentSession() session: SessionData, @Req() req: AuthedRequest) {
    return { guilds: await this.guilds.listForUser(session, req.sid) };
  }

  @Get(':guildId')
  @UseGuards(GuildAccessGuard)
  async detail(@Req() req: AuthedRequest) {
    const guild = req.guild!;
    return { guild: this.guilds.toDetail(guild), settings: await this.settings.get(guild.id) };
  }

  @Get(':guildId/channels')
  @UseGuards(GuildAccessGuard)
  async channels(@Req() req: AuthedRequest) {
    return { channels: await this.guilds.getChannels(req.guild!.id) };
  }
}
