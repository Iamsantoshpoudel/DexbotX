import { Controller, Get, HttpCode, HttpException, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { GuildSyncService } from '../bot/guild-sync.service';
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
    private readonly sync: GuildSyncService,
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

  @Get(':guildId/roles')
  @UseGuards(GuildAccessGuard)
  async roles(@Req() req: AuthedRequest) {
    return { roles: await this.sync.getRoles(req.guild!.id) };
  }

  @Post(':guildId/refresh')
  @HttpCode(200)
  @UseGuards(GuildAccessGuard)
  async refresh(@Req() req: AuthedRequest) {
    const guildId = req.guild!.id;
    if (!(await this.sync.tryAcquireRefreshCooldown(guildId))) {
      throw new HttpException('This server was refreshed recently. Try again in 30 seconds.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.sync.syncGuild(guildId);
  }
}
